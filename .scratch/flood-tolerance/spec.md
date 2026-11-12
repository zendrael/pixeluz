**Status:** ready-for-agent

## Problem Statement

Balde e varinha só batem RGBA exato. Sem tolerância, preencher ou selecionar arte com anti-alias ou ruído falha.

## Solution

`floodFill` e `floodMask` aceitam tolerância 0–255 (0 = exato). A sessão guarda `floodTolerance`; balde e varinha usam o mesmo valor na barra de opções.

## User Stories

1. As a person filling a near-flat area, I want a tolerance so close colors flood together.
2. As a person using the wand, I want the same tolerance so selection matches the bucket.

## Implementation Decisions

- Compare channel distance with max(|dr|,|dg|,|db|,|da|) ≤ tolerance (or sum — pick max-abs for predictable 0–255).
- UI: number input in options when bucket or wand is active.
- Costura Raster + optionGroupsFor.

## Testing Decisions

- Seam: Raster — flood with tolerance includes neighbor within range; 0 stays exact.
- Do not drive Bootstrap for flood math.

## Out of Scope

- Contiguous vs global fill toggle (always contiguous).
