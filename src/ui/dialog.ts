import { Modal } from "bootstrap";
import { text } from "./i18n";

export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type AlertOptions = {
  title?: string;
  okLabel?: string;
};

type ModalControls = {
  show(): void;
  hide(): void;
};

type DialogElements = {
  root: HTMLElement;
  title: HTMLElement;
  message: HTMLElement;
  confirmBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  okBtn: HTMLButtonElement;
};

type Pending =
  | { kind: "confirm"; resolve: (value: boolean) => void }
  | { kind: "alert"; resolve: () => void };

let elements: DialogElements | null = null;
let controls: ModalControls | null = null;
let pending: Pending | null = null;
let decided = false;

export function bindDialog(
  root: ParentNode = document,
  createModal: (element: HTMLElement) => ModalControls = defaultModal,
): void {
  const modal = required(root, "#modal-dialog");
  elements = {
    root: modal,
    title: required(root, "#dialog-title"),
    message: required(root, "#dialog-message"),
    confirmBtn: required(root, "[data-dialog='confirm']") as HTMLButtonElement,
    cancelBtn: required(root, "[data-dialog='cancel']") as HTMLButtonElement,
    okBtn: required(root, "[data-dialog='ok']") as HTMLButtonElement,
  };
  controls = createModal(modal);
  modal.addEventListener("click", onClick);
  modal.addEventListener("hidden.bs.modal", onHidden);
}

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    open("confirm", message, {
      title: options.title ?? text.dialogTitle,
      confirmLabel: options.confirmLabel ?? text.dialogConfirm,
      cancelLabel: options.cancelLabel ?? text.cancel,
      okLabel: text.dialogOk,
    });
    pending = { kind: "confirm", resolve };
  });
}

export function askAlert(message: string, options: AlertOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    open("alert", message, {
      title: options.title ?? text.dialogTitle,
      confirmLabel: text.dialogConfirm,
      cancelLabel: text.cancel,
      okLabel: options.okLabel ?? text.dialogOk,
    });
    pending = { kind: "alert", resolve };
  });
}

/** Resets module state between tests. */
export function resetDialogForTests(): void {
  if (elements) {
    elements.root.removeEventListener("click", onClick);
    elements.root.removeEventListener("hidden.bs.modal", onHidden);
  }
  elements = null;
  controls = null;
  pending = null;
  decided = false;
}

function open(
  mode: "confirm" | "alert",
  message: string,
  labels: { title: string; confirmLabel: string; cancelLabel: string; okLabel: string },
): void {
  if (!elements || !controls) throw new Error("Diálogo não vinculado");
  if (pending) throw new Error("Diálogo já aberto");
  decided = false;
  elements.title.textContent = labels.title;
  elements.message.textContent = message;
  elements.confirmBtn.textContent = labels.confirmLabel;
  elements.cancelBtn.textContent = labels.cancelLabel;
  elements.okBtn.textContent = labels.okLabel;
  elements.confirmBtn.hidden = mode !== "confirm";
  elements.cancelBtn.hidden = mode !== "confirm";
  elements.okBtn.hidden = mode !== "alert";
  controls.show();
}

function onClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const action = target.closest<HTMLElement>("[data-dialog]")?.dataset.dialog;
  if (!action || !controls) return;
  if (action === "confirm") finish(true);
  else if (action === "ok") finish(true);
  else if (action === "cancel" || action === "close") finish(false);
}

function onHidden(): void {
  if (pending && !decided) {
    finish(false, false);
    return;
  }
  pending = null;
  decided = false;
}

function finish(accepted: boolean, hide = true): void {
  if (!pending || decided) return;
  decided = true;
  const current = pending;
  pending = null;
  if (hide) controls?.hide();
  if (current.kind === "confirm") current.resolve(accepted);
  else current.resolve();
}

function defaultModal(element: HTMLElement): ModalControls {
  const modal = Modal.getOrCreateInstance(element);
  return {
    show: () => modal.show(),
    hide: () => modal.hide(),
  };
}

function required(root: ParentNode, selector: string): HTMLElement {
  const node = root.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Elemento ${selector} ausente`);
  return node;
}
