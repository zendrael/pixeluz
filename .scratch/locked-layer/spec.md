**Status:** ready-for-agent

## Problem Statement

Camadas têm `locked`, e cola/transform já recusam. A pintura ainda pode gravar pixels numa camada travada se a ferramenta não consultar o mesmo guarda.

## Solution

Qualquer mutação de pixels na camada ativa (pintura, cola, transform, filtros que tocam o cel) recusa quando `layer.locked` é true, sem empilhar `Command`.

## User Stories

1. As a person who locked a layer, I want strokes to leave pixels alone, so that a locked line art layer stays safe.
2. As a person who pastes or transforms a selection on a locked layer, I want nothing to change, so that lock means all edits.
3. As a person who undoes after a refused edit, I want history unchanged, so that a blocked stroke does not create an empty undo step.

## Implementation Decisions

- Centralize the guard on `EditorSession` paths that commit pixels (`beginStroke` / paint commit, `pasteClipboard`, `transformSelection`, and cel filters if they miss the check).
- Do not change the lock toggle UI.

## Testing Decisions

- Seam: Sessão.
- Lock the active layer; attempt paint via session API, paste, and transform; assert pixels and history depth unchanged.
- Do not drive the Bootstrap shell.

## Out of Scope

- Locking groups recursively.
- A flash message when a stroke is refused.
