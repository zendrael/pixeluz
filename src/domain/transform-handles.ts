import { maskBounds } from "./selection";

export type TransformHandle = "nw" | "ne" | "sw" | "se" | "rotate";

export function hitTransformHandle(
  mask: Uint8Array,
  width: number,
  height: number,
  spriteX: number,
  spriteY: number,
  zoom: number,
): TransformHandle | null {
  const bounds = maskBounds(mask, width, height);
  if (!bounds) return null;
  const left = bounds.minX;
  const top = bounds.minY;
  const right = bounds.maxX + 1;
  const bottom = bounds.maxY + 1;
  const midX = (left + right) / 2;
  const pad = Math.max(0.4, 4 / Math.max(1, zoom));
  const rotateY = top - Math.max(1.25, 18 / Math.max(1, zoom));
  if (near(spriteX, spriteY, midX, rotateY, pad)) return "rotate";
  if (near(spriteX, spriteY, left, top, pad)) return "nw";
  if (near(spriteX, spriteY, right, top, pad)) return "ne";
  if (near(spriteX, spriteY, left, bottom, pad)) return "sw";
  if (near(spriteX, spriteY, right, bottom, pad)) return "se";
  return null;
}

function near(x: number, y: number, hx: number, hy: number, pad: number): boolean {
  return Math.abs(x - hx) <= pad && Math.abs(y - hy) <= pad;
}
