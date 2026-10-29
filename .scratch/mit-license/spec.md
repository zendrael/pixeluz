**Status:** ready-for-agent

## Problem Statement

O README diz que o Pixeluz é MIT, mas o repositório não tem o arquivo de licença, e a versão publicada no pacote ainda é 0.1.0. Quem for fazer o deploy da 1.0 não tem o texto legal na raiz nem um número de versão que corresponda ao lançamento.

## Solution

A raiz do projeto ganha um arquivo `LICENSE` com o texto MIT. A versão do pacote passa a `1.0.0`. O nome no copyright é o que o mantenedor escolher; se nenhum nome for dado, a linha fica "Pixeluz contributors".

## User Stories

1. As a person reusing Pixeluz, I want a MIT license file at the repository root, so that I know what I am allowed to do with the code.
2. As a maintainer, I want the package version to read 1.0.0, so that the published build matches the release.
3. As a maintainer, I want the copyright line to name the holder I choose, so that the license is not attributed to a guessed person.
4. As a downstream packager, I want the license file to be the standard MIT text, so that license scanners recognize it.

## Implementation Decisions

- Add the MIT license as a root file named `LICENSE`. Do not invent a personal legal name. Default the copyright holder to "Pixeluz contributors" unless the maintainer supplies another name in the same change.
- Set the package version field to `1.0.0`.
- Do not relicense dependencies. Font Awesome, Bootstrap, and the copied agent skills keep their own notices.
- Do not initialize a git repository in this change.

## Testing Decisions

- A good test checks the observable file: the root license contains the MIT permission grant and the copyright line, and the package version is `1.0.0`.
- No new runtime seam. This is a repository artifact, checked by reading those two files.

## Out of Scope

- Attribution of Sweetie 16, DB32, and Endesga. That is a separate spec.
- Choosing a host, adding CI, or tagging a release.
- Changing the application behavior.

## Further Notes

The README already states that the implementation is MIT. This spec only makes that claim true on disk.
