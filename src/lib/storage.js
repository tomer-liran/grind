// @ts-check

export const STATE_STORAGE_KEY = "grind:state";
export const STATE_SCHEMA_VERSION = 1;

let memoryEnvelope = null;

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isManagedKey(key) {
  return key.startsWith("grind:") && key !== STATE_STORAGE_KEY;
}

function createEnvelope(records = {}, migration = null) {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    records,
    ...(migration ? { migration } : {}),
  };
}

function normalizeEnvelope(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.records ||
    typeof value.records !== "object" ||
    Array.isArray(value.records)
  ) {
    return null;
  }

  return createEnvelope(value.records, value.migration ?? null);
}

function readLegacyRecords() {
  const records = {};
  const importedKeys = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !isManagedKey(key)) continue;

      const raw = localStorage.getItem(key);
      if (raw === null) continue;

      try {
        records[key] = JSON.parse(raw);
        importedKeys.push(key);
      } catch {
        // Preserve malformed legacy values in localStorage for manual recovery.
      }
    }
  } catch {
    return { records, importedKeys };
  }

  return { records, importedKeys };
}

function persistEnvelope(envelope) {
  const nextEnvelope = {
    ...envelope,
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(nextEnvelope));
    memoryEnvelope = clone(nextEnvelope);
    window.dispatchEvent(
      new CustomEvent("grind:storage-committed", {
        detail: { updatedAt: nextEnvelope.updatedAt },
      }),
    );
    return true;
  } catch (error) {
    memoryEnvelope = clone(nextEnvelope);
    console.warn(
      "[GRIND] localStorage write failed:",
      STATE_STORAGE_KEY,
      error?.name ?? "UnknownError",
    );
    window.dispatchEvent(
      new CustomEvent("grind:storage-error", {
        detail: { error, key: STATE_STORAGE_KEY },
      }),
    );
    return false;
  }
}

function loadEnvelope() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (raw !== null) {
      const parsed = normalizeEnvelope(JSON.parse(raw));
      if (parsed) {
        memoryEnvelope = clone(parsed);
        return parsed;
      }
    }
  } catch {
    // Fall through to the in-memory copy or legacy migration.
  }

  if (memoryEnvelope) return clone(memoryEnvelope);

  const { records, importedKeys } = readLegacyRecords();
  const envelope = createEnvelope(records, {
    importedAt: new Date().toISOString(),
    legacyKeys: importedKeys,
  });
  persistEnvelope(envelope);
  return envelope;
}

export function storageGet(key, fallback = null) {
  if (!isManagedKey(key)) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  const envelope = loadEnvelope();
  return key in envelope.records ? clone(envelope.records[key]) : clone(fallback);
}

export function storageSet(key, value) {
  if (!isManagedKey(key)) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(
        "[GRIND] localStorage write failed:",
        key,
        error?.name ?? "UnknownError",
      );
      return false;
    }
  }

  const envelope = loadEnvelope();
  envelope.records[key] = clone(value);
  return persistEnvelope(envelope);
}

export function storageDel(key) {
  if (!isManagedKey(key)) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  const envelope = loadEnvelope();
  delete envelope.records[key];
  return persistEnvelope(envelope);
}

export function storageTransaction(mutator) {
  const envelope = loadEnvelope();
  const records = clone(envelope.records);

  try {
    const result = mutator(records);
    const ok = persistEnvelope({ ...envelope, records });
    return { ok, result };
  } catch (error) {
    console.warn("[GRIND] storage transaction aborted:", error);
    return { ok: false, error };
  }
}

export function exportStoredState() {
  return clone(loadEnvelope());
}

export function replaceStoredState(envelope) {
  const normalized = normalizeEnvelope(envelope);
  if (!normalized) return false;
  return persistEnvelope(normalized);
}

export function getStorageKeys(prefix = "") {
  return Object.keys(loadEnvelope().records).filter((key) => key.startsWith(prefix));
}

export function clearStoredState() {
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("grind:")) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    memoryEnvelope = null;
    return true;
  } catch (error) {
    console.warn("[GRIND] could not clear local data:", error);
    return false;
  }
}

export function resetStorageCacheForTests() {
  memoryEnvelope = null;
}
