import { DAYS, EXERCISES } from "../data/workouts.js";
import { validateWorkoutConfig } from "../domain/workout-plan.js";
import {
  commitCompletedSession,
  migrateStoredAppState,
} from "../infrastructure/state-repository.js";
import {
  applyAppUpdate,
  closeUpdateAppModal,
  discardSessionAndGoHome,
  fireConfetti,
  goHome,
  initAppShell,
  keepSessionAndGoHome,
  registerAppUpdatePrompt,
  renderAppVersionBadge,
  renderDayPicker,
  renderDoneScreen,
  resumeSession,
  showConfigurationError,
  showPROverlay,
  showScreen,
} from "./app-shell.js";
import { wireEvents } from "./events.js";
import {
  exportWorkoutData,
  importWorkoutData,
  initDataPortability,
  resetWorkoutData,
} from "./data-portability.js";
import {
  dismissKeyboard,
  handleExercisePrimaryAction,
  initExerciseFlow,
  isSetReady,
  launchExercise,
  renderSets,
  resumeCurrentExercise,
  syncExercisePrimaryAction,
  updateCurrentSetField,
} from "./exercise-flow.js";
import {
  deleteHistoryEntry,
  getExerciseProgressSeries,
  getLatestCompletedExerciseEntry,
  initHistory,
  loadHistory,
  renderHistory,
  showMoreHistory,
} from "./history.js";
import {
  advanceOnboardingStep,
  ensureOnboardingState,
  finishOnboarding,
  initOnboarding,
  isOnboardingActive,
  queueOnboardingRefresh,
  trackOnboardingViewport,
} from "./onboarding.js";
import { checkAndUpdatePR, getLastWeight, getOverloadNudge } from "./prs.js";
import {
  buildSyncPayload,
  flushSyncQueue,
  initSync,
  showSyncBar,
  syncToSheets,
} from "./sync.js";
import {
  getRemainingRestSeconds,
  initRestTimer,
  resumeRestIfNeeded,
  skipRest,
  startRest,
  stopRest,
} from "./rest-timer.js";
import {
  clearSession,
  closeExitSessionModal,
  getSession,
  initSessionStore,
  loadSession,
  openExitSessionModal,
  pauseSession,
  resumeSessionTiming,
  saveSession,
  setSession,
  startSession,
} from "./session-store.js";
import {
  cancelPullGesture,
  getSessionSpinState,
  initSpin,
  pickAllExercises,
  renderSlotMachine,
  startSpinReveal,
  swapWorkoutExercise,
} from "./spin.js";
import {
  formatWeekdayLabel,
  getCompletedDays,
  getOrCreateDayAssignment,
  getUsedExercises,
  getWeekKey,
  loadWeek,
} from "./week-store.js";

let modulesInitialized = false;
let appInitialized = false;

function startValidatedSession(templateId) {
  const errors = validateWorkoutConfig(DAYS, EXERCISES);
  if (errors.length > 0) {
    showConfigurationError(errors[0]);
    return null;
  }
  return startSession(templateId);
}

function initializeModules() {
  if (modulesInitialized) return;

  initSync({ getSession });
  initDataPortability({ showStatus: showSyncBar });
  initOnboarding({
    getSession,
    isSetReady,
    loadHistory,
    loadSession,
  });
  initSpin({
    getSession,
    saveSession,
    getUsedExercises,
    advanceOnboardingStep,
    queueOnboardingRefresh,
    showConfigurationError,
  });
  initSessionStore({
    getWeekKey,
    goHome,
    pickAllExercises,
    queueOnboardingRefresh,
  });
  initAppShell({
    queueOnboardingRefresh,
    cancelPullGesture,
    stopRest,
    closeExitSessionModal,
    clearSession,
    loadSession,
    setSession,
    pickAllExercises,
    getWeekKey,
    loadWeek,
    getOrCreateDayAssignment,
    formatWeekdayLabel,
    getSessionSpinState,
    getSession,
    renderSlotMachine,
    resumeCurrentExercise,
    pauseSession,
    resumeSessionTiming,
  });
  initHistory({
    renderDayPicker,
    showSyncBar,
  });
  initExerciseFlow({
    getSession,
    saveSession,
    clearSession,
    checkAndUpdatePR,
    getOverloadNudge,
    getLastWeight,
    getExerciseProgressSeries,
    getLatestCompletedExerciseEntry,
    commitCompletedSession,
    buildSyncPayload,
    syncToSheets,
    showPROverlay,
    renderDoneScreen,
    showScreen,
    showConfigurationError,
    showStatus: showSyncBar,
    fireConfetti,
    isOnboardingActive,
    finishOnboarding,
    advanceOnboardingStep,
    queueOnboardingRefresh,
    trackOnboardingViewport,
    startRest,
    stopRest,
    skipRest,
    getRemainingRestSeconds,
    resumeRestIfNeeded,
    pickAllExercises,
  });
  initRestTimer({
    getSession,
    saveSession,
    renderSets,
    syncExercisePrimaryAction,
  });

  modulesInitialized = true;
}

function getActiveHomeSession() {
  const saved = loadSession();
  return saved?.status === "in_progress" ? saved : null;
}

export function init() {
  initializeModules();
  if (appInitialized) return;
  appInitialized = true;

  const migration = migrateStoredAppState();
  if (!migration.ok) {
    showSyncBar(
      "Could not migrate local data. Your legacy data was left untouched.",
      "error",
    );
  }

  ensureOnboardingState();
  wireEvents({
    renderHistory,
    showScreen,
    getActiveHomeSession,
    getCompletedDays,
    getWeekKey,
    startSession: startValidatedSession,
    advanceOnboardingStep,
    renderSlotMachine,
    discardSessionAndGoHome,
    keepSessionAndGoHome,
    startSpinReveal,
    swapWorkoutExercise,
    launchExercise,
    openExitSessionModal,
    dismissKeyboard,
    handleExercisePrimaryAction,
    updateCurrentSetField,
    goHome,
    showMoreHistory,
    deleteHistoryEntry,
    closeExitSessionModal,
    applyAppUpdate,
    closeUpdateAppModal,
    finishOnboarding,
    queueOnboardingRefresh,
    trackOnboardingViewport,
    resumeSession,
    exportWorkoutData,
    importWorkoutData,
    resetWorkoutData,
  });

  renderAppVersionBadge();
  renderDayPicker();
  queueOnboardingRefresh();

  if (window.visualViewport) {
    const handleViewportChange = () => {
      trackOnboardingViewport();
      queueOnboardingRefresh();
    };
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
  }

  window.addEventListener("online", () => void flushSyncQueue());
  window.addEventListener("grind:storage-error", () => {
    showSyncBar(
      "Could not save. Free browser storage, then retry before leaving.",
      "error",
    );
  });
  void flushSyncQueue();
}

export { registerAppUpdatePrompt };
