import { createImage } from "../domain/image-buffer";
import type { ImageBuffer } from "../domain/types";

export interface SheetFrame {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  durationMs: number;
}

export interface SpriteSheet {
  image: ImageBuffer;
  frames: SheetFrame[];
}

export function buildSpriteSheet(frames: Array<{ image: ImageBuffer; durationMs: number }>): SpriteSheet {
  const first = frames[0];
  if (!first) throw new Error("Sprite sheet sem quadros");
  const columns = Math.max(1, Math.ceil(Math.sqrt(frames.length)));
  const rows = Math.ceil(frames.length / columns);
  const image = createImage(first.image.width * columns, first.image.height * rows);
  const placed = frames.map((frame, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * first.image.width;
    const y = row * first.image.height;
    blit(image, frame.image, x, y);
    return { index, x, y, width: frame.image.width, height: frame.image.height, durationMs: frame.durationMs };
  });
  return { image, frames: placed };
}

export function atlasJson(imageName: string, sheet: SpriteSheet): string {
  return JSON.stringify({
    image: imageName,
    size: { width: sheet.image.width, height: sheet.image.height },
    frames: sheet.frames,
  });
}

function blit(target: ImageBuffer, source: ImageBuffer, ox: number, oy: number): void {
  for (let y = 0; y < source.height; y += 1) {
    const dy = y + oy;
    if (dy < 0 || dy >= target.height) continue;
    for (let x = 0; x < source.width; x += 1) {
      const dx = x + ox;
      if (dx < 0 || dx >= target.width) continue;
      const from = (y * source.width + x) * 4;
      const to = (dy * target.width + dx) * 4;
      target.data[to] = source.data[from] ?? 0;
      target.data[to + 1] = source.data[from + 1] ?? 0;
      target.data[to + 2] = source.data[from + 2] ?? 0;
      target.data[to + 3] = source.data[from + 3] ?? 0;
    }
  }
}
