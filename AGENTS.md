# Pixeluz

Editor de pixel art no navegador. Leia `GLOSSARY.md` antes de nomear o domínio. O desenho e as costuras de teste estão em `docs/tdd.md`. O que ficou de fora está em `ROADMAP.md`.

## Agent skills

### Issue tracker

Issues locais em `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Os cinco papéis canônicos usam o próprio nome como rótulo. See `docs/agents/triage-labels.md`.

### Domain docs

Contexto único: `GLOSSARY.md` na raiz e ADRs em `docs/adr/`. See `docs/agents/domain.md`.

## Skills instaladas

Engenharia e produtividade de [mattpocock/skills](https://github.com/mattpocock/skills) em `.agents/skills/` (commit `a496f5513d4a4cf889bc48e189e579f4b0bdf6aa`, licença MIT). No Cursor, `.cursor/skills/` aponta para essa pasta. A skill `pixeluz` guarda as invariantes deste editor.

Comportamento novo passa pela skill `tdd` e por uma costura já listada em `docs/tdd.md`.
