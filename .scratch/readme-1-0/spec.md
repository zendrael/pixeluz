**Status:** ready-for-agent

## Problem Statement

O README ainda apresenta DB32 e Endesga como as paletas do editor, não diz que a paleta inicial é Sweetie 16, não menciona a importação do Lospec, e não diz que o tamanho da grade se escolhe em Configurações. Quem chega na 1.0 lê um produto diferente do que abre.

## Solution

A lista do que o editor faz passa a incluir a paleta inicial Sweetie 16, as presets DB32 e Endesga com atribuição, a importação de uma paleta do Lospec, a exportação da paleta em `.hex`, e a grade configurável. O atalho da grade continua explicando que o botão existe porque G é o balde, e que o tamanho da célula fica em Configurações.

## User Stories

1. As a reader of the README, I want the default palette named as Sweetie 16 by GrafxKid, so that I recognize the colors in a new sprite.
2. As a reader, I want DB32 and Endesga 32 described as optional presets with their credits, so that they are not mistaken for the default.
3. As a reader, I want Lospec import and `.hex` export mentioned, so that I know I can bring and keep a palette.
4. As a reader, I want the grid size described as a setting, so that I do not look for a 1×1 control on the toolbar.
5. As a reader, I want the keyboard section to keep saying that G is the bucket, so that the grid button still makes sense.

## Implementation Decisions

- Edit the existing README sections. Do not add a second feature list.
- Use the glossary names: paleta, grade, sprite.
- Do not paste Lospec palette files into the README.
- Credits in the README must match the notice from the palette-attribution spec. If that notice is not written yet, use the same author lines already shown in the color panel.

## Testing Decisions

- No runtime test. The check is that the README contains Sweetie 16, GrafxKid, Lospec, `.hex`, and the settings path for the grid, and that it no longer implies DB32 or Endesga is the default palette.
- Do not assert on marketing adjectives.

## Out of Scope

- Translating the README into English or Spanish.
- Rewriting the roadmap, except the blend-mode line in its own spec.
- Changing palette behavior.

## Further Notes

The development section already points agents at `AGENTS.md`. Leave that pointer in place.
