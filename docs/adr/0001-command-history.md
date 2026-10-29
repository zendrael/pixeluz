# Command e History

O sprite muda por `Command`: `execute` aplica, `undo` reverte, e `History` guarda a pilha (limite 200). A UI e as ferramentas chamam a `EditorSession`, que grava o command. Pixel, quadro, camada e paleta não são escritos fora dessa pilha.

Estado de vista (seleção, zoom, pincel, idioma, painéis) não entra no `SpriteDocument`, no PNG nem no JSON do projeto.
