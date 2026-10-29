**Status:** ready-for-agent

## Problem Statement

O trabalho da 1.0 fica no IndexedDB e no JSON do projeto. Uma atualização do PWA que não reabre um projeto salvo na versão anterior apaga o desenho de quem atualizar.

## Solution

Um projeto serializado no formato atual abre de novo depois desta linha de versão. O teste guarda um fixture produzido pelo serializador de hoje e prova que o leitor devolve o mesmo sprite: tamanho, modo de cor, paleta, quadro, camada, cel e grade.

## User Stories

1. As a user who saved before the 1.0 update, I want that project to open after the update, so that the release does not discard my sprite.
2. As a user who reloads the installed app, I want the autosaved recovery to open, so that a service-worker update is not data loss.
3. As a maintainer, I want a fixture checked into the tests, so that a future schema change fails until it migrates that file.
4. As a user with more than one tab, I want each saved sprite in the recovery to open, so that a multi-document session survives the reload.

## Implementation Decisions

- The seam is the project JSON reader and writer already used for download and IndexedDB. Do not open a browser for this spec.
- Capture the fixture by serializing a sprite that has a non-default palette color, a second frame, and a non-default grid. The expected values are literals in the test, not a second call to the serializer.
- If the reader must grow a migration, it accepts this fixture and the current writer output. Do not invent a second document model.
- IndexedDB schema upgrades must keep existing object stores. A version bump that deletes the project store fails this spec.

## Testing Decisions

- Follow the existing project JSON round-trip tests. Add the fixture as a file the reader loads.
- A good test names pixels and palette entries with literals from the fixture. Re-serializing and comparing to the serializer output is not the assertion.
- Recovery of several sessions is in scope only if the recovery record is a list of those JSON strings. Test the reader on each string; do not mock IndexedDB unless the upgrade path cannot be observed through the reader.

## Out of Scope

- Migrating Aseprite files from older builds.
- Cloud sync.
- Changing the autosave interval.

## Further Notes

The service worker uses auto-update. That is safe only while this fixture still opens. The smoke spec checks the browser reload; this spec checks the bytes.
