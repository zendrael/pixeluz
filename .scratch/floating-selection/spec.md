**Status:** ready-for-agent

## Problem Statement

Cut, move e paste carimbam o cel de imediato. Quem vem do Aseprite espera uma seleção flutuante: pixels levantados, movidos sem buraco sob o cursor até confirmar.

## Solution

A `EditorSession` guarda `floating: { image, mask, x, y } | null` (estado de vista). Lift tira pixels do cel; stamp devolve. Paste cria float sem carimbar.

## User Stories

1. As a person who cuts a selection, I want the pixels to float so I can move them before they settle.
2. As a person who pastes, I want a floating paste I can nudge, so stacked pastes are not baked until I confirm.
3. As a person who presses Enter or deselects, I want the float stamped onto the active cel in one undo step.

## Implementation Decisions

- Float stays out of PNG/JSON; same shape as the selection clipboard.
- Cut = copy to clipboard + lift (clear source, set floating).
- Paste = place clipboard into floating at paste origin (nudge/center rules unchanged).
- Move without Alt lifts then drags the float; Alt lifts a duplicate (source kept).
- Stamp on Enter, clearSelection, new setSelection, and paint strokes (`beginStroke`).
- Transform while floating edits the cropped float buffer.

## Testing Decisions

- Seam: Sessão.
- Lift/cut leaves hole + floating; stamp restores pixels; paste does not touch cel until stamp; undo stamp only.
- Do not drive Bootstrap.

## Out of Scope

- OS clipboard.
- Putting the mask itself on the History stack.
- Free transform handles.
