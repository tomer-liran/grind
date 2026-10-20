import { storageGet, storageSet } from "../lib/storage.js";
import {
  formatKilograms,
  formatWeightLabel,
  parseWeight,
  previewPersonalBests,
} from "../domain/progress.js";

export { formatWeightLabel, parseWeight };
export const fmtKg = formatKilograms;

function getPRRecord(exerciseIdOrName) {
  const all = storageGet("grind:pr", {});
  if (all[exerciseIdOrName]) {
    return { key: exerciseIdOrName, record: all[exerciseIdOrName], all };
  }

  const match = Object.entries(all).find(
    ([, record]) => record?.exerciseName === exerciseIdOrName,
  );
  return match
    ? { key: match[0], record: match[1], all }
    : { key: exerciseIdOrName, record: {}, all };
}

export function loadPR(exerciseName) {
  return getPRRecord(exerciseName).record;
}

export function savePR(exerciseName, data) {
  const { all, key } = getPRRecord(exerciseName);
  all[key] = data;
  storageSet("grind:pr", all);
}

export function saveLastWeight(exerciseName, sets) {
  const numericWeights = sets
    .map((set) => parseWeight(set.weight))
    .filter((weight) => weight !== null);
  if (numericWeights.length === 0) return;
  const max = Math.max(...numericWeights);
  const { all, key, record } = getPRRecord(exerciseName);
  all[key] = { ...record, lastWeight: String(max) };
  storageSet("grind:pr", all);
}

export function checkAndUpdatePR(exerciseName, sets) {
  return previewPersonalBests(loadPR(exerciseName), sets);
}

export function getOverloadNudge(exerciseName) {
  const history = loadPR(exerciseName);
  const recent = (history.sessions || []).slice(-3);
  if (recent.length < 3) return null;

  if (history.lastNudgeDate) {
    const daysSince = (Date.now() - new Date(history.lastNudgeDate)) / 86400000;
    if (daysSince < 21) return null;
  }

  const weights = recent.map((session) => session.maxSetWeight).filter(Boolean);
  if (weights.length < 3) return null;
  if (!weights.every((weight) => weight === weights[0])) return null;

  return { currentWeight: weights[0], suggestedWeight: weights[0] + 2.5 };
}

export function markNudgeShown(exerciseName) {
  const history = loadPR(exerciseName);
  history.lastNudgeDate = new Date().toISOString();
  savePR(exerciseName, history);
}

export function getLastWeight(exerciseName) {
  return loadPR(exerciseName).lastWeight ?? null;
}
