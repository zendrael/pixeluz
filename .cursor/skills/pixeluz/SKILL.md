---
name: pixeluz
description: >-
  Convenções do editor Pixeluz (pixel art e animação no navegador). Use ao
  editar domínio, comandos, ferramentas, render, armazenamento, PWA ou a UI
  Bootstrap deste repositório.
---

# Pixeluz

Editor web original. A referência de comportamento é a documentação pública do Aseprite e do LibreSprite. Não copiar código, assets ou temas desses projetos, e não decompilar o binário do Aseprite. Não instalar o REA para este repositório.

Vocabulário em [GLOSSARY.md](../../../GLOSSARY.md). Desenho e costuras de teste em [docs/tdd.md](../../../docs/tdd.md).

A interface é Bootstrap 5, responsiva, com tema escuro. O idioma padrão é inglês. Sem escolha salva, o navegador em português usa pt-BR e o em espanhol usa es; os demais ficam em inglês. A escolha salva na interface permanece. Só o canvas do sprite usa `image-rendering: pixelated`. O fundo ao redor do sprite segue o tema escuro. O xadrez da transparência e a grade ficam claros.

## Modelo

Um sprite tem `frames` × `layers`. A interseção é um `cel` com imagem, offset e opacidade. Layers vão de baixo para cima: `layers[0]` é desenhado primeiro. Modos de cor: `rgba`, `indexed` e `grayscale`. A conversão quantiza. No modo indexado, trocar uma cor da paleta repinta os pixels dessa cor. O cel de tilemap guarda índices de tile; a camada de referência continua só no editor. O canvas pode ser redimensionado, recortado, autocortado e girado com RotSprite. Slices e texto bitmap fazem parte do mesmo documento.

Mutações do documento passam por `Command` (`execute` / `undo`) e por `History`. A UI não altera pixels, frames, layers ou paleta direto. O tamanho da grade fica no sprite. Cor de frente, fundo, zoom, pan, visibilidade da grade, pincel, tinta, simetria, ladrilho, onion skin, atalhos, idioma e a seleção são estado de vista. O trabalho sujo é gravado no IndexedDB. A paleta inicial é Sweetie 16 (GrafxKid). DB32 e Endesga 32 entram como paletas com atribuição. No desktop, o painel lateral e a linha do tempo podem ser redimensionados ou minimizados. A prévia do quadro fica acima das cores. A seleção não entra no PNG nem no JSON. A camada de referência entra no composite do editor e fica de fora do PNG. Cada aba é uma `EditorSession`.

## Pastas

- `src/domain/` tipos e buffers, sem DOM
- `src/commands/` comandos e histórico
- `src/render/` composite, raster e viewport
- `src/tools/` uma ferramenta por classe; tinta e traço separados do shell
- `src/io/` JSON do projeto, PNG, GIF, sequência PNG, sprite sheet, atlas, vídeo e `.ase`/`.aseprite`
- `src/storage/` IndexedDB
- `src/input/` atalhos
- `src/ui/` shell Bootstrap e textos
- `src/app/` sessão e controlador

O inventário que ainda falta está em [ROADMAP.md](../../../ROADMAP.md). Estender o domínio existente; não criar um segundo modelo de sprite.

## Verificação

`npm test` cobre buffer, pintura com undo e composite. Depois de mudar a UI, rodar o app e exercer a ferramenta alterada.
