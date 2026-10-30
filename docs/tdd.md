# TDD

Desenho do Pixeluz e as costuras onde um teste observa comportamento. Vocabulário em `GLOSSARY.md`. O loop red-green está na skill `tdd`.

## Forma

Vite, TypeScript strict, Bootstrap 5, Vitest. Sem segundo modelo de sprite.

- `src/domain/` tipos, buffers e regras, sem DOM
- `src/commands/` `Command` e `History`
- `src/render/` composite, raster e viewport
- `src/tools/` uma ferramenta por classe
- `src/io/` projeto, PNG, GIF, sprite sheet, vídeo e `.aseprite`
- `src/storage/` IndexedDB
- `src/input/` atalhos
- `src/ui/` shell Bootstrap e textos
- `src/app/` `EditorSession` e `Controller`

O que ficou de fora está em `ROADMAP.md`.

## Invariantes

- Mutação de pixel, quadro, camada ou paleta passa por `Command`.
- A seleção e o resto do estado de vista ficam fora do PNG e do JSON.
- A arte no canvas continua pixelada. A interface é Bootstrap, não um tema de pixel.
- A implementação é original. Não copiar código, assets ou temas do Aseprite ou do LibreSprite, e não decompilar o binário do Aseprite.
- Limites vividos no código: sprite 1–256, zoom 1–64, paleta 256, camadas 32, pincel 32, history 200.

## Costuras

Teste na interface pública da costura. Um teste novo numa costura que não está aqui pede acordo antes de ser escrito, e esta lista é atualizada no mesmo ciclo.

| Costura | Interface | O teste pega | O teste não pega |
| --- | --- | --- | --- |
| Buffer | `getPixel` / `setPixel` | leitura e escrita de um pixel | composite |
| History | `History` undo/redo | reversão de um `Command` | atalho de teclado |
| Raster | funções de `src/render/raster.ts` | traço gravado no buffer | evento de ponteiro |
| Composite | `compositeFrame` | ordem das camadas, referência e tile | PNG exportado |
| Projeto | `serializeProject` / `deserializeProject` | ida e volta do sprite | IndexedDB |
| Arquivo | leitores e escritores em `src/io/` | bytes de PNG, GIF, JPEG, ASE, paleta e a preparação do vídeo (escala, fundo opaco, tamanho par) | diálogo do sistema e o codec |
| Paleta | `parsePaletteFile`, `paletteToHex`, `lospecSlug` | `.hex`, `.gpl`, JSON do Lospec | rede |
| Zoom | `zoomFromPinch`, `consumeWheelPinch` | um nível por gesto e a folga no limite | evento `wheel` do browser |
| Painel | `clampPanelLayout`, `timelineLimit`, `panelSnapTarget`, `optionGroupsFor` | teto, recolhimento e opções da ferramenta ativa | arraste real |
| Atalho | `matchShortcut` | acorde para ação, inclusive copiar e colar | foco do input |
| Idioma | `preferredLocale` | escolha salva, português e espanhol do navegador, inglês nos demais | `navigator` real |
| Sessão | `EditorSession` | grade, tile, texto, RotSprite, copiar e colar a seleção, undo | layout Bootstrap |
| Interface | o app no browser | o fluxo que o usuário vê | lógica já coberta acima |

`npm test` roda as costuras automatizadas. Mudança de UI, layout, rota ou dado renderizado também se confirma no browser, no fluxo afetado.

## Loop

Uma costura, um teste vermelho, o mínimo de código para ficar verde. O refactor fica para a revisão, na skill `code-review`.
