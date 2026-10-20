import {
  clearStoredState,
  exportStoredState,
  replaceStoredState,
  STATE_SCHEMA_VERSION,
} from "../lib/storage.js";

let runtime = {
  showStatus: () => {},
};

export function initDataPortability(deps = {}) {
  runtime = { ...runtime, ...deps };
}

export function exportWorkoutData() {
  const state = exportStoredState();
  const blob = new Blob([`${JSON.stringify(state, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `grind-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  runtime.showStatus("Workout backup exported.", "success");
}

export async function importWorkoutData(file) {
  if (!(file instanceof File)) return false;

  try {
    const parsed = JSON.parse(await file.text());
    if (
      parsed?.schemaVersion !== STATE_SCHEMA_VERSION ||
      !parsed?.records ||
      typeof parsed.records !== "object" ||
      Array.isArray(parsed.records)
    ) {
      throw new Error("Unsupported Grind backup format.");
    }
    if (!replaceStoredState(parsed)) {
      throw new Error("The backup could not be saved.");
    }
    runtime.showStatus("Backup imported. Reloading…", "success");
    window.setTimeout(() => window.location.reload(), 300);
    return true;
  } catch (error) {
    runtime.showStatus(error?.message ?? "Could not import that backup.", "error");
    return false;
  }
}

export function resetWorkoutData() {
  const cleared = clearStoredState();
  runtime.showStatus(
    cleared ? "Local workout data cleared. Reloading…" : "Could not clear data.",
    cleared ? "success" : "error",
  );
  if (cleared) window.setTimeout(() => window.location.reload(), 300);
  return cleared;
}
