**Status:** ready-for-agent

## Problem Statement

O build de produção é um site estático, e o PWA declara `start_url` e `scope` na raiz. Sem um endereço HTTPS nessa raiz, o service worker não instala. Um deploy num subcaminho (`/pixeluz/`) quebra o registro porque o Vite e o manifest assumem `/`.

## Solution

A 1.0 é publicada como site estático em HTTPS, servida na raiz do host. O build continua `npm run build`, e o que se publica é o diretório de saída. Se o host obrigar um subcaminho, o `base` do Vite e o manifest passam a usar esse caminho juntos. A documentação de desenvolvimento diz o comando de build e que o preview local serve essa pasta.

## User Stories

1. As a visitor, I want the published app to load over HTTPS, so that the browser allows the installed PWA.
2. As a visitor at the host root, I want the manifest start URL to resolve, so that installing the app opens Pixeluz.
3. As a maintainer publishing under a subpath, I want icons, the offline page, and the worker to use that same path, so that a refresh does not 404.
4. As a maintainer, I want one written command that produces the directory to upload, so that the release is repeatable.
5. As a returning visitor, I want a reload of the installed app to open the editor, so that the PWA is not a blank shell.

## Implementation Decisions

- Prefer a host whose site root is the app. Do not pick a vendor in code.
- Leave `start_url` and `scope` at `/` for that root deploy.
- A subpath deploy changes the Vite base and the manifest together. Relative asset URLs must keep working after that single setting.
- Do not add a backend. Saving stays in the browser.

## Testing Decisions

- The seam is the production build, not the dev server. Serve the build output and open it.
- A good check loads the document, confirms the manifest start URL matches the base, and confirms the service worker registers on HTTPS or on localhost.
- The offline page is covered by the release smoke spec. This spec only proves the build is deployable at the chosen base.

## Out of Scope

- A custom domain, analytics, or a CDN configuration beyond "static files at the site root".
- Changing IndexedDB or the project JSON.
- Continuous deployment. The CI spec only checks the build; it does not have to upload it.

## Further Notes

`npm run preview` already serves the production build locally and is enough to verify the root case before DNS exists.
