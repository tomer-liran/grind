import { DEFAULT_CONFIG } from "../config.js";
import { storageGet, storageSet } from "../lib/storage.js";
import { formatWeightLabel, parseWeight } from "./prs.js";

const QUEUE_KEY = "grind:sync-queue";
const MAX_QUEUE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 10_000;

let runtime = {
  getSession: () => null,
};

export function initSync(deps = {}) {
  runtime = { ...runtime, ...deps };
}

function syncEnabled() {
  return Boolean(
    !DEFAULT_CONFIG.dryRun &&
    DEFAULT_CONFIG.webhookUrl &&
    !DEFAULT_CONFIG.webhookUrl.includes("YOUR_N8N"),
  );
}

export function showSyncBar(message, type = "", action = null) {
  const bar = document.getElementById("sync-bar");
  if (!bar) return;

  bar.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  bar.append(text);

  if (action?.label && typeof action.onClick === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sync-bar-action";
    button.textContent = action.label;
    button.addEventListener(
      "click",
      () => {
        action.onClick();
        bar.classList.remove("show");
      },
      { once: true },
    );
    bar.append(button);
  }

  bar.className = `sync-bar show ${type}`.trim();
  window.clearTimeout(showSyncBar.timer);
  showSyncBar.timer = window.setTimeout(
    () => bar.classList.remove("show"),
    action ? 8_000 : 4_000,
  );
}

export function buildSyncPayload(duration, totalSets) {
  const session = runtime.getSession();
  return {
    session_id: session.id,
    date: new Date().toLocaleDateString("en-GB"),
    day: session.templateId,
    duration_minutes: duration,
    total_sets: totalSets,
    exercises: session.entries.map((entry) => ({
      exercise_id: entry.exerciseId,
      exercise: entry.exerciseName,
      category: entry.categoryLabel,
      sets: entry.sets
        .map(
          (set, index) =>
            `Set ${index + 1}: ${formatWeightLabel(set.weight)} × ${set.reps}`,
        )
        .join(" | "),
      session_volume_kg: entry.sets.reduce(
        (sum, set) =>
          sum + (parseWeight(set.weight) ?? 0) * (Number.parseInt(set.reps, 10) || 0),
        0,
      ),
      pr_weight: Boolean(entry.prs?.weight),
      pr_volume: Boolean(entry.prs?.volume),
      timestamp: entry.timestamp,
    })),
  };
}

function loadQueue() {
  const queue = storageGet(QUEUE_KEY, []);
  return Array.isArray(queue) ? queue : [];
}

function saveQueue(queue) {
  return storageSet(QUEUE_KEY, queue.slice(-MAX_QUEUE_SIZE));
}

export function enqueueSyncPayload(payload) {
  if (!payload?.session_id) return false;
  const queue = loadQueue();
  if (queue.some((item) => item.id === payload.session_id)) return true;

  queue.push({
    id: payload.session_id,
    payload,
    attempts: 0,
    failedAt: null,
    nextAttemptAt: Date.now(),
  });
  return saveQueue(queue);
}

async function postPayload(item) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_CONFIG.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": item.id,
      },
      body: JSON.stringify(item.payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function deliverQueueItem(sessionId) {
  const queue = loadQueue();
  const item = queue.find((candidate) => candidate.id === sessionId);
  if (!item) return true;

  try {
    await postPayload(item);
    saveQueue(queue.filter((candidate) => candidate.id !== sessionId));
    return true;
  } catch (error) {
    item.attempts = (item.attempts || 0) + 1;
    item.failedAt = new Date().toISOString();
    item.nextAttemptAt = Date.now() + Math.min(60 * 60_000, 2 ** item.attempts * 5_000);
    saveQueue(queue);
    console.warn("[GRIND] sync failed:", error?.message ?? error);
    return false;
  }
}

function setDoneSyncState(message, className, retry = null) {
  const syncElement = document.getElementById("done-sync");
  if (!syncElement) return;
  syncElement.textContent = message;
  syncElement.className = `done-sync ${className}`.trim();
  syncElement.onclick = null;
  syncElement.removeAttribute("role");
  syncElement.removeAttribute("tabindex");

  if (retry) {
    syncElement.setAttribute("role", "button");
    syncElement.setAttribute("tabindex", "0");
    syncElement.onclick = retry;
  }
}

export async function syncToSheets(payload) {
  if (!syncEnabled()) {
    setDoneSyncState("Saved on this device", "success");
    return true;
  }

  enqueueSyncPayload(payload);
  setDoneSyncState("Syncing…", "syncing");
  const delivered = await deliverQueueItem(payload.session_id);
  if (delivered) {
    setDoneSyncState("Synced", "success");
    return true;
  }

  const retry = async () => {
    setDoneSyncState("Retrying…", "syncing");
    const succeeded = await deliverQueueItem(payload.session_id);
    setDoneSyncState(
      succeeded ? "Synced" : "Sync failed — tap to retry",
      succeeded ? "success" : "error",
      succeeded ? null : retry,
    );
  };
  setDoneSyncState("Sync failed — tap to retry", "error", retry);
  return false;
}

export async function flushSyncQueue() {
  if (!syncEnabled() || !navigator.onLine) return;
  const now = Date.now();
  const due = loadQueue().filter(
    (item) => !item.nextAttemptAt || item.nextAttemptAt <= now,
  );

  for (const item of due) {
    const delivered = await deliverQueueItem(item.id);
    if (delivered) {
      showSyncBar("A queued workout was synced.", "success");
    }
  }
}
