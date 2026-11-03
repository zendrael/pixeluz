**Status:** ready-for-agent

## Problem Statement

A exportação de vídeo sempre usa todos os quadros. Quem tem uma tag ativa no playback espera o mesmo recorte no clipe.

## Solution

`exportAnimation` para vídeo usa `playbackBounds` do quadro ativo: se há tag, exporta só `from..to` (em ordem inversa se a tag for `reverse`). Sem tag, exporta todos os quadros. Ping-pong não se expande na timeline do arquivo.

## User Stories

1. As a person with a tag around walk frames, I want the video to use only that range when the playhead is inside the tag, so that the clip matches what I preview.
2. As a person with a reverse tag, I want the exported frames in reverse order, so that the clip matches reverse playback.
3. As a person with no tag on the current frame, I want every frame in the video, so that ordinary exports stay whole-sprite.

## Implementation Decisions

- Reuse `playbackBounds`; do not invent a second tag picker in the modal.
- Only the video export path respects the tag; GIF/sheet keep all frames unless changed later.
- Do not expand ping-pong into a longer frame list.

## Testing Decisions

- Seam: Arquivo / Sessão (`exportAnimation` with tag bounds).
- Three frames, tag on 1..2 forward and reverse; assert prepared durations and count.
- No codec.

## Out of Scope

- UI checkbox to ignore the tag.
- Expanding ping-pong into repeated frames.
- Changing GIF export.
