**Status:** ready-for-agent

## Problem Statement

Com caneta, pressão baixa multiplicava a opacidade do pincel e o traço saía quase invisível. A sessão já tem um controle de opacidade; a pressão não deve apagá-lo.

## Solution

`paintSettings` mantém `session.brushOpacity` intacta. `penFactor` escala só o tamanho do pincel. A decisão fica em ADR-0002.

## User Stories

1. As a person drawing with a stylus at light pressure, I want the stroke to keep the brush opacity I set, so that a soft touch does not erase the line.
2. As a person who set brush opacity to 128, I want that value to survive any pen pressure, so that translucency stays intentional.
3. As a person pressing harder, I want the brush size to grow with pressure, so that dynamics still exist on size.

## Implementation Decisions

- Change only opacity in `paintSettings`; keep `brushSize * penFactor`.
- Do not change `penFactor` itself.
- Document in ADR-0002 and the Caneta seam in `docs/tdd.md`.

## Testing Decisions

- Seam: Caneta (`paintSettings`).
- Assert opacity 255 and 128 under low pressure; assert brush size shrinks when pressure is below 1.
- Do not exercise real S-Pen hardware.

## Out of Scope

- Separate size and opacity pressure curves in the UI.
- Mouse or touch pressure.
