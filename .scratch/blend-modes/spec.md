**Status:** ready-for-agent

## Problem Statement

O composite aplica todos os `BlendMode`, mas o teste só cobre `multiply`. Um modo quebrado passa despercebido.

## Solution

Um teste parametrizado na costura Composite compõe azul opaco sobre vermelho opaco para cada modo e compara com RGB literais calculados pelas fórmulas documentadas.

## User Stories

1. As a person picking a blend mode, I want each named mode to tint the stack correctly, so that the control matches the composite.
2. As a maintainer, I want one table covering every `BlendMode`, so that a missing case fails the suite.

## Implementation Decisions

- Observe `compositeFrame` / `readPixel`, not `blendRgb` alone.
- Use opaque 1×1 layers; expected values are hand-worked literals, not recomputed from `blendRgb`.
- Include at least one HSL mode (`hue`) in the same table.

## Testing Decisions

- Seam: Composite.
- One `it.each` over all modes in `BlendMode`.
- No golden PNG files.

## Out of Scope

- Semi-transparent blend accuracy.
- New blend modes.
