# Glossário

Termos do editor. No código os identificadores estão em inglês. Na interface, em português.

**Sprite.** O `SpriteDocument`: tamanho, modo de cor, paleta, quadros, camadas, cels, tags, slices, tilesets e grade. Não existe um segundo modelo de sprite.

**Quadro.** Um `Frame`: identidade e duração em milissegundos (20–5000, padrão 100).

**Camada.** Um `Layer`. `layers[0]` é desenhada primeiro (embaixo). Tipos: `image`, `group`, `reference`, `tilemap`. No máximo 32. Grupo não tem cel.

**Cel.** A interseção de uma camada com um quadro: imagem, deslocamento e opacidade. Cels ligados compartilham um `ImageBuffer`.

**Paleta.** Lista de cores do sprite, no máximo 256. A paleta inicial de um sprite novo é Sweetie 16 (GrafxKid). DB32 e Endesga 32 são presets com atribuição. Importar do Lospec e exportar `.hex` trocam a paleta por um `Command`.

**Modo de cor.** `rgba`, `indexed` ou `grayscale`. A conversão quantiza. No modo indexado, trocar uma cor da paleta remapeia os pixels.

**Grade.** `grid` do sprite: largura, altura e deslocamento das células desenhadas por cima do canvas. Não é o tamanho do tile. O tile do tileset sai de `clampTile(grid)` e fica entre 4 e 32.

**Tileset.** Imagens de tile. O índice 0 é vazio. O cel de tilemap guarda índices, não pixels.

**Tag.** Faixa de quadros com loop `forward`, `reverse` ou `ping-pong`.

**Slice.** Retângulo nomeado, com chaves por quadro, usado na exportação por fatia.

**Seleção.** Estado de vista na `EditorSession`. Não entra no PNG nem no JSON do projeto.

**Estado de vista.** Cor de frente e de fundo, zoom, pan, visibilidade da grade, pincel, tinta, simetria, ladrilho, onion skin, atalhos, idioma, seleção e tamanho dos painéis. Fica fora do sprite.

**Command.** A única forma de mudar pixels, quadros, camadas ou paleta. `execute` aplica, `undo` reverte. A UI não escreve no sprite direto.

**History.** Pilha de commands, no máximo 200.

**EditorSession.** Um sprite aberto, com vista, ferramenta e history. Cada aba é uma sessão.

**Composite.** A imagem de um quadro no editor. A camada `reference` entra nesse composite e fica de fora da exportação padrão.

**Zoom.** Inteiro de 1 a 64. O canvas do sprite usa `image-rendering: pixelated`. O restante da interface não.
