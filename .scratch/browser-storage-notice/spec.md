**Status:** ready-for-agent

## Problem Statement

O sprite é gravado no IndexedDB deste navegador. Fechar a aba suja pede confirmação, mas nada diz que limpar os dados do site, ou abrir Pixeluz noutro navegador, não leva o desenho junto. Na 1.0 isso parece perda de arquivo.

## Solution

A interface mostra, de forma contínua e curta, que o projeto está neste navegador até ser baixado. O texto some depois que a pessoa baixa o projeto, e volta se o sprite ficar sujo de novo. O aviso de fechar a aba permanece.

## User Stories

1. As a user who has never downloaded, I want a visible note that my sprite is stored in this browser, so that I do not assume it is in the cloud.
2. As a user, I want the note to name the download action, so that I know how to take the file to another machine.
3. As a user who just downloaded, I want the note to go away while the sprite stays saved, so that it does not nag after I have a copy.
4. As a user who paints again after downloading, I want the note to return, so that the new pixels are not only in the browser.
5. As a user closing a dirty tab, I want the existing leave confirmation to remain, so that an accidental close still asks.
6. As a user on a phone, I want the same note in the mobile layout, so that the warning is not desktop-only.

## Implementation Decisions

- The note is view state. It is not written into the sprite JSON or the PNG.
- "Downloaded" means the project file download finished in this session, not that a cloud copy exists.
- Keep the current dirty-tab confirmation. Do not replace it with a custom modal in this spec.
- Use the existing locale strings, with a new string in Portuguese, English, and Spanish.
- Place the note where status already appears, so it does not cover the canvas.

## Testing Decisions

- The browser smoke can see the note before download and its absence after a download of a clean sprite. A unit test is only useful if the visibility is a pure function of dirty and downloaded; then test that function with literals.
- Do not assert CSS pixels. Assert that the note text is present or absent.

## Out of Scope

- An account, sync, or a server copy.
- Exporting PNG as a substitute for the project file. The note points at the project download.
- Changing the autosave interval or the IndexedDB schema.

## Further Notes

The project JSON compatibility spec protects the bytes. This spec protects the person's understanding of where those bytes live.
