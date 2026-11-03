import { cloneImage } from "../domain/image-buffer";
import type { ImageBuffer } from "../domain/types";

export type SelectionClipboard = {
  image: ImageBuffer;
  mask: Uint8Array;
  x: number;
  y: number;
};

let shared: SelectionClipboard | null = null;

export function setSelectionClipboard(value: SelectionClipboard | null): void {
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

/** Clears the shared clipboard. Only for tests. */
export function resetSelectionClipboardForTests(): void {
  shared = null;
}
