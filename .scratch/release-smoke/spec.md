**Status:** ready-for-agent

## Problem Statement

Os testes cobrem o domínio e o arquivo, não o caminho que uma pessoa faz no 1.0: criar um sprite, pintar, desfazer, recarregar, exportar PNG, instalar o app e abrir a página offline. Esse caminho é o que o deploy precisa provar.

## Solution

Um roteiro repetível, contra o build de produção, executa esse caminho no Chrome em desktop e numa viewport de celular. O roteiro falha se o pixel pintado sumir depois do reload, se o PNG não baixar, se a página offline não aparecer sem rede, ou se o console registrar um erro de página.

## User Stories

1. As a new user on desktop, I want to create a sprite, paint one pixel, undo it, and paint it again, so that the editor is usable at release.
2. As a user, I want a reload to show the sprite I just painted, so that autosave is real.
3. As a user, I want Export PNG to download a file whose first pixel matches the painted color, so that the release export works.
4. As a phone user, I want the same paint-and-reload path in a narrow viewport, so that the mobile sheets are not a blank release.
5. As a user who installed the app, I want the offline page when the network is gone, so that the PWA shell survives a failed navigation.
6. As a maintainer, I want the roteiro to fail on an uncaught page error, so that a silent exception does not count as a pass.

## Implementation Decisions

- Run against the production build, after the static-deploy spec has a way to serve it.
- Desktop viewport is wide enough for the side panel. The phone viewport is under the Bootstrap `lg` breakpoint so the bottom sheets are the panels.
- Paint through the canvas with a pointer event. Assert the sprite pixel and, after reload, the same pixel. Do not assert private controller fields.
- The offline check requests the documented offline page with the network disabled after the app has loaded once.
- Keep the roteiro as a script that can be re-run. A prose checklist alone does not satisfy this spec.

## Testing Decisions

- This is the browser seam named in `docs/tdd.md`. It does not replace Vitest.
- Assert observable outcomes: pixel color, download bytes or filename, offline document visible, empty page-error list.
- Do not screenshot-compare the whole UI.

## Out of Scope

- Every tool, every blend mode, and every export format. GIF, ASE, and the sprite sheet stay on their existing seams.
- Visual polish, animation timing, and new features.
- App stores.

## Further Notes

IndexedDB in the roteiro must be a clean profile, so a previous dev database cannot fake the reload check.
