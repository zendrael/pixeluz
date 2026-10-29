import { getPixel, setPixel } from "./image-buffer";
import { maskBounds } from "./selection";
import type { ImageBuffer, Rgba } from "./types";

export type SelectionOp = "flip-h" | "flip-v" | "rotate" | "scale-up" | "scale-down" | "copy" | "move" | "duplicate";

interface Bit {
  x: number;
  y: number;
  color: Rgba;
}

export function editSelection(image: ImageBuffer, mask: Uint8Array, op: SelectionOp, dx = 0, dy = 0): Uint8Array | null {
  const bits = collect(image, mask);
  if (bits.length === 0) return null;
  const bounds = maskBounds(mask, image.width, image.height);
  if (!bounds) return null;
  const keepSource = op === "copy" || op === "duplicate";
  if (!keepSource) {
    for (const bit of bits) setPixel(image, bit.x, bit.y, { r: 0, g: 0, b: 0, a: 0 });
  }
  const next = new Uint8Array(image.width * image.height);
  if (keepSource) {
    for (const bit of bits) mark(next, image.width, image.height, bit.x, bit.y);
  }
  for (const bit of bits) {
    for (const [x, y] of destinations(bit, bounds, op, dx, dy)) {
      if (!mark(next, image.width, image.height, x, y)) continue;
      setPixel(image, x, y, bit.color);
    }
  }
  return next.some((bit) => bit === 1) ? next : null;
}

function collect(image: ImageBuffer, mask: Uint8Array): Bit[] {
  const bits: Bit[] = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (mask[y * image.width + x] !== 1) continue;
      const color = getPixel(image, x, y);
      if (color) bits.push({ x, y, color: { ...color } });
    }
  }
  return bits;
}

function destinations(
  bit: Bit,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  op: SelectionOp,
  dx: number,
  dy: number,
): Array<[number, number]> {
  if (op === "move") return [[bit.x + dx, bit.y + dy]];
  if (op === "duplicate") return [[bit.x + dx, bit.y + dy]];
  if (op === "copy") return [[bit.x + 1, bit.y + 1]];
  if (op === "flip-h") return [[bounds.minX + bounds.maxX - bit.x, bit.y]];
  if (op === "flip-v") return [[bit.x, bounds.minY + bounds.maxY - bit.y]];
  if (op === "rotate") {
    const localX = bit.x - bounds.minX;
    const localY = bit.y - bounds.minY;
    const spanY = bounds.maxY - bounds.minY;
    return [[bounds.minX + (spanY - localY), bounds.minY + localX]];
  }
  if (op === "scale-up") {
    const nx = bounds.minX + (bit.x - bounds.minX) * 2;
    const ny = bounds.minY + (bit.y - bounds.minY) * 2;
    return [
      [nx, ny],
      [nx + 1, ny],
      [nx, ny + 1],
      [nx + 1, ny + 1],
    ];
  }
  if ((bit.x - bounds.minX) % 2 !== 0 || (bit.y - bounds.minY) % 2 !== 0) return [];
  return [[bounds.minX + (bit.x - bounds.minX) / 2, bounds.minY + (bit.y - bounds.minY) / 2]];
}

function mark(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  mask[y * width + x] = 1;
  return true;
}
