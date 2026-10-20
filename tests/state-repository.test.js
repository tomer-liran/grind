import { describe, expect, it } from "vitest";
import {
  commitCompletedSession,
  deleteCompletedSession,
  migrateStoredAppState,
  restoreCompletedSession,
} from "../src/infrastructure/state-repository.js";
import { storageGet, storageSet } from "../src/lib/storage.js";

function completedSession() {
  return {
    id: "session-atomic",
    templateId: "A",
    weekKey: "2026-10-19",
    startTime: "2026-10-20T08:00:00.000Z",
    activeStartedAt: "2026-10-20T08:00:00.000Z",
    activeElapsedMs: 600_000,
    pausedAt: null,
    status: "in_progress",
    entries: [
      {
        exerciseId: "dumbbell-goblet-squat",
        exerciseName: "Dumbbell Goblet Squat",
        categoryKey: "lower-quad",
        categoryLabel: "LOWER · QUAD",
        sets: [
          { weight: "20", reps: "10" },
          { weight: "22.5", reps: "8" },
        ],
        prs: {
          weight: { prev: 0, new: 22.5 },
          volume: { prev: 0, new: 380 },
        },
        timestamp: "2026-10-20T08:10:00.000Z",
      },
    ],
  };
}

describe("versioned state repository", () => {
  it("migrates legacy records without deleting the legacy backup", () => {
    localStorage.setItem(
      "grind:history",
      JSON.stringify([
        {
          templateId: "A",
          weekKey: "2026-10-19",
          entries: [],
          timestamp: "2026-10-20T08:00:00.000Z",
        },
      ]),
    );

    expect(migrateStoredAppState().ok).toBe(true);
    expect(storageGet("grind:history", [])[0].id).toBeTruthy();
    expect(localStorage.getItem("grind:history")).not.toBeNull();
  });

  it("commits completion and all projections once", () => {
    storageSet("grind:session-active", completedSession());

    expect(commitCompletedSession(completedSession(), 10).ok).toBe(true);
    expect(commitCompletedSession(completedSession(), 10).ok).toBe(true);

    const history = storageGet("grind:history", []);
    const week = storageGet("grind:week-2026-10-19", {});
    const prs = storageGet("grind:pr", {});
    expect(history).toHaveLength(1);
    expect(storageGet("grind:session-active", null)).toBeNull();
    expect(week.completed).toEqual(["A"]);
    expect(week.usedExercises["lower-quad"]).toEqual(["dumbbell-goblet-squat"]);
    expect(prs["dumbbell-goblet-squat"].maxWeight).toBe(22.5);
  });

  it("rebuilds projections after delete and undo", () => {
    commitCompletedSession(completedSession(), 10);
    const deleted = deleteCompletedSession("session-atomic");
    expect(deleted.ok).toBe(true);
    expect(storageGet("grind:history", [])).toHaveLength(0);
    expect(storageGet("grind:week-2026-10-19", {}).completed).toEqual([]);

    const restored = restoreCompletedSession(
      deleted.result.entry,
      deleted.result.index,
    );
    expect(restored.ok).toBe(true);
    expect(storageGet("grind:history", [])).toHaveLength(1);
    expect(storageGet("grind:week-2026-10-19", {}).completed).toEqual(["A"]);
  });
});
