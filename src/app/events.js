import { closeDialog, openDialog } from "../ui/dialog.js";

export function wireEvents({
  renderHistory,
  showScreen,
  getActiveHomeSession,
  getCompletedDays,
  getWeekKey,
  startSession,
  advanceOnboardingStep,
  renderSlotMachine,
  discardSessionAndGoHome,
  keepSessionAndGoHome,
  startSpinReveal,
  swapWorkoutExercise,
  launchExercise,
  openExitSessionModal,
  dismissKeyboard,
  handleExercisePrimaryAction,
  updateCurrentSetField,
  goHome,
  showMoreHistory,
  deleteHistoryEntry,
  closeExitSessionModal,
  applyAppUpdate,
  closeUpdateAppModal,
  finishOnboarding,
  queueOnboardingRefresh,
  trackOnboardingViewport,
  resumeSession,
  exportWorkoutData,
  importWorkoutData,
  resetWorkoutData,
}) {
  let pendingHistoryDeleteId = null;
  const updateNetworkStatus = () => {
    const status = document.getElementById("network-status");
    if (!status) return;
    status.textContent = navigator.onLine ? "Saved locally" : "Offline · saved locally";
    status.classList.toggle("is-offline", !navigator.onLine);
  };
  updateNetworkStatus();
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  document.getElementById("day-picker-cards").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-day]");
    if (!card) return;
    const activeSession = getActiveHomeSession();
    if (card.classList.contains("completed")) return;
    if (getCompletedDays(getWeekKey()).includes(card.dataset.day)) return;

    if (activeSession) {
      if (activeSession.templateId !== card.dataset.day) return;
      resumeSession();
      return;
    }

    const session = startSession(card.dataset.day);
    if (!session) return;
    advanceOnboardingStep("home_card", "start_button");
    renderSlotMachine();
    showScreen("screen-slot-machine");
  });

  document.getElementById("slot-machine-back").addEventListener("click", (event) => {
    openExitSessionModal(event.currentTarget);
  });

  document
    .getElementById("slot-spin-button")
    .addEventListener("click", startSpinReveal);

  document.getElementById("reels-container").addEventListener("click", (e) => {
    const swapBtn = e.target.closest("[data-workout-swap]");
    if (!swapBtn) return;
    const slotIndex = Number.parseInt(swapBtn.dataset.workoutSwap, 10);
    if (Number.isNaN(slotIndex)) return;
    void swapWorkoutExercise(slotIndex);
  });

  document.getElementById("slot-trigger-status").addEventListener("click", () => {
    advanceOnboardingStep("pull_handle", "start_button");
    launchExercise();
  });

  document.getElementById("exercise-back").addEventListener("click", async (e) => {
    openExitSessionModal(e.currentTarget);
  });

  document.getElementById("sets-container").addEventListener("click", async (e) => {
    const action = e.target.closest('[data-exercise-action="primary"]');
    if (!action) return;
    dismissKeyboard();
    setTimeout(() => {
      void handleExercisePrimaryAction();
    }, 50);
  });

  document.getElementById("sets-container").addEventListener("input", (e) => {
    const input = e.target.closest("[data-field]");
    if (!input) return;
    if (input.dataset.field === "reps") {
      const sanitized = input.value.replace(/[^\d]/g, "");
      if (input.value !== sanitized) input.value = sanitized;
    }
    updateCurrentSetField(
      parseInt(input.dataset.idx, 10),
      input.dataset.field,
      input.value,
    );
  });

  document.getElementById("sets-container").addEventListener("keydown", (e) => {
    const input = e.target.closest("[data-field]");
    if (!input || e.key !== "Enter") return;

    e.preventDefault();
    if (input.dataset.field === "weight") {
      const repsInput = document.getElementById(`reps-${input.dataset.idx}`);
      if (repsInput) repsInput.focus();
      return;
    }

    if (input.dataset.field === "reps") {
      input.blur();
    }
  });

  document.getElementById("done-back-btn").addEventListener("click", goHome);

  document.getElementById("history-btn").addEventListener("click", () => {
    renderHistory({ resetOffset: true });
    showScreen("screen-history");
  });

  document
    .getElementById("export-data-btn")
    .addEventListener("click", exportWorkoutData);
  document
    .getElementById("import-data-input")
    .addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (file) await importWorkoutData(file);
      input.value = "";
    });

  const closeResetDataModal = () => {
    closeDialog(document.getElementById("reset-data-modal"));
  };
  document.getElementById("reset-data-btn").addEventListener("click", (event) => {
    openDialog(document.getElementById("reset-data-modal"), event.currentTarget);
  });
  document
    .getElementById("reset-data-cancel")
    .addEventListener("click", closeResetDataModal);
  document
    .getElementById("reset-data-confirm")
    .addEventListener("click", resetWorkoutData);
  document.getElementById("reset-data-modal").addEventListener("click", (event) => {
    if (event.target.id === "reset-data-modal") closeResetDataModal();
  });

  document.getElementById("history-back").addEventListener("click", async () => {
    showScreen("screen-day-picker");
  });

  document.getElementById("history-more-btn").addEventListener("click", async () => {
    showMoreHistory();
  });

  document.getElementById("history-list").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-history-delete]");
    if (deleteBtn) {
      pendingHistoryDeleteId = deleteBtn.dataset.historyDelete;
      const modal = document.getElementById("delete-history-modal");
      if (modal) {
        openDialog(modal, deleteBtn);
      }
      return;
    }

    const toggle = e.target.closest(".history-expand-hint");
    if (!toggle) return;
    const card = toggle.closest(".history-card");
    if (card) {
      const expanded = card.classList.toggle("expanded");
      toggle.setAttribute("aria-expanded", String(expanded));
    }
  });

  const closeHistoryDeleteModal = () => {
    pendingHistoryDeleteId = null;
    const modal = document.getElementById("delete-history-modal");
    closeDialog(modal);
  };
  document
    .getElementById("delete-history-cancel")
    .addEventListener("click", closeHistoryDeleteModal);
  document.getElementById("delete-history-confirm").addEventListener("click", () => {
    const deleted = pendingHistoryDeleteId
      ? deleteHistoryEntry(pendingHistoryDeleteId)
      : false;
    closeHistoryDeleteModal();
    if (deleted) document.getElementById("history-title")?.focus();
  });
  document.getElementById("delete-history-modal").addEventListener("click", (event) => {
    if (event.target.id === "delete-history-modal") {
      closeHistoryDeleteModal();
    }
  });

  document
    .getElementById("exit-session-cancel")
    .addEventListener("click", closeExitSessionModal);
  document
    .getElementById("exit-session-resume-later")
    .addEventListener("click", keepSessionAndGoHome);
  document
    .getElementById("exit-session-discard")
    .addEventListener("click", discardSessionAndGoHome);
  document.getElementById("exit-session-modal").addEventListener("click", (e) => {
    if (e.target.id === "exit-session-modal") closeExitSessionModal();
  });
  document
    .getElementById("update-app-confirm")
    .addEventListener("click", applyAppUpdate);
  document
    .getElementById("update-app-later")
    .addEventListener("click", closeUpdateAppModal);
  document.getElementById("update-app-modal").addEventListener("click", (e) => {
    if (e.target.id === "update-app-modal") closeUpdateAppModal();
  });
  document
    .getElementById("coachmark-skip")
    .addEventListener("click", () => finishOnboarding("dismissed"));
  window.addEventListener("resize", queueOnboardingRefresh);
  document.addEventListener("scroll", queueOnboardingRefresh, true);
  document.addEventListener("focusin", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      trackOnboardingViewport();
    }
  });
  document.addEventListener("focusout", (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      trackOnboardingViewport();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target?.id === "done-sync" &&
      typeof e.target.onclick === "function"
    ) {
      e.preventDefault();
      e.target.click();
      return;
    }
    if (e.key !== "Escape") return;
    const modal = document.getElementById("exit-session-modal");
    if (modal?.classList.contains("show")) closeExitSessionModal();
    const updateModal = document.getElementById("update-app-modal");
    if (updateModal?.classList.contains("show")) closeUpdateAppModal();
    const deleteModal = document.getElementById("delete-history-modal");
    if (deleteModal?.classList.contains("show")) closeHistoryDeleteModal();
    const resetModal = document.getElementById("reset-data-modal");
    if (resetModal?.classList.contains("show")) closeResetDataModal();
  });
}
