**Status:** ready-for-agent

## Problem Statement

O roadmap diz que o composite só aplica o blend `normal`. O composite já passa o blend da camada para o cálculo em `blend`. Quem for executar a 1.0 a partir do roadmap vai reimplementar uma coisa que existe, ou vai esconder um controle que funciona.

## Solution

A frase do roadmap sobre blend passa a dizer que os modos nomeados em `BlendMode` são aplicados no composite. O restante do roadmap não muda.

## User Stories

1. As a maintainer reading the roadmap, I want the blend line to match the composite, so that I do not schedule finished work.
2. As a user, I want the blend control to keep working, so that this documentation fix does not remove a feature.
3. As an agent starting from the roadmap, I want finished phases to stay marked done, so that the 1.0 cut does not reopen them.

## Implementation Decisions

- Edit the single inaccurate sentence in the roadmap's animation section.
- Do not delete finished phases or add a new phase.
- Do not change blend math. If a mode is wrong, that is a bug outside this spec.

## Testing Decisions

- No new runtime test. The composite seam already feeds the layer blend into the blit.
- The check is the roadmap sentence. It must not say that only `normal` is applied.

## Out of Scope

- Golden images for every blend mode.
- New blend modes.
- The README palette edits.

## Further Notes

This spec exists so the 1.0 source of truth does not contradict the code.
