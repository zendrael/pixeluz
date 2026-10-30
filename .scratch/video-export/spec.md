**Status:** ready-for-agent

## Problem Statement

A animação exporta como GIF, sequência PNG ou sprite sheet. Quem quer publicar o clipe precisa de um arquivo de vídeo, com os pixels nítidos e a duração de cada quadro.

## Solution

Um item Vídeo no menu de exportar abre um modal com escala inteira (1×, 2×, 4× ou 8×, padrão 4×). Os quadros compostos, sem a camada de referência, são ampliados pixel a pixel, a transparência é composta sobre a cor de fundo do sprite, e o tamanho fica par. O navegador grava MP4 quando consegue (`avc`, depois `av1`, depois `hevc`) e WebM caso contrário (`vp9`, `vp8`, `av1`). O arquivo sai pelo mesmo caminho de salvar do GIF.

## User Stories

1. As a person posting an animation, I want an MP4 when the browser can encode one, so that the file is easy to upload.
2. As a person whose browser cannot encode MP4, I want a WebM instead, so that the export still produces a video.
3. As a person drawing at sprite size, I want an integer scale, so that pixels stay sharp.
4. As a person using transparency, I want those pixels painted over the sprite background, so that the video is opaque.
5. As a person with an odd sprite size, I want the video dimensions even, so that H.264 accepts the file.
6. As a person with different frame durations, I want each frame to keep its duration, so that the clip matches the timeline.

## Implementation Decisions

- Reuse `exportAnimation()`. Do not add a second sprite model or a history command.
- Prepare frames in `prepareVideoFrames` before any codec runs.
- Encode with mediabunny and WebCodecs. Do not set a fixed frame rate.
- Use high quality and in-memory fast start for MP4.
- If no codec is available, show a warning and do not download an empty file.

## Testing Decisions

- The seam is Arquivo. The test checks scale, the opaque background, even padding, and copied durations. It does not check the codec or the save dialog.
- After the UI exists, open the app, export two frames at 4×, and confirm the download starts with an MP4 `ftyp` box or a WebM header.

## Out of Scope

- Audio, transparency in the video, ping-pong from a tag, and a custom background that is not the sprite background.
