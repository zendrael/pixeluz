/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { askAlert, askConfirm, bindDialog, resetDialogForTests } from "./dialog";

function mountFixture(): HTMLElement {
  document.body.innerHTML = `
    <div id="modal-dialog" class="modal">
      <h2 id="dialog-title"></h2>
      <p id="dialog-message"></p>
      <button type="button" data-dialog="cancel">Cancel</button>
      <button type="button" data-dialog="confirm">Confirm</button>
      <button type="button" data-dialog="ok">OK</button>
      <button type="button" data-dialog="close">X</button>
    </div>
  `;
  const root = document.querySelector<HTMLElement>("#modal-dialog");
  if (!root) throw new Error("fixture ausente");
  bindDialog(document, (element) => ({
    show() {
      element.classList.add("show");
    },
    hide() {
      element.classList.remove("show");
      element.dispatchEvent(new Event("hidden.bs.modal"));
    },
  }));
  return root;
}

afterEach(() => {
  resetDialogForTests();
  document.body.innerHTML = "";
});

describe("diálogo", () => {
  it("confirma e cancela a pergunta", async () => {
    const root = mountFixture();
    const yes = askConfirm("Descartar?");
    expect(root.querySelector("#dialog-message")?.textContent).toBe("Descartar?");
    expect((root.querySelector("[data-dialog='confirm']") as HTMLButtonElement).hidden).toBe(false);
    expect((root.querySelector("[data-dialog='ok']") as HTMLButtonElement).hidden).toBe(true);
    root.querySelector<HTMLButtonElement>("[data-dialog='confirm']")?.click();
    await expect(yes).resolves.toBe(true);

    const no = askConfirm("Descartar?");
    root.querySelector<HTMLButtonElement>("[data-dialog='cancel']")?.click();
    await expect(no).resolves.toBe(false);
  });

  it("resolve o alerta no OK", async () => {
    const root = mountFixture();
    const done = askAlert("Pronto");
    expect((root.querySelector("[data-dialog='ok']") as HTMLButtonElement).hidden).toBe(false);
    expect((root.querySelector("[data-dialog='confirm']") as HTMLButtonElement).hidden).toBe(true);
    root.querySelector<HTMLButtonElement>("[data-dialog='ok']")?.click();
    await expect(done).resolves.toBeUndefined();
  });
});
