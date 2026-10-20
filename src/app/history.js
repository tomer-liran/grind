import { DAYS } from "../data/workouts.js";
import {
  deleteCompletedSession,
  restoreCompletedSession,
} from "../infrastructure/state-repository.js";
import { storageGet, storageSet } from "../lib/storage.js";
import { formatWeightLabel, parseWeight } from "./prs.js";

let runtime = {
  renderDayPicker: () => {},
  showSyncBar: () => {},
};
let historyOffset = 30;
let lastDeleted = null;

export function initHistory(deps = {}) {
  runtime = { ...runtime, ...deps };
}

export function loadHistory() {
  const history = storageGet("grind:history", []);
  return Array.isArray(history) ? history : [];
}

export function saveHistory(entries) {
  return storageSet("grind:history", entries);
}

export function appendHistory(entry) {
  const history = loadHistory();
  history.push(entry);
  return saveHistory(history);
}

export function getLatestCompletedExerciseEntry(
  exerciseIdOrName,
  historyEntries = loadHistory(),
) {
  for (
    let historyIndex = historyEntries.length - 1;
    historyIndex >= 0;
    historyIndex -= 1
  ) {
    const entries = historyEntries[historyIndex]?.entries || [];
    for (let entryIndex = entries.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const exerciseEntry = entries[entryIndex];
      if (
        exerciseEntry?.exerciseId !== exerciseIdOrName &&
        exerciseEntry?.exerciseName !== exerciseIdOrName
      ) {
        continue;
      }
      return {
        ...exerciseEntry,
        sets: (exerciseEntry.sets || []).map((set) => ({ ...set })),
      };
    }
  }
  return null;
}

export function getLatestCompletedTemplateEntry(
  templateId,
  historyEntries = loadHistory(),
) {
  for (
    let historyIndex = historyEntries.length - 1;
    historyIndex >= 0;
    historyIndex -= 1
  ) {
    const sessionEntry = historyEntries[historyIndex];
    if (sessionEntry?.templateId === templateId) return sessionEntry;
  }
  return null;
}

export function getExerciseProgressSeries(
  exerciseIdOrName,
  isBodyweight = false,
  historyEntries = loadHistory(),
) {
  return historyEntries
    .flatMap((sessionEntry) =>
      (sessionEntry?.entries || [])
        .filter(
          (entry) =>
            entry?.exerciseId === exerciseIdOrName ||
            entry?.exerciseName === exerciseIdOrName,
        )
        .map((exerciseEntry) => {
          const sets = exerciseEntry.sets || [];
          const value = isBodyweight
            ? sets.reduce((sum, set) => sum + (Number.parseInt(set.reps, 10) || 0), 0)
            : Math.max(
                ...sets
                  .map((set) => {
                    const weight = parseWeight(set.weight);
                    const reps = Number.parseInt(set.reps, 10);
                    if (weight === null) return Number.isFinite(reps) ? reps : 0;
                    return reps > 0 ? weight * (1 + reps / 30) : weight;
                  })
                  .filter((point) => Number.isFinite(point) && point > 0),
                0,
              );

          return value > 0
            ? {
                value,
                date: sessionEntry.date,
                timestamp: sessionEntry.timestamp ?? null,
              }
            : null;
        }),
    )
    .filter(Boolean);
}

export function deleteHistoryEntry(sessionIdOrIndex) {
  const history = loadHistory();
  const sessionId =
    typeof sessionIdOrIndex === "number"
      ? history[sessionIdOrIndex]?.id
      : sessionIdOrIndex;
  if (!sessionId) return false;

  const transaction = deleteCompletedSession(sessionId);
  if (!transaction.ok || !transaction.result) {
    runtime.showSyncBar("Could not delete this session.", "error");
    return false;
  }

  lastDeleted = transaction.result;
  historyOffset = Math.min(historyOffset, Math.max(30, history.length - 1));
  renderHistory();
  runtime.renderDayPicker();
  runtime.showSyncBar("History entry deleted.", "success", {
    label: "Undo",
    onClick: undoLastHistoryDeletion,
  });
  return true;
}

export function undoLastHistoryDeletion() {
  if (!lastDeleted) return false;
  const transaction = restoreCompletedSession(lastDeleted.entry, lastDeleted.index);
  if (!transaction.ok || !transaction.result) {
    runtime.showSyncBar("Could not restore that session.", "error");
    return false;
  }

  lastDeleted = null;
  renderHistory();
  runtime.renderDayPicker();
  runtime.showSyncBar("Session restored.", "success");
  return true;
}

