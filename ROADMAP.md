# Roadmap

A fase 0 (ferramentas, licença, skill), a fase 1 (editor usável offline), os ajustes seguintes, a fase 2 (desenho completo), a fase 3 (animação e layers), a fase 4 (cor e arquivo), a fase 5 (tilemap, slices e texto), a fase 6 (acabamento) e a fase 7 (painéis) estão implementadas. O trabalho estende o mesmo `SpriteDocument` e a mesma pilha de comandos. Não criar um modelo paralelo.

Formatos legados FLC, FLI, PCX e TGA ficam de fora. CLI, plugins Lua e perfis ICC também. No lugar do undo em árvore e do docking livre: autosave, atalhos visíveis e painéis Bootstrap.

## A seguir — feito

- Fundo ao redor do sprite segue o tema escuro. O xadrez da transparência e a grade do sprite ficam claros.
- Camadas na interface: adicionar, remover, renomear e reordenar camadas de imagem.

## Fase 2 — desenho completo — feito

- Curva, contorno e polígono em `src/tools/`, com os mesmos rasterizadores de `src/render/raster.ts`
- Gradiente linear e radial com dither Bayer 2×2, 4×4 e 8×8
- Pincel quadrado, circular e personalizado; tamanho, ângulo e opacidade
- Traço pixel-perfect como um intertwiner aplicado antes de gravar o comando
- Simetria horizontal, vertical e ambas
- Modo tiled em X, Y e ambos, desenhando no cel e repetindo no viewport
- Tintas: simple, alpha compositing, copy, lock alpha e shading pela ordem da paleta
- Pressão de `PointerEvent.pressure` na dinâmica do pincel, quando o ponteiro é uma caneta
- Seleção retangular, elíptica, laço, laço poligonal e varinha, com substituir, somar, subtrair e interseção
- Mover, copiar, espelhar, escalar e rotacionar a seleção

A seleção mora na sessão, em `src/domain`, e não entra no PNG nem no JSON do projeto.

## Fase 3 — animação e layers — feito

- Grupos e camada de referência (a referência aparece no editor e não entra no export)
- Opacidade e os blend modes já nomeados em `BlendMode` são aplicados no composite
- Cel com offset, opacidade própria e cels ligados
- Tags com loop forward, reverse e ping-pong
- Onion skin com N quadros antes e depois
- Inverter uma faixa, copiar cels e reordenar quadros
- Vários documentos em abas, cada um com sua `EditorSession`

## Fase 4 — cor e arquivo — feito

- Modos indexed (até 256) e grayscale, com quantização na conversão
- Filtros em comandos: inverter, brilho/contraste, matiz/saturação, outline e replace color
- GIF, sequência PNG, sprite sheet e JSON de atlas em `src/io/`
- Leitura e escrita de `.ase` / `.aseprite` pela [spec pública](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md). Campos de tilemap podem esperar a fase 5
- File System Access API no desktop e download no celular

## Fase 5 — tilemap, slices e texto — feito

- Layer `tilemap`, tileset e modos Draw Pixels (manual, auto, stack) e Draw Tiles
- Slices e export por slice
- Texto com fonte bitmap
- Botão de configurações com opções para alterar o tamanho do canvas: redimensionar, recortar, autocrop e RotSprite para ângulos não ortogonais

## Fase 6 — acabamento — feito

- Vários idiomas na interface, a partir de `src/ui/i18n.ts`: português brasileiro, inglês e espanhol, com o idioma escolhido na interface
- Atalhos configuráveis e uma folha de cola na interface
- Autosave e recuperação do IndexedDB
- Paletas prontas (DB32, Endesga e similares) com atribuição
- Ícones maskable e página offline dedicada, se o precache do shell não bastar

## Fase 7 — painéis — feito

- Botões de transformar a seleção só com ícone e tooltip
- Painel lateral e linha do tempo redimensionáveis e minimizáveis no desktop
- Prévia do quadro acima das cores, também na folha de cores no celular
