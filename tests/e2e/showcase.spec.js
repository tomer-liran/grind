import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "grind:onboarding",
      JSON.stringify({
        step: "home_card",
        status: "completed",
        hasCompletedOnboarding: true,
        hasDismissedOnboarding: false,
      }),
    );
  });
  await page.goto("/");
});

test("home and training log are keyboard-accessible", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "GRIND" })).toBeVisible();
  await page.getByRole("button", { name: "Training log" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Training log" })).toBeVisible();
  await expect(page.getByText("No sessions yet")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("starts, logs, and resumes a workout after reload", async ({ page }) => {
  await page.getByRole("button", { name: /Start Workout: Full Body A/i }).click();
  await expect(
    page.getByRole("heading", { name: /Built for Full Body A/i }),
  ).toBeVisible();
  await expect(page.locator(".workout-plan-row")).toHaveCount(7);
  await page.getByRole("button", { name: "Start Workout", exact: true }).click();

  await page.locator('[data-field="weight"]').fill("20");
  await page.locator('[data-field="reps"]').fill("10");
  await page.getByRole("button", { name: "LOG" }).click();
  await page.reload();

  await expect(
    page.getByRole("button", { name: /Resume Workout: Full Body A/i }),
  ).toBeVisible();
});

test("migrates legacy history into the visible training log", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem("grind:state");
    localStorage.setItem(
      "grind:history",
      JSON.stringify([
        {
          date: "20/10/2026",
          templateId: "A",
          weekKey: "2026-10-19",
          durationMinutes: 42,
          totalSets: 3,
          entries: [],
          timestamp: "2026-10-20T08:42:00.000Z",
        },
      ]),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Training log" }).click();
  await expect(page.locator("#history-list").getByText("Full Body A")).toBeVisible();
  await expect(page.getByText("20/10/2026 · 42 min")).toBeVisible();
});

test("shuffles, swaps, and discards a workout cleanly", async ({ page }) => {
  await page.getByRole("button", { name: /Start Workout: Full Body A/i }).click();
  const firstExercise = page.locator(".workout-plan-row-name").first();
  const initialName = await firstExercise.textContent();

  await page.getByRole("button", { name: "Swap Lower (Quad)" }).click();
  await expect(firstExercise).not.toHaveText(initialName);

  const swappedName = await firstExercise.textContent();
  await page.getByRole("button", { name: "Shuffle All" }).click();
  await expect(firstExercise).not.toHaveText(swappedName);

  await page.getByRole("button", { name: "Back to workouts" }).click();
  await expect(page.getByRole("dialog", { name: "Leave this session?" })).toBeVisible();
  await page.getByRole("button", { name: "Discard session" }).click();
  await expect(
    page.getByRole("button", { name: /Start Workout: Full Body A/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Resume Workout: Full Body A/i }),
  ).toHaveCount(0);
});

test("completes a workout and persists it to history", async ({ page }) => {
  await page.getByRole("button", { name: /Start Workout: Full Body A/i }).click();

  await page.evaluate(() => {
    const envelope = JSON.parse(localStorage.getItem("grind:state"));
    const session = envelope.records["grind:session-active"];
    const exercise = { ...session.pickedExercises[0], sets: 1, restSeconds: 0 };
    session.slots = [session.slots[0]];
    session.pickedExercises = [exercise];
    session.slotIndex = 0;
    session.currentExercise = exercise;
    session.currentSlot = session.slots[0];
    session.currentSets = [
      {
        weight: "",
        reps: "",
        done: false,
        prefilledWeight: false,
        prefilledReps: false,
      },
    ];
    session.entries = [];
    envelope.records["grind:session-active"] = session;
    localStorage.setItem("grind:state", JSON.stringify(envelope));
  });
  await page.reload();
  await page.getByRole("button", { name: /Resume Workout: Full Body A/i }).click();
  await page.locator('[data-field="weight"]').fill("20");
  await page.locator('[data-field="reps"]').fill("10");
  await page.getByRole("button", { name: "LOG" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Session complete" })).toBeVisible();
  await page.getByRole("button", { name: "Back to plan" }).click();
  await page.getByRole("button", { name: "Training log" }).click();
  await expect(page.locator("#history-list").getByText("Full Body A")).toBeVisible();
});

test("deletes and restores a history entry", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem("grind:state");
    localStorage.setItem(
      "grind:history",
      JSON.stringify([
        {
          id: "history-delete-test",
          date: "20/10/2026",
          templateId: "A",
          weekKey: "2026-10-19",
          durationMinutes: 42,
          totalSets: 1,
          entries: [
            {
              exerciseId: "dumbbell-goblet-squat",
              exerciseName: "Dumbbell Goblet Squat",
              categoryKey: "lower-quad",
              categoryLabel: "LOWER · QUAD",
              sets: [{ weight: "20", reps: "10" }],
            },
          ],
          timestamp: "2026-10-20T08:42:00.000Z",
        },
      ]),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Training log" }).click();
  await page.getByRole("button", { name: "Details" }).click();
  await page.getByRole("button", { name: "Delete session" }).click();
  await page
    .getByRole("dialog", { name: "Delete this session?" })
    .getByRole("button", { name: "Delete session" })
    .click();
  await expect(page.getByText("No sessions yet")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#history-list").getByText("Full Body A")).toBeVisible();
});

test("reloads from the service worker while offline", async ({ context, page }) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "GRIND" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "GRIND" })).toBeVisible();
  await expect(page.getByText("Offline · saved locally")).toBeVisible();
  await context.setOffline(false);
});

test("remains usable with reduced motion, zoom-equivalent width, and landscape", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.getByRole("heading", { name: "GRIND" })).toBeVisible();
  const minTargetHeight = await page
    .getByRole("button", { name: "Training log" })
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(minTargetHeight).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 667, height: 375 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
