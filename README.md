# Pixeluz

Editor de pixel art e animação no navegador. A arte no canvas continua pixelada; a interface é Bootstrap 5, responsiva, em português, e funciona no desktop e no celular. O app é um PWA: o shell fica disponível offline depois da instalação.

A implementação é original e está sob a licença MIT. O comportamento segue a documentação pública do [Aseprite](https://www.aseprite.org/docs/) e a descrição do [LibreSprite](https://libresprite.github.io/). O código desses projetos não entra aqui. O [REA](https://github.com/morluto/rea) não é usado: a documentação pública já cobre as funções, e decompilar o Aseprite proprietário copiaria código protegido.

## O que o editor faz

- Sprite RGBA, camadas de imagem, grupos, referência, tilemap, opacidade, blend e vários quadros com duração
- Lápis, borracha, conta-gotas, linha, curva, retângulo, elipse, contorno, polígono, gradiente e balde
- Pincel quadrado, circular ou da seleção, com tamanho, ângulo, opacidade, tinta, simetria, ladrilho e pixel perfect
- Seleção retangular, elíptica, laço, laço poligonal e varinha; mover, copiar, espelhar, girar e escalar
- Cores de frente e fundo, paleta editável, zoom, pan e grade com o tamanho das células em Configurações
- Reproduzir, criar, duplicar, reordenar, inverter e copiar quadros; tags com loop; onion skin
- Desfazer e refazer
- Modos RGBA, indexado e cinza, com filtros de inverter, brilho, matiz, contorno e troca de cor
- Salvar o projeto em JSON no IndexedDB, baixar o JSON e exportar PNG, GIF, sequência PNG, sprite sheet e `.aseprite`
- No desktop, abrir e salvar arquivo pelo seletor do sistema; no celular, o download e o campo de arquivo
- Tema escuro na interface e no fundo ao redor do sprite; o xadrez e a grade ficam claros
- Tilemap com desenho de tiles ou pixels, slices, texto bitmap e configurações de tamanho do canvas (redimensionar, recortar, autocrop e RotSprite)
- Idioma da interface em português brasileiro, inglês ou espanhol
- Atalhos configuráveis, com uma folha de cola
- Gravação automática no IndexedDB e recuperação ao reabrir
- Paleta inicial Sweetie 16 (GrafxKid). Presets DB32 (DawnBringer, domínio público) e Endesga 32 (Endesga, CC0). Importar uma paleta do Lospec e exportar a paleta em `.hex`
- Prévia do quadro acima das cores; no desktop, painel lateral e linha do tempo redimensionáveis e minimizáveis
- Vários documentos em abas
- Layout com barra lateral no desktop e folhas inferiores no celular
- Toque, pinça para zoom e dois dedos para mover

O que ficou de fora de propósito está em [ROADMAP.md](ROADMAP.md).

## Atalhos

Os atalhos abaixo são o padrão. Dá para trocá-los na folha de cola.

| Ação | Tecla |
| --- | --- |
| Lápis, borracha, conta-gotas, balde | B, E, I, G |
| Linha, curva, retângulo, elipse | L, C, U, O (Shift+U também abre a elipse) |
| Contorno, polígono, gradiente | K, P, M |
| Seleção retângulo, elipse, laço, polígono, varinha | S, Q, F, Y, W |
| Mover seleção, zoom, mão | V, Z, H |
| Fechar curva, polígono ou laço poligonal | Enter ou clique duplo |
| Cancelar o traço em construção | Esc |
| Mão temporária | Espaço |
| Desfazer, refazer | Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z |
| Salvar, novo | Ctrl/Cmd+S, Ctrl/Cmd+N |
| Quadro anterior e próximo | Setas, vírgula e ponto |
| Reproduzir | Enter, quando não há traço em construção |

Clique com o botão direito pinta com a cor de fundo. Shift endireita a linha, soma à seleção e torna o retângulo e a elipse quadrados. Alt subtrai da seleção e, na ferramenta mover, copia. Shift+Alt faz a interseção. A roda do mouse aproxima do cursor. A grade é o botão da barra, porque G é o balde. O tamanho das células fica em Configurações.

## Desenvolvimento

Requer Node 20 ou mais novo.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

`npm run dev` abre o editor em desenvolvimento. A instalação offline usa o service worker gerado por `npm run build`; em seguida `npm run preview` serve essa versão.

## Publicar

```bash
npm run build
npm run preview
```

`npm run build` gera a pasta `dist`. Publique essa pasta em HTTPS, na raiz do host: o manifesto abre `/`. `npm run preview` serve essa pasta neste computador.

Se o host só entregar o app num subcaminho, o `base` do Vite e os campos `start_url` e `scope` do manifesto usam esse caminho juntos.

`npm run smoke`, depois do build, percorre no Chrome criar, pintar, desfazer, recarregar, PNG, a viewport de celular e a página offline.

Agentes de IA começam por [AGENTS.md](AGENTS.md).

Os projetos salvos ficam no IndexedDB deste navegador. "Baixar" grava um `.pixeluz.json` que pode ser aberto em outra máquina.
