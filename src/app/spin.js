import refreshRerollIconSvgRaw from "lucide-static/icons/refresh-ccw-dot.svg?raw";
import { DAYS, EXERCISES } from "../data/workouts.js";
import { pickExerciseFromPool } from "../domain/workout-plan.js";

export const SPIN_STATE_READY = "ready";
export const SPIN_STATE_SPINNING = "spinning";
export const SPIN_STATE_LANDED = "landed";

const SHUFFLE_DURATION_MS = 220;
const SLOT_DISPLAY_LABELS = {
  "lower-quad": "Lower (Quad)",
  "push-horizontal": "Chest",
  "pull-vertical": "Back (Vertical)",
  "lower-hinge": "Lower (Hinge)",
  "push-vertical": "Shoulders",
  "pull-horizontal": "Back (Horizontal)",
  accessory: "Accessory",
  "lower-glute": "Lower (Glute)",
  "arms-tricep": "Triceps",
  "arms-bicep": "Biceps",
  core: "Core",
  calves: "Calves",
};

const refreshRerollIconSvg = refreshRerollIconSvgRaw
  .replace(/<!--[\s\S]*?-->\s*/, "")
  .replace(
    'class="lucide lucide-refresh-ccw-dot"',
    'class="workout-plan-swap-icon" aria-hidden="true" focusable="false"',
  );

let runtime = {
  getSession: () => null,
  saveSession: () => false,
  getUsedExercises: () => [],
  advanceOnboardingStep: () => {},
  queueOnboardingRefresh: () => {},
  showConfigurationError: () => {},
};

