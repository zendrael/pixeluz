import type { ImageBuffer, PixelChange, Rgba } from "./types";
import { rgbaEqual } from "./color";

export function createImage(width: number, height: number): ImageBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneImage(image: ImageBuffer): ImageBuffer {
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

export function getPixel(image: ImageBuffer, x: number, y: number): Rgba | null {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const index = (y * image.width + x) * 4;
  return {
    r: image.data[index] ?? 0,
    g: image.data[index + 1] ?? 0,
    b: image.data[index + 2] ?? 0,
    a: image.data[index + 3] ?? 0,
  };
}

export function setPixel(image: ImageBuffer, x: number, y: number, color: Rgba): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const index = (y * image.width + x) * 4;
  image.data[index] = color.r;
  image.data[index + 1] = color.g;
  image.data[index + 2] = color.b;
  image.data[index + 3] = color.a;
}

export function restoreSnapshot(image: ImageBuffer, snapshot: Uint8ClampedArray): void {
  image.data.set(snapshot);
}

export function diffSnapshot(image: ImageBuffer, snapshot: Uint8ClampedArray): PixelChange[] {
  const changes: PixelChange[] = [];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = (y * image.width + x) * 4;
      const before = {
        r: snapshot[index] ?? 0,
        g: snapshot[index + 1] ?? 0,
        b: snapshot[index + 2] ?? 0,
        a: snapshot[index + 3] ?? 0,
      };
      const after = getPixel(image, x, y);
      if (!after || rgbaEqual(before, after)) continue;
      changes.push({ x, y, before, after: { ...after } });
    }
  }
  return changes;
}

export function paintPixelsTracked(
  image: ImageBuffer,
  pixels: Array<[number, number]>,
  color: Rgba,
  existing: Map<string, PixelChange>,
): void {
  for (const [x, y] of pixels) {
    const current = getPixel(image, x, y);
    if (!current) continue;
    const key = `${x},${y}`;
    const previous = existing.get(key);
    const before = previous?.before ?? current;
    if (rgbaEqual(current, color)) {
      if (previous && rgbaEqual(before, color)) existing.delete(key);
      continue;
    }
    setPixel(image, x, y, color);
    if (rgbaEqual(before, color)) existing.delete(key);
    else existing.set(key, { x, y, before: { ...before }, after: { ...color } });
  }
}
