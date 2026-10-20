// @ts-check

import { getLocalWeekday } from "../domain/calendar.js";
import { buildPRStateFromHistory } from "../domain/progress.js";
import {
  createHistoryEntry,
  createStableId,
  normalizeSessionTiming,
} from "../domain/session.js";
import { EXERCISES } from "../data/workouts.js";
import { storageTransaction } from "../lib/storage.js";

const HISTORY_KEY = "grind:history";
const PR_KEY = "grind:pr";
const ACTIVE_SESSION_KEY = "grind:session-active";
const WEEK_KEY_PREFIX = "grind:week-";

function emptyWeek() {
  return {
    templateChoices: ["A", "B", "C"],
    completed: [],
    completedByTemplate: {},
    completedWeekdays: [],
    usedExercises: {},
  };
}

function exerciseByName(name) {
  for (const [categoryKey, pool] of Object.entries(EXERCISES)) {
    const exercise = pool.find((candidate) => candidate.name === name);
    if (exercise) return { exercise, categoryKey };
  }
  return null;
}

function normalizeEntry(entry) {
  const match = exerciseByName(entry?.exerciseName);
  return {
    ...entry,
    exerciseId: entry?.exerciseId ?? match?.exercise.id ?? null,
    categoryKey: entry?.categoryKey ?? match?.categoryKey ?? null,
    sets: Array.isArray(entry?.sets) ? entry.sets.map((set) => ({ ...set })) : [],
  };
}

function normalizeHistoryEntry(entry) {
  return {
    ...entry,
    id: entry?.id ?? createStableId(),
    entries: Array.isArray(entry?.entries) ? entry.entries.map(normalizeEntry) : [],
  };
}

function normalizeHistory(records) {
  return Array.isArray(records[HISTORY_KEY])
    ? records[HISTORY_KEY].map(normalizeHistoryEntry)
    : [];
}

function rebuildWeekRecords(records, history) {
  const weekKeys = new Set(
    Object.keys(records)
      .filter((key) => key.startsWith(WEEK_KEY_PREFIX))
      .map((key) => key.slice(WEEK_KEY_PREFIX.length)),
  );
  history.forEach((entry) => {
    if (entry?.weekKey) weekKeys.add(entry.weekKey);
  });

  weekKeys.forEach((weekKey) => {
    const storageKey = `${WEEK_KEY_PREFIX}${weekKey}`;
    const existing =
      records[storageKey] && typeof records[storageKey] === "object"
        ? records[storageKey]
        : emptyWeek();
    const matching = history.filter((entry) => entry.weekKey === weekKey);
    const completedByTemplate = {};
    const usedExercises = {};

    matching.forEach((entry) => {
      if (["A", "B", "C"].includes(entry.templateId)) {
        completedByTemplate[entry.templateId] = getLocalWeekday(
          new Date(entry.timestamp),
        );
      }
      (entry.entries || []).forEach((exerciseEntry) => {
        if (!exerciseEntry.categoryKey) return;
        usedExercises[exerciseEntry.categoryKey] ||= [];
        const exerciseId = exerciseEntry.exerciseId ?? exerciseEntry.exerciseName;
        if (!usedExercises[exerciseEntry.categoryKey].includes(exerciseId)) {
          usedExercises[exerciseEntry.categoryKey].push(exerciseId);
        }
      });
    });

    const completed = ["A", "B", "C"].filter(
      (templateId) => templateId in completedByTemplate,
    );
    records[storageKey] = {
      ...emptyWeek(),
      ...existing,
      templateChoices: ["A", "B", "C"],
      completed,
      completedByTemplate,
      completedWeekdays: Array.from(
        new Set(completed.map((id) => completedByTemplate[id]).filter(Boolean)),
      ),
      usedExercises,
    };
  });
}

function rebuildDerivedState(records, history) {
  rebuildWeekRecords(records, history);
  records[PR_KEY] = buildPRStateFromHistory(
    history,
    records[PR_KEY] && typeof records[PR_KEY] === "object" ? records[PR_KEY] : {},
  );
}

export function migrateStoredAppState() {
  return storageTransaction((records) => {
    const history = normalizeHistory(records);
    records[HISTORY_KEY] = history;

    if (records[ACTIVE_SESSION_KEY]) {
      const active = normalizeSessionTiming(records[ACTIVE_SESSION_KEY]);
      active.entries = Array.isArray(active.entries)
        ? active.entries.map(normalizeEntry)
        : [];
      active.pickedExercises = Array.isArray(active.pickedExercises)
        ? active.pickedExercises.map((exercise) => {
            const match = exerciseByName(exercise?.name);
            return {
              ...exercise,
              id: exercise?.id ?? match?.exercise.id ?? null,
            };
          })
        : [];
      records[ACTIVE_SESSION_KEY] = active;
    }

    rebuildDerivedState(records, history);
    return { historyCount: history.length };
  });
}

export function commitCompletedSession(session, durationMinutes, now = Date.now()) {
  const historyEntry = createHistoryEntry(session, durationMinutes, now);
  return storageTransaction((records) => {
    const history = normalizeHistory(records);
    const existing = history.find((entry) => entry.id === historyEntry.id);
    if (!existing) history.push(historyEntry);
    records[HISTORY_KEY] = history;
    delete records[ACTIVE_SESSION_KEY];
    rebuildDerivedState(records, history);
    return existing ?? historyEntry;
  });
}

export function deleteCompletedSession(sessionId) {
  return storageTransaction((records) => {
    const history = normalizeHistory(records);
    const index = history.findIndex((entry) => entry.id === sessionId);
    if (index === -1) return null;
    const [deleted] = history.splice(index, 1);
    records[HISTORY_KEY] = history;
    rebuildDerivedState(records, history);
    return { entry: deleted, index };
  });
}

export function restoreCompletedSession(entry, index) {
  return storageTransaction((records) => {
    const history = normalizeHistory(records);
    if (history.some((candidate) => candidate.id === entry.id)) return false;
    history.splice(Math.max(0, Math.min(index, history.length)), 0, entry);
    records[HISTORY_KEY] = history;
    rebuildDerivedState(records, history);
    return true;
  });
}
