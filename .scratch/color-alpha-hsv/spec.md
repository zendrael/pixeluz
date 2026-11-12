**Status:** ready-for-agent

## Problem Statement

FG/BG só têm `input type=color` (RGB opaco). Alpha só aparece como rótulo "transparente" no BG limpo. Sem HSV nem slider de alpha.

## Solution

No painel de cores: alpha 0–255 e H/S/V editáveis para FG e BG, sincronizados com o hex e a sessão `Rgba`.

## User Stories

1. As a person painting semi-transparent ink, I want to set FG alpha without clearing the background.
2. As a person matching hues, I want HSV fields that update the color pickers.

## Implementation Decisions

- Domain helpers already have `rgbToHsl` / `hslToRgb`; expose thin wrappers if needed.
- Costura: helpers de cor testados; sync UI na Interface.

## Testing Decisions

- Seam: domain color round-trip H↔RGB; session setForeground with alpha.
- Shell wiring confirmed manually / light unit if pure sync helper exists.

## Out of Scope

- Full spectrum canvas widget.
