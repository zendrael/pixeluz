**Status:** ready-for-agent

## Problem Statement

Autosave e recuperação passam pelo IndexedDB, mas só o smoke no Chrome exercita esse caminho. Uma regressão no schema ou no recovery de várias abas só aparece depois do deploy.

## Solution

A costura Armazenamento cobre `saveProject`, `loadProject`, `saveRecovery` e `loadRecovery` com IndexedDB em memória (`fake-indexeddb`). O upgrade para a versão atual cria `recovery` sem apagar `projects`.

## User Stories

1. As a person who saved a project, I want to reopen the same pixels and name, so that IndexedDB is a real backup.
2. As a person with two tabs open, I want recovery to restore both and the active index, so that a reload does not drop a document.
3. As a person updating the app, I want an existing project store to survive the schema bump that adds recovery, so that an upgrade does not wipe drawings.

## Implementation Decisions

- Keep the public functions in `src/storage/db.ts`.
- Use `fake-indexeddb/auto` in the storage test only.
- Export a test-only reset that closes the cached connection and deletes the `pixeluz` database.
- Do not mock `serializeProject` / `deserializeProject`.

## Testing Decisions

- Seam: Armazenamento.
- Roundtrip one project; recovery with two projects and `activeIndex` 1; open version 1 with a project, then open version 2 through the module and load that project.
- Do not assert browser quota or the service worker.

## Out of Scope

- Changing the autosave interval.
- Encrypting stored JSON.
