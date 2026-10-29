**Status:** ready-for-agent

## Problem Statement

A paleta inicial é Sweetie 16, de GrafxKid, e o editor também oferece DB32 e Endesga 32. O crédito aparece na interface quando a paleta coincide com o preset, mas o aviso legal que acompanha o código não registra esses autores. A licença MIT do programa não cobre as paletas.

## Solution

O aviso que acompanha a licença do programa nomeia Sweetie 16 (GrafxKid), DB32 (DawnBringer, domínio público) e Endesga 32 (Endesga, CC0). A licença da Sweetie 16 só entra nesse aviso se for confirmada numa fonte do autor. Se a fonte não declarar licença, o aviso fica só com o autor, sem inventar CC0 ou CC-BY.

## User Stories

1. As a person shipping Pixeluz 1.0, I want the palette authors named beside the code license, so that redistribution does not drop attribution.
2. As a maintainer, I want Sweetie 16's license copied only from the author's own statement, so that the notice does not invent a license.
3. As a user opening a new sprite, I want the existing on-screen credit for Sweetie 16 to stay, so that attribution is visible in the editor and in the repository.
4. As a user who switches to DB32 or Endesga 32, I want those credits to remain in the color panel, so that the presets stay attributed in the product.

## Implementation Decisions

- Record the three palettes in a notice next to the root license file. The code license file itself stays MIT and does not absorb the palettes.
- DB32 stays "DawnBringer, public domain". Endesga 32 stays "Endesga, CC0". Those statements already match the credits in the interface.
- For Sweetie 16, read the author's page linked from the Lospec palette before writing a license. If that page does not state one, write the author only.
- Do not change the default palette colors or the Lospec import.

## Testing Decisions

- Check the notice text and the three interface credit strings. A good test fails if Sweetie 16, DB32, or Endesga disappears from either place.
- Do not snapshot the Lospec website. The lookup of Sweetie 16's license is a one-time note in the spec's result, not a network test.

## Out of Scope

- Relicensing the Pixeluz source.
- Adding more built-in palettes.
- A new about dialog, unless the notice cannot live beside the license without one.

## Further Notes

Lospec's palette page for Sweetie 16 names GrafxKid and does not show a license field. That absence is why this spec forbids guessing.
