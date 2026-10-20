import {
  formatWeekdayLabel,
  getLocalWeekKey,
  getLocalWeekday,
  WEEKDAY_NAMES,
} from "../domain/calendar.js";
import { getStorageKeys, storageGet, storageSet } from "../lib/storage.js";

const DAY_TEMPLATES = ["A", "B", "C"];

export { DAY_TEMPLATES, WEEKDAY_NAMES };
export { formatWeekdayLabel };

export function getTodayWeekday() {
  return getLocalWeekday();
}

export function createEmptyWeek() {
  return {
    templateChoices: DAY_TEMPLATES.slice(),
    completed: [],
    completedByTemplate: {},
    completedWeekdays: [],
    usedExercises: {},
  };
}

export function normalizeWeekData(week) {
  const normalized = {
    ...createEmptyWeek(),
    ...(week && typeof week === "object" ? week : {}),
  };
  let changed = false;

  const templateChoices = Array.isArray(normalized.templateChoices)
    ? normalized.templateChoices.filter((id) => DAY_TEMPLATES.includes(id))
    : [];
  const hasAllTemplates =
    templateChoices.length === DAY_TEMPLATES.length &&
    DAY_TEMPLATES.every((id) => templateChoices.includes(id));
  const isCanonicalOrder =
    hasAllTemplates &&
    templateChoices.every((id, index) => id === DAY_TEMPLATES[index]);
  if (!hasAllTemplates || !isCanonicalOrder) {
    normalized.templateChoices = DAY_TEMPLATES.slice();
    changed = true;
  }

  if ("dayAssignment" in normalized) {
    delete normalized.dayAssignment;
    changed = true;
  }

  if (!Array.isArray(normalized.completed)) {
    normalized.completed = [];
    changed = true;
  }

  if (
    !normalized.completedByTemplate ||
    typeof normalized.completedByTemplate !== "object" ||
    Array.isArray(normalized.completedByTemplate)
  ) {
    normalized.completedByTemplate = {};
    changed = true;
  }

  if (!Array.isArray(normalized.completedWeekdays)) {
    normalized.completedWeekdays = [];
    changed = true;
  }

  if (
    normalized.completed.length > 0 &&
    Object.keys(normalized.completedByTemplate).length === 0 &&
    normalized.completedWeekdays.length > 0
  ) {
    normalized.completed.forEach((templateId, index) => {
      const weekday = normalized.completedWeekdays[index];
      if (DAY_TEMPLATES.includes(templateId) && WEEKDAY_NAMES.includes(weekday)) {
        normalized.completedByTemplate[templateId] = weekday;
      }
    });
    changed = true;
  }

  if (
    !normalized.usedExercises ||
    typeof normalized.usedExercises !== "object" ||
    Array.isArray(normalized.usedExercises)
  ) {
    normalized.usedExercises = {};
    changed = true;
  }

  return { week: normalized, changed };
}

export function getOrCreateDayAssignment(weekKey) {
  const week = loadWeek(weekKey);
  if (Array.isArray(week.templateChoices)) return week.templateChoices;

  week.templateChoices = DAY_TEMPLATES.slice();
  saveWeek(weekKey, week);
  return week.templateChoices;
}

export function getWeekKey(date = new Date()) {
  return getLocalWeekKey(date);
}

export function weekStorageKey(weekKey) {
  return `grind:week-${weekKey}`;
}

export function getStoredWeekKeys() {
  return getStorageKeys("grind:week-").map((key) => key.slice("grind:week-".length));
}

export function loadWeek(weekKey) {
  const key = weekStorageKey(weekKey);
  const stored = storageGet(key, createEmptyWeek());
  const { week, changed } = normalizeWeekData(stored);
  if (changed) storageSet(key, week);
  return week;
}

export function saveWeek(weekKey, data) {
  storageSet(weekStorageKey(weekKey), data);
}

export function getUsedExercises(categoryKey, weekKey) {
  const week = loadWeek(weekKey);
  return week.usedExercises[categoryKey] || [];
}

export function markExerciseUsed(categoryKey, name, weekKey) {
  const week = loadWeek(weekKey);
  if (!week.usedExercises[categoryKey]) week.usedExercises[categoryKey] = [];
  if (!week.usedExercises[categoryKey].includes(name)) {
    week.usedExercises[categoryKey].push(name);
  }
  saveWeek(weekKey, week);
}

export function markDayComplete(templateId, weekKey) {
  const week = loadWeek(weekKey);
  if (!week.completed.includes(templateId)) week.completed.push(templateId);
  const today = getTodayWeekday();
  if (!week.completedByTemplate) week.completedByTemplate = {};
  week.completedByTemplate[templateId] = today;
  if (!week.completedWeekdays) week.completedWeekdays = [];
  if (!week.completedWeekdays.includes(today)) {
    week.completedWeekdays.push(today);
  }
  saveWeek(weekKey, week);
}

export function getCompletedDays(weekKey) {
  return loadWeek(weekKey).completed;
}

export function getHistoryEntryWeekday(entry) {
  if (entry?.timestamp) {
    const date = new Date(entry.timestamp);
    if (!Number.isNaN(date.getTime())) {
      return WEEKDAY_NAMES[date.getDay()] || "";
    }
  }

  if (typeof entry?.date === "string") {
    const match = entry.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      const date = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return WEEKDAY_NAMES[date.getDay()] || "";
      }
    }
  }

  return "";
}