export function initSpin(deps = {}) {
  runtime = { ...runtime, ...deps };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function normalizeSpinState(state) {
  return [SPIN_STATE_READY, SPIN_STATE_SPINNING, SPIN_STATE_LANDED].includes(state)
    ? state
    : SPIN_STATE_LANDED;
}

export function getSessionSpinState() {
  return normalizeSpinState(runtime.getSession()?.spinState);
}

function setSpinState(state) {
  const session = runtime.getSession();
  if (!session) return;
  session.spinState = state;
  runtime.saveSession();
}

function getReservedIds(categoryKey, excludeSlotIndex = null) {
  const session = runtime.getSession();
  return Object.entries(session?.reservations || {})
    .filter(([key]) => {
      if (!key.startsWith(`${categoryKey}:`)) return false;
      return excludeSlotIndex === null || key !== `${categoryKey}:${excludeSlotIndex}`;
    })
    .map(([, exerciseId]) => exerciseId);
}

export function pickExercise(categoryKey, slotPosition, options = {}) {
  const session = runtime.getSession();
  if (!session) return null;

  const pool = EXERCISES[categoryKey] ?? [];
  const chosen = pickExerciseFromPool({
    pool,
    weekUsedIds: runtime.getUsedExercises(categoryKey, session.weekKey),
    sessionUsedIds: getReservedIds(categoryKey, slotPosition),
    excludedIds: options.excludeIds ?? [],
    random: options.random,
  });

  if (!chosen) {
    runtime.showConfigurationError(`No exercises are configured for "${categoryKey}".`);
    return null;
  }

  session.reservations ||= {};
  session.reservations[`${categoryKey}:${slotPosition}`] = chosen.id;
  if (options.save !== false) runtime.saveSession();
  return chosen;
}

export function pickAllExercises(options = {}) {
  const session = runtime.getSession();
  if (!session?.slots?.length) return [];

  const previousIds = (session.pickedExercises || []).map((exercise) => exercise?.id);
  if (options.forceNew) session.reservations = {};

  session.pickedExercises = session.slots.map((slot, index) => {
    const reservationKey = `${slot.key}:${index}`;
    const existingId = options.forceNew ? null : session.reservations?.[reservationKey];
    const existing = EXERCISES[slot.key]?.find(
      (exercise) => exercise.id === existingId || exercise.name === existingId,
    );
    if (existing && !options.excludeCurrent) return existing;

    return pickExercise(slot.key, index, {
      save: false,
      excludeIds:
        options.excludeCurrent && previousIds[index] ? [previousIds[index]] : [],
    });
  });

  if (session.pickedExercises.some((exercise) => !exercise)) return [];
  setSpinState(SPIN_STATE_LANDED);
  runtime.saveSession();
  return session.pickedExercises;
}

function renderPlanRow(slot, exercise, index) {
  const slotLabel = escapeHtml(SLOT_DISPLAY_LABELS[slot.key] ?? slot.label);
  const exerciseName = escapeHtml(exercise?.name ?? "Exercise unavailable");
  const busy = getSessionSpinState() === SPIN_STATE_SPINNING;

  return `
    <div class="workout-plan-row" data-slot-index="${index}">
      <div class="workout-plan-row-copy">
        <div class="workout-plan-row-label">${slotLabel}</div>
        <div class="workout-plan-row-name">${exerciseName}</div>
      </div>
      <button
        class="workout-plan-swap"
        type="button"
        data-workout-swap="${index}"
        aria-label="Swap ${slotLabel}"
        ${busy ? "disabled" : ""}
      >
        ${refreshRerollIconSvg}
      </button>
    </div>`;
}

function syncControls() {
  const busy = getSessionSpinState() === SPIN_STATE_SPINNING;
  const shuffle = document.getElementById("slot-spin-button");
  const start = document.getElementById("slot-trigger-status");

  if (shuffle) {
    shuffle.disabled = busy;
    shuffle.textContent = busy ? "Shuffling…" : "Shuffle All";
  }
  if (start) start.disabled = busy;
}

export function renderSlotMachine() {
  const session = runtime.getSession();
  const container = document.getElementById("reels-container");
  if (!session || !container) return;

  if (!session.pickedExercises?.length && pickAllExercises().length === 0) {
    return;
  }
  if (getSessionSpinState() !== SPIN_STATE_SPINNING) {
    session.spinState = SPIN_STATE_LANDED;
  }

  const title = document.getElementById("slot-screen-title");
  if (title) {
    title.textContent = `Built for ${DAYS[session.templateId]?.name ?? session.templateId}`;
  }
  container.innerHTML = session.slots
    .map((slot, index) => renderPlanRow(slot, session.pickedExercises[index], index))
    .join("");
  syncControls();
  runtime.queueOnboardingRefresh();
}

async function animateRows(indices) {
  const rows = indices
    .map((index) =>
      document.querySelector(`.workout-plan-row[data-slot-index="${index}"]`),
    )
    .filter(Boolean);
  rows.forEach((row) => row.classList.add("is-shuffling"));
  await wait(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : SHUFFLE_DURATION_MS,
  );
}

export async function startSpinReveal() {
  const session = runtime.getSession();
  if (!session || getSessionSpinState() === SPIN_STATE_SPINNING) return;

  setSpinState(SPIN_STATE_SPINNING);
  syncControls();
  runtime.advanceOnboardingStep("pull_handle", "start_button");
  await animateRows(session.slots.map((_, index) => index));
  if (!runtime.getSession()) return;
  pickAllExercises({ forceNew: true, excludeCurrent: true });
  renderSlotMachine();
}

export async function swapWorkoutExercise(slotIndex) {
  const session = runtime.getSession();
  const slot = session?.slots?.[slotIndex];
  if (!slot || getSessionSpinState() === SPIN_STATE_SPINNING) return null;

  const currentId = session.pickedExercises?.[slotIndex]?.id;
  setSpinState(SPIN_STATE_SPINNING);
  syncControls();
  await animateRows([slotIndex]);
  if (!runtime.getSession()) return null;

  delete session.reservations[`${slot.key}:${slotIndex}`];
  const nextExercise = pickExercise(slot.key, slotIndex, {
    save: false,
    excludeIds: currentId ? [currentId] : [],
  });
  if (nextExercise) session.pickedExercises[slotIndex] = nextExercise;
  setSpinState(SPIN_STATE_LANDED);
  runtime.saveSession();
  renderSlotMachine();
  return nextExercise;
}

export function cancelPullGesture() {
  // Retained as a no-op compatibility boundary for the app shell.
}
