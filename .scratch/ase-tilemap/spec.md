**Status:** ready-for-agent

## Problem Statement

O editor tem layer `tilemap` e tileset no `SpriteDocument`, mas o `.aseprite` pula cels de tilemap e lê `tilesets: []`. Abrir ou salvar um tilemap em ASE perde os índices e as imagens dos tiles.

## Solution

`writeAse` grava chunks de tileset (0x2023) e cels tipo 3 (tilemap comprimido). `readAse` reconstrói `tilesets`, liga `layer.tilesetId` e restaura `cel.tiles`. Índice 0 continua vazio (flag 4).

## User Stories

1. As a person exporting a tilemap, I want the `.aseprite` file to keep tile size, tile pixels and cell indices, so that another tool or a reload sees the same map.
2. As a person opening that file again in Pixeluz, I want the same tileset and indices, so that roundtrip does not flatten the map to an image layer.
3. As a person with an ordinary image layer, I want existing ASE roundtrips to keep working, so that this change does not break groups and tags.

## Implementation Decisions

- Extend `src/io/ase.ts` only; keep one `SpriteDocument`.
- Tileset image is RGBA stacked vertically, zlib-compressed, flags `2|4`.
- Tile IDs are 32-bit with mask `0x1fffffff`; flips stay zero.
- Do not implement external tilesets or diagonal flips.

## Testing Decisions

- Seam: Arquivo (`writeAse` / `readAse`).
- Build a small sprite with one tileset and one tilemap cel, roundtrip, assert tile size, a painted tile pixel, and the index grid.
- Keep the existing group/tag ASE test green.

## Out of Scope

- Writing tile flips.
- External tileset links.
- Converting a tilemap to a flattened image layer on export.
