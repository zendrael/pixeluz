import { blendOver } from "../domain/color";
import { createImage, getPixel, setPixel } from "../domain/image-buffer";
import type { ImageBuffer, Rgba } from "../domain/types";

const SCALES = new Set([1, 2, 4, 8]);

export interface VideoFrame {
  image: ImageBuffer;
  durationMs: number;
}

export function prepareVideoFrames(
  frames: VideoFrame[],
  options: { scale: number; background: Rgba },
): VideoFrame[] {
  if (!SCALES.has(options.scale)) throw new Error("Escala de vídeo inválida");
  const matte = { ...options.background, a: 255 };
  return frames.map((frame) => ({
    image: scaleOpaque(frame.image, options.scale, matte),
    durationMs: frame.durationMs,
  }));
}

function scaleOpaque(source: ImageBuffer, scale: number, matte: Rgba): ImageBuffer {
  const width = even(source.width * scale);
  const height = even(source.height * scale);
  const image = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const pixel = getPixel(source, sx, sy);
      const color = pixel ? { ...blendOver(matte, pixel), a: 255 } : matte;
      setPixel(image, x, y, color);
    }
  }
  return image;
}

function even(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}
