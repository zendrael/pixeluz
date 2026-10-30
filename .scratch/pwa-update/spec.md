**Status:** ready-for-agent

## Problem Statement

O build registra o service worker, mas a página que já está aberta não percebe uma versão nova. Quem entra pelo navegador, sem instalar o app, também fica na versão antiga até recarregar à mão.

## Solution

Em toda visita, instalado ou não, o app pede ao service worker que procure uma atualização. Se o worker novo assumir, a interface avisa que a página vai recarregar, grava o desenho sujo e recarrega uma vez. A mesma checagem acontece quando a aba volta a ficar visível e de hora em hora enquanto a página está aberta.

## User Stories

1. As a visitor in a normal browser tab, I want the app to look for a new version when I open it, so that I am not stuck on the previous deploy.
2. As a person who installed the PWA, I want the same check, so that opening the icon also picks up a new version.
3. As a person with the app already open, I want a check when I return to the tab and about once an hour, so that a long session still updates.
4. As a person drawing, I want a short notice before the reload, so that I know the page is updating on purpose.
5. As a person with unsaved strokes, I want those strokes written before the reload, so that the update does not drop the picture.
6. As a person on the current version, I want no notice and no reload, so that an ordinary visit stays put.

## Implementation Decisions

- Keep `registerType: "autoUpdate"` so the new worker takes control immediately.
- Set `injectRegister` to `null` and call `registerSW` once from `src/main.ts`, outside the controller, so a locale rebuild does not register again.
- `beginUpdate` notifies, persists, and reloads once. A second call in the same page load does nothing.
- Do not branch on `display-mode`. The browser tab and the installed app share this path.
- The notice is the existing `#flash` line, in pt-BR, en, and es.

## Testing Decisions

- The seam is Atualização. The test checks the notice, the save, and a single reload. It does not start a service worker or hit the network.
- A production preview confirms that a normal tab becomes controlled by the service worker. A second deploy is not part of that check.

## Out of Scope

- A button that lets the person postpone the update.
- Updating while `npm run dev` is running. The worker belongs to the production build.
