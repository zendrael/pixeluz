import type { SelectMode } from "./draw-options";

export interface MaskBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function maskBounds(mask: Uint8Array, width: number, height: number): MaskBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 1) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

export function pasteOrigin(
  clipX: number,
  clipY: number,
  clipW: number,
  clipH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const intersects =
    clipX < canvasW && clipX + clipW > 0 && clipY < canvasH && clipY + clipH > 0;
  if (intersects) return { x: clipX, y: clipY };
  return {
    x: Math.max(0, Math.floor((canvasW - clipW) / 2)),
    y: Math.max(0, Math.floor((canvasH - clipH) / 2)),
  };
}

export function nudgedPasteOrigin(
  origin: { x: number; y: number },
  nudge: number,
  clipW: number,
  clipH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, origin.x + nudge), Math.max(0, canvasW - clipW)),
    y: Math.min(Math.max(0, origin.y + nudge), Math.max(0, canvasH - clipH)),
  };
}

export function combineMasks(current: Uint8Array | null, incoming: Uint8Array, mode: SelectMode): Uint8Array | null {
  const out = new Uint8Array(incoming.length);
  let any = false;
  for (let index = 0; index < incoming.length; index++) {
    const left = current?.[index] === 1;
    const right = incoming[index] === 1;
    let bit = false;
    if (mode === "replace") bit = right;
    else if (mode === "add") bit = left || right;
    else if (mode === "subtract") bit = left && !right;
    else bit = left && right;
    if (bit) {
      out[index] = 1;
      any = true;
    }
  }
  return any ? out : null;
}

export function maskFromPoints(width: number, height: number, points: Array<[number, number]>): Uint8Array | null {
  const mask = new Uint8Array(width * height);
  let any = false;
  for (const [x, y] of points) {
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    mask[y * width + x] = 1;
    any = true;
  }
  return any ? mask : null;
}

export function selectionMode(shift: boolean, alt: boolean, fallback: SelectMode): SelectMode {
  if (shift && alt) return "intersect";
  if (shift) return "add";
  if (alt) return "subtract";
  return fallback;
}
