import { DAYS } from "../data/workouts.js";
import {
  createSessionState,
  normalizeSessionTiming,
  pauseSessionClock,
  resumeSessionClock,
} from "../domain/session.js";
import { storageDel, storageGet, storageSet } from "../lib/storage.js";
import { closeDialog, openDialog } from "../ui/dialog.js";

let runtime = {
  getWeekKey: () => "",
  goHome: () => {},
  pickAllExercises: () => {},
  queueOnboardingRefresh: () => {},
};

let session = null;

export function initSessionStore(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function getSession() {
  return session;
}

export function setSession(nextSession) {
  session = nextSession;
  return session;
}

export function loadSession() {
  const stored = storageGet("grind:session-active", null);
  return stored ? normalizeSessionTiming(stored) : null;
}

export function saveSession() {
  return session
    ? storageSet("grind:session-active", session)
    : storageDel("grind:session-active");
}

export function clearSession() {
  session = null;
  return storageDel("grind:session-active");
}

export function pauseSession() {
  if (!session) session = loadSession();
  if (!session) return null;
  session = pauseSessionClock(session);
  saveSession();
  return session;
}

export function resumeSessionTiming() {
  if (!session) session = loadSession();
  if (!session) return null;
  session = resumeSessionClock(session);
  saveSession();
  return session;
}

export function closeExitSessionModal() {
  const modal = document.getElementById("exit-session-modal");
  if (!modal) return;
  closeDialog(modal);
  runtime.queueOnboardingRefresh();
}

export function openExitSessionModal(triggerEl = null) {
  if (!loadSession()) {
    runtime.goHome();
    return;
  }

  const modal = document.getElementById("exit-session-modal");
  if (!modal) {
    runtime.goHome();
    return;
  }

  openDialog(modal, triggerEl);
  runtime.queueOnboardingRefresh();
}

export function startSession(templateId) {
  const day = DAYS[templateId];
  if (!day?.slots?.length) return null;
  const weekKey = runtime.getWeekKey();

  session = createSessionState({
    templateId,
    weekKey,
    slots: day.slots,
  });
  const picked = runtime.pickAllExercises();
  if (!picked.length) {
    clearSession();
    return null;
  }
  saveSession();
  return session;
}
