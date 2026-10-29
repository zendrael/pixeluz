import { createImage, getPixel, setPixel } from "./image-buffer";
import type { ImageBuffer, Slice, SliceKey } from "./types";

export function sliceKeyAt(slice: Slice, frameIndex: number): SliceKey | null {
  const earlier = slice.keys.filter((key) => key.frameIndex <= frameIndex);
  const pool = earlier.length > 0 ? earlier : slice.keys;
  return pool.reduce<SliceKey | null>((best, key) => (!best || key.frameIndex >= best.frameIndex ? key : best), null);
}

export function cropImage(image: ImageBuffer, x: number, y: number, width: number, height: number): ImageBuffer {
  const out = createImage(Math.max(1, width), Math.max(1, height));
  for (let py = 0; py < out.height; py += 1) {
    for (let px = 0; px < out.width; px += 1) {
      const pixel = getPixel(image, x + px, y + py);
      if (pixel) setPixel(out, px, py, pixel);
    }
  }
  return out;
}
