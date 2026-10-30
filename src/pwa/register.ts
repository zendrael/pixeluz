import { registerSW } from "virtual:pwa-register";
import { text } from "../ui/i18n";
import { beginUpdate } from "./update";

const HOUR_MS = 60 * 60 * 1000;

let started = false;

export function watchForUpdate(persist: () => Promise<void>): void {
  if (started) return;
  started = true;
  registerSW({
    immediate: true,
    onNeedReload() {
      beginUpdate(persist, showNotice, () => window.location.reload());
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        void registration.update();
      };
      check();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.setInterval(check, HOUR_MS);
    },
  });
}

function showNotice(): void {
  const element = document.querySelector("#flash");
  if (!element) return;
  element.textContent = text.updating;
  element.className = "small text-nowrap text-success";
}
