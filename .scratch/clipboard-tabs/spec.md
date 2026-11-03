**Status:** ready-for-agent

## Problem Statement

Cada `EditorSession` guarda o próprio clipboard. Copiar a seleção numa aba e colar noutra não leva os pixels, embora o atalho e o botão sejam os mesmos.

## Solution

O clipboard da seleção passa a ser compartilhado entre sessões (estado de vista global da app). Copiar numa aba e colar noutra aplica os mesmos pixels e máscara. O clipboard continua fora do PNG e do JSON.

## User Stories

1. As a person with two sprites open, I want to copy a selection in one tab and paste it in the other, so that I can reuse art across documents.
2. As a person who undoes after paste, I want only the paste in the target tab to reverse, so that the source tab stays intact.
3. As a person saving the project, I want the clipboard excluded from JSON, so that downloads stay document-only.

## Implementation Decisions

- Keep `copySelection` / `pasteClipboard` on `EditorSession`.
- Store the payload in a shared module used by every session.
- Clone image and mask on copy so later edits do not mutate the clipboard.
- Do not put clipboard into `serializeProject`.

## Testing Decisions

- Seam: Sessão.
- Copy in session A, paste in session B, assert pixel and undo on B only.
- Do not open the Bootstrap shell.

## Out of Scope

- System clipboard / OS paste of images.
- Pasting into a tilemap layer.
