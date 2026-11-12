**Status:** ready-for-agent

## Problem Statement

A linha do tempo só lista quadros. Quem anima em várias camadas precisa da grade layers × frames do Aseprite.

## Solution

`renderFrames` passa a emitir uma grade: linhas = camadas de conteúdo (topo primeiro), colunas = frames. Clique numa célula ativa frame e layer. Toolbar existente permanece.

## User Stories

1. As a person animating on two layers, I want to click a cel in the grid to jump to that frame and layer.

## Implementation Decisions

- Thumbs use composite of that frame with references, or empty cel marker when no image cel.
- Helper `contentLayers` already exists for paintable/content layers.
- Costura Painel: pure layout helper if extracted; Interface for the grid in browser.

## Testing Decisions

- Seam: Painel — `celGridModel(doc)` returns layer ids × frame ids in display order.
- Click wiring stays in controller (Interface).

## Out of Scope

- Drag-copy cels across the grid.
- Linked-cel badges beyond existing layer panel.
