import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap";
import "./styles.css";
import { Controller, type ControllerBoot } from "./app/controller";
import { EditorSession } from "./app/session";
import type { LoadedProject } from "./io/project-json";
import { loadRecovery } from "./storage/db";
import { applyLocale, readLocale, type Locale } from "./ui/i18n";
import { watchForUpdate } from "./pwa/register";
import { mountShell } from "./ui/shell";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Elemento #app ausente");

let current: Controller | null = null;

function sessionFromProject(project: LoadedProject): EditorSession {
  const session = new EditorSession(project.sprite);
  session.foreground = { ...project.foreground };
  session.background = { ...project.background };
  session.dirty = false;
  return session;
}

function mount(boot?: ControllerBoot): void {
  current?.dispose();
  mountShell(root!);
  current = new Controller(root!, {
    rebuild(locale: Locale, reopen) {
      applyLocale(locale);
      const taken = current?.handoff();
      const boot: ControllerBoot = {};
      if (taken) {
        boot.sessions = taken.sessions;
        boot.activeIndex = taken.activeIndex;
        boot.toolId = taken.toolId;
      }
      if (reopen) boot.reopen = reopen;
      mount(boot);
    },
  }, boot);
}

applyLocale(readLocale());
watchForUpdate(() => current?.persistForUpdate() ?? Promise.resolve());
void loadRecovery()
  .then((recovered) => {
    if (!recovered) {
      mount();
      return;
    }
    mount({
      sessions: recovered.projects.map(sessionFromProject),
      activeIndex: recovered.activeIndex,
      recovered: true,
    });
  })
  .catch(() => mount());