export function renderHistory({ resetOffset = false } = {}) {
  if (resetOffset) historyOffset = 30;
  const all = loadHistory();
  const list = document.getElementById("history-list");
  const moreButton = document.getElementById("history-more-btn");
  if (!list || !moreButton) return;

  if (all.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon" aria-hidden="true">◎</div>
        <div class="history-empty-title">No sessions yet</div>
        <div class="history-empty-copy">Finish your first session and your recent training will show up here.</div>
      </div>`;
    moreButton.hidden = true;
    return;
  }

  historyOffset = Math.min(historyOffset, Math.max(30, all.length));
  const visible = all.slice(-historyOffset).reverse();
  list.innerHTML = visible.map(renderHistoryCard).join("");
  moreButton.hidden = all.length <= historyOffset;
}

export function showMoreHistory() {
  historyOffset += 30;
  renderHistory();
}

function renderHistoryCard(sessionEntry) {
  const day = DAYS[sessionEntry.templateId];
  const dayName = day?.name ?? `Day ${sessionEntry.templateId}`;
  const entries = Array.isArray(sessionEntry.entries) ? sessionEntry.entries : [];
  const sessionId = escapeHtml(sessionEntry.id);
  const detailId = `history-detail-${sessionId}`;
  const sessionVolume = entries.reduce(
    (total, entry) =>
      total +
      (entry.sets || []).reduce(
        (sum, set) =>
          sum + (parseWeight(set.weight) ?? 0) * (Number.parseInt(set.reps, 10) || 0),
        0,
      ),
    0,
  );
  const prEntries = entries.filter((entry) => Object.keys(entry.prs || {}).length > 0);
  const prLine =
    prEntries.length > 0
      ? `<div class="history-card-prs">✦ PRs: ${prEntries.map((entry) => escapeHtml(entry.exerciseName)).join(", ")}</div>`
      : "";
  const volumeStat =
    sessionVolume > 0 ? ` · ${sessionVolume.toLocaleString()}kg vol` : "";
  const detail = entries.map(renderHistoryExercise).join("");

  return `
    <article class="history-card fadein" data-history-id="${sessionId}">
      <div class="history-card-meta">${escapeHtml(sessionEntry.date)} · ${Number(sessionEntry.durationMinutes) || 0} min</div>
      <div class="history-card-day">${escapeHtml(dayName)}</div>
      <div class="history-card-stats">${entries.length} exercises · ${Number(sessionEntry.totalSets) || 0} sets${volumeStat}</div>
      ${prLine}
      <button
        class="history-expand-hint"
        type="button"
        aria-expanded="false"
        aria-controls="${detailId}"
      >Details</button>
      <div class="history-card-detail" id="${detailId}">
        ${detail}
        <button class="history-delete-btn" type="button" data-history-delete="${sessionId}">Delete session</button>
      </div>
    </article>`;
}

function renderHistoryExercise(entry) {
  const sets = Array.isArray(entry.sets) ? entry.sets : [];
  const exerciseVolume = sets.reduce(
    (sum, set) =>
      sum + (parseWeight(set.weight) ?? 0) * (Number.parseInt(set.reps, 10) || 0),
    0,
  );
  const hasPR = Object.keys(entry.prs || {}).length > 0;
  const chips = sets
    .map(
      (set, index) =>
        `<span class="history-set-chip">${index + 1}: ${escapeHtml(formatWeightLabel(set.weight))} × ${escapeHtml(set.reps)}</span>`,
    )
    .join("");
  const volumeLine =
    exerciseVolume > 0
      ? `<div class="history-entry-vol">${exerciseVolume.toLocaleString()}kg vol${hasPR ? '<span class="history-pr-tag">✦ PR</span>' : ""}</div>`
      : hasPR
        ? '<div class="history-entry-vol"><span class="history-pr-tag">✦ PR</span></div>'
        : "";

  return `
    <div class="history-entry">
      <div class="history-entry-header">
        <span class="history-entry-name">${escapeHtml(entry.exerciseName)}</span>
        <span class="history-entry-cat">${escapeHtml(entry.categoryLabel)}</span>
      </div>
      <div class="history-entry-sets">${chips}</div>
      ${volumeLine}
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
