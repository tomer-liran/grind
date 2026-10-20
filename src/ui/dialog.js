let activeDialog = null;
let returnFocus = null;

function focusableElements(dialog) {
  return Array.from(
    dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden);
}

function setBackgroundInert(isInert, dialog) {
  Array.from(document.body.children).forEach((element) => {
    if (element === dialog || element.contains(dialog)) return;
    if (isInert) {
      element.dataset.dialogWasAriaHidden = element.getAttribute("aria-hidden") ?? "";
      element.inert = true;
    } else if ("dialogWasAriaHidden" in element.dataset) {
      element.inert = false;
      const previous = element.dataset.dialogWasAriaHidden;
      if (previous) element.setAttribute("aria-hidden", previous);
      else element.removeAttribute("aria-hidden");
      delete element.dataset.dialogWasAriaHidden;
    }
  });
}

function trapFocus(event) {
  if (!activeDialog || event.key !== "Tab") return;
  const focusable = focusableElements(activeDialog);
  if (focusable.length === 0) {
    event.preventDefault();
    activeDialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener("keydown", trapFocus);

export function openDialog(dialog, trigger = document.activeElement) {
  if (!(dialog instanceof HTMLElement)) return;
  if (activeDialog && activeDialog !== dialog) closeDialog(activeDialog, false);

  activeDialog = dialog;
  returnFocus = trigger instanceof HTMLElement ? trigger : null;
  dialog.classList.add("show");
  dialog.setAttribute("aria-hidden", "false");
  setBackgroundInert(true, dialog);

  const initial =
    dialog.querySelector("[data-dialog-initial-focus]") ??
    focusableElements(dialog)[0] ??
    dialog;
  window.requestAnimationFrame(() => initial.focus());
}

export function closeDialog(dialog, restoreFocus = true) {
  if (!(dialog instanceof HTMLElement)) return;
  dialog.classList.remove("show");
  dialog.setAttribute("aria-hidden", "true");
  setBackgroundInert(false, dialog);

  if (activeDialog === dialog) activeDialog = null;
  const target = returnFocus;
  returnFocus = null;
  if (restoreFocus && target?.isConnected) target.focus();
}

export function getActiveDialog() {
  return activeDialog;
}
