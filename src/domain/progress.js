// @ts-check

export function parseWeight(value) {
  if (
    value === null ||
    value === undefined ||
    value === "—" ||
    (typeof value === "string" && value.trim().toLowerCase() === "bw")
  ) {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatKilograms(value) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export function formatWeightLabel(value) {
  return parseWeight(value) !== null ? `${value}kg` : "BW";
}

export function getExerciseRecordKey(entryOrExercise) {
  return (
    entryOrExercise?.exerciseId ??
    entryOrExercise?.id ??
    entryOrExercise?.exerciseName ??
    entryOrExercise?.name ??
    ""
  );
}

export function calculateExerciseMetrics(sets = []) {
  const numericWeights = sets
    .map((set) => parseWeight(set?.weight))
    .filter((weight) => weight !== null);

  if (numericWeights.length === 0) return null;

  return {
    maxSetWeight: Math.max(...numericWeights),
    sessionVolume: sets.reduce(
      (sum, set) =>
        sum + (parseWeight(set?.weight) ?? 0) * (Number.parseInt(set?.reps, 10) || 0),
      0,
    ),
  };
}

export function previewPersonalBests(previous = {}, sets = []) {
  const metrics = calculateExerciseMetrics(sets);
  if (!metrics) return {};

  const prs = {};
  if (metrics.maxSetWeight > (previous.maxWeight || 0)) {
    prs.weight = {
      prev: previous.maxWeight || 0,
      new: metrics.maxSetWeight,
    };
  }
  if (metrics.sessionVolume > (previous.maxVolume || 0)) {
    prs.volume = {
      prev: previous.maxVolume || 0,
      new: metrics.sessionVolume,
    };
  }
  return prs;
}

export function buildPRStateFromHistory(historyEntries = [], previousPR = {}) {
  const nextPR = {};

  historyEntries.forEach((sessionEntry) => {
    (sessionEntry?.entries || []).forEach((exerciseEntry) => {
      const metrics = calculateExerciseMetrics(exerciseEntry?.sets || []);
      if (!metrics) return;

      const recordKey = getExerciseRecordKey(exerciseEntry);
      if (!recordKey) return;

      if (!nextPR[recordKey]) {
        nextPR[recordKey] = {
          exerciseId: exerciseEntry.exerciseId ?? null,
          exerciseName: exerciseEntry.exerciseName ?? recordKey,
          maxWeight: 0,
          maxVolume: 0,
          sessions: [],
        };
      }

      const record = nextPR[recordKey];
      record.maxWeight = Math.max(record.maxWeight, metrics.maxSetWeight);
      record.maxVolume = Math.max(record.maxVolume, metrics.sessionVolume);
      record.lastWeight = String(metrics.maxSetWeight);
      record.sessions.push({
        date: sessionEntry.date,
        weekKey: sessionEntry.weekKey ?? null,
        maxSetWeight: metrics.maxSetWeight,
        sessionVolume: metrics.sessionVolume,
      });
    });
  });

  Object.entries(nextPR).forEach(([recordKey, record]) => {
    record.sessions = record.sessions.slice(-52);
    const previous =
      previousPR[recordKey] ??
      previousPR[record.exerciseName] ??
      Object.values(previousPR).find(
        (candidate) => candidate?.exerciseId === record.exerciseId,
      );
    if (previous?.lastNudgeDate) {
      record.lastNudgeDate = previous.lastNudgeDate;
    }
  });

  return nextPR;
}
