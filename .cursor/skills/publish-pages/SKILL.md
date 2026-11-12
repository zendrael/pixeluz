---
name: publish-pages
description: >-
  Publica o build de produção do Pixeluz em zendrael.github.io/pixeluz.
  Use quando o usuário pedir publicar, deploy de produção, ou atualizar a
  pasta pixeluz no GitHub Pages.
---

# Publicar Pages

Rotina segura: build com base `/pixeluz/`, upload **só** da pasta `pixeluz/` no site estático. Sem tokens no repo. Autenticação = SSH host `github-personal` (conta zendrael).

## Pré-condição

Só execute se o usuário pediu publicar / deploy / atualizar o site. Se também pediu commit e push do código Pixeluz, faça isso **antes** (regras de commit do usuário), depois continue aqui.

## Passos

1. **Build** — No repo Pixeluz: `GITHUB_PAGES=true npm run build`. Feito quando exit 0 e `dist/index.html` (e o manifest) usam `/pixeluz/`.
2. **Clone** — `SITE=$(mktemp -d)/site` e `git clone --depth 1 git@github-personal:zendrael/zendrael.github.io.git "$SITE"`. Feito quando o clone termina sem erro. Use o host `github-personal`, não HTTPS nem a chave default.
3. **Upload** — Remova `$SITE/pixeluz`, recrie a pasta e copie o conteúdo de `dist/` para `$SITE/pixeluz/`. Feito quando só `pixeluz/` mudou; a raiz do site permanece intacta.
4. **Commit** — Em `$SITE`: `git add -A pixeluz` e commit com autor **apenas** via `-c user.name=zendrael -c user.email=zendrael@gmail.com`. Mensagem curta do que está no ar. Nunca rode `git config`.
5. **Push** — `git push origin HEAD` sem `--force`. Feito quando o remote aceita o fast-forward. Se rejeitar, pare e relate. Informe o hash e https://zendrael.github.io/pixeluz/

O clone fica no temp do SO. Não grave credenciais nem cópia do site dentro do repo Pixeluz.

## Escopo

- Destino: `zendrael/zendrael.github.io`, pasta `pixeluz/` apenas.
- Build Pages: `GITHUB_PAGES=true` → base `/pixeluz/` (`vite.config.ts`).
- Push do código Pixeluz (quando pedido): remote `git@github-personal:zendrael/pixeluz.git`.
