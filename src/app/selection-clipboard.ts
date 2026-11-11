import { cloneImage } from "../domain/image-buffer";
import type { ImageBuffer } from "../domain/types";

export type SelectionClipboard = {
  image: ImageBuffer;
  mask: Uint8Array;
  x: number;
  y: number;
};

let shared: SelectionClipboard | null = null;
let pasteStreak = 0;

export function setSelectionClipboard(value: SelectionClipboard | null): void {
  pasteStreak = 0;
  if (!value) {
    shared = null;
    return;
  }
  shared = {
    image: cloneImage(value.image),
    mask: value.mask.slice(),
    x: value.x,
    y: value.y,
  };
}

export function getSelectionClipboard(): SelectionClipboard | null {
  return shared;
}

/** Returns the current paste offset and advances the streak for the next paste. */
export function takePasteNudge(): number {
  const nudge = pasteStreak;
  pasteStreak += 1;
  return nudge;
}

/** Clears the shared clipboard. Only for tests. */
export function resetSelectionClipboardForTests(): void {
  shared = null;
  pasteStreak = 0;
}
