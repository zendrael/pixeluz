**Status:** ready-for-agent

## Problem Statement

`layer.locked` already blocks edits, but the layers list has no lock toggle — artists must flip the flag only in tests or ASE.

## Solution

`SetLayerLockedCommand` and a lock button on each layer row. Toggle updates via Command (undoable).

## User Stories

1. As a person protecting line art, I want to lock a layer from the panel so strokes skip it.

## Implementation Decisions

- Command mirrors visibility toggle pattern.
- Costura Sessão: toggle + undo restores locked.

## Testing Decisions

- Seam: Sessão.
- Do not require Bootstrap for the command test.

## Out of Scope

- Locking groups recursively.
