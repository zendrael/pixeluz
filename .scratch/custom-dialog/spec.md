**Status:** ready-for-agent

## Problem Statement

Confirmações usam `window.confirm`, fora do tema Bootstrap do editor. O app precisa de perguntas e alertas com a mesma cara dos outros modais.

## Solution

Um `#modal-dialog` reutilizável expõe `askConfirm` e `askAlert`. Os cinco `window.confirm` do controller passam por essa API. `#flash` e `beforeunload` não mudam.

## User Stories

1. As a person closing a dirty tab, I want a themed confirm dialog, so that the warning matches the rest of the UI.
2. As a person discarding work to open or create a sprite, I want Cancel and Confirm in the same modal style, so that Esc or backdrop cancel safely.
3. As a maintainer, I want alert and confirm on one API, so that future blocking messages reuse the same shell.

## Implementation Decisions

- Module `src/ui/dialog.ts`; markup in `mountShell`.
- Confirm: Cancel + primary action. Alert: OK only.
- Dismiss (Esc, backdrop, X) resolves confirm as `false`.
- Call sites become `async` and `await askConfirm(...)`.

## Testing Decisions

- Seam: Diálogo (`askConfirm` / `askAlert`).
- Confirm true/false and alert resolve without Playwright.
- Do not assert Bootstrap animation frames.

## Out of Scope

- Replacing `#flash`.
- Customizing `beforeunload`.
