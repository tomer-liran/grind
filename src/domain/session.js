// @ts-check

function fallbackId() {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createStableId() {
  return globalThis.crypto?.randomUUID?.() ?? fallbackId();
}

export function createSessionState({
  templateId,
  weekKey,
  slots,
  now = Date.now(),
  id = createStableId(),
}) {
  const timestamp = new Date(now).toISOString();
  return {
    id,
    templateId,
    weekKey,
    slots: slots.map((slot) => ({ ...slot })),
    slotIndex: 0,
    pickedExercises: [],
    reservations: {},
    currentExercise: null,
    currentSlot: null,
    currentSets: [],
    partialSets: {},
    spinState: "ready",
    entries: [],
    restEndsAt: null,
    startTime: timestamp,
    activeStartedAt: timestamp,
    activeElapsedMs: 0,
    pausedAt: null,
    status: "in_progress",
  };
}

export function normalizeSessionTiming(session, now = Date.now()) {
  if (!session) return null;
  const normalized = { ...session };
  normalized.id ||= createStableId();
  normalized.activeElapsedMs = Number.isFinite(normalized.activeElapsedMs)
    ? normalized.activeElapsedMs
    : 0;
  normalized.activeStartedAt ||=
    normalized.pausedAt || normalized.startTime || new Date(now).toISOString();
  normalized.pausedAt ??= null;
  return normalized;
}

export function pauseSessionClock(session, now = Date.now()) {
  const normalized = normalizeSessionTiming(session, now);
  if (!normalized || normalized.pausedAt) return normalized;

  const activeStart = new Date(normalized.activeStartedAt).getTime();
  normalized.activeElapsedMs += Math.max(0, now - activeStart);
  normalized.activeStartedAt = null;
  normalized.pausedAt = new Date(now).toISOString();
  return normalized;
}

export function resumeSessionClock(session, now = Date.now()) {
  const normalized = normalizeSessionTiming(session, now);
  if (!normalized) return null;
  if (!normalized.pausedAt && normalized.activeStartedAt) return normalized;

  normalized.activeStartedAt = new Date(now).toISOString();
  normalized.pausedAt = null;
  return normalized;
}

export function getSessionDurationMinutes(session, now = Date.now()) {
  const normalized = normalizeSessionTiming(session, now);
  if (!normalized) return 0;

  let elapsed = normalized.activeElapsedMs;
  if (!normalized.pausedAt && normalized.activeStartedAt) {
    elapsed += Math.max(0, now - new Date(normalized.activeStartedAt).getTime());
  }
  return Math.max(1, Math.round(elapsed / 60_000));
}

export function createHistoryEntry(session, durationMinutes, now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    id: session.id,
    date: new Date(now).toLocaleDateString("en-GB"),
    templateId: session.templateId,
    weekKey: session.weekKey,
    durationMinutes,
    totalSets: session.entries.reduce(
      (sum, entry) => sum + (entry.sets?.length ?? 0),
      0,
    ),
    entries: session.entries.map((entry) => ({
      ...entry,
      sets: (entry.sets || []).map((set) => ({ ...set })),
    })),
    timestamp,
  };
}
