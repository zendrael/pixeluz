import { createImage, getPixel, setPixel } from "./image-buffer";
import { rotsprite } from "./rotsprite";
import { maskBounds } from "./selection";
import type { ImageBuffer } from "./types";

export function scaleSelectionNearest(
  image: ImageBuffer,
  mask: Uint8Array,
  factor: number,
): { image: ImageBuffer; mask: Uint8Array; x: number; y: number } | null {
  const bounds = maskBounds(mask, image.width, image.height);
  if (!bounds) return null;
  const srcW = bounds.maxX - bounds.minX + 1;
  const srcH = bounds.maxY - bounds.minY + 1;
  const dstW = Math.max(1, Math.round(srcW * factor));
  const dstH = Math.max(1, Math.round(srcH * factor));
  const nextImage = createImage(dstW, dstH);
  const nextMask = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y += 1) {
    for (let x = 0; x < dstW; x += 1) {
      const sx = bounds.minX + Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      const sy = bounds.minY + Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
      if (mask[sy * image.width + sx] !== 1) continue;
      const color = getPixel(image, sx, sy);
      if (!color) continue;
      setPixel(nextImage, x, y, color);
      nextMask[y * dstW + x] = 1;
    }
  }
  if (!nextMask.some((bit) => bit === 1)) return null;
  return { image: nextImage, mask: nextMask, x: bounds.minX, y: bounds.minY };
}

export function rotateSelectionNearest(
  image: ImageBuffer,
  mask: Uint8Array,
  degrees: number,
): { image: ImageBuffer; mask: Uint8Array; x: number; y: number } | null {
  const bounds = maskBounds(mask, image.width, image.height);
  if (!bounds) return null;
  const srcW = bounds.maxX - bounds.minX + 1;
  const srcH = bounds.maxY - bounds.minY + 1;
  const crop = createImage(srcW, srcH);
  const cropMask = new Uint8Array(srcW * srcH);
  for (let y = 0; y < srcH; y += 1) {
    for (let x = 0; x < srcW; x += 1) {
      if (mask[(bounds.minY + y) * image.width + bounds.minX + x] !== 1) continue;
      cropMask[y * srcW + x] = 1;
      const color = getPixel(image, bounds.minX + x, bounds.minY + y);
      if (color) setPixel(crop, x, y, color);
    }
  }
  const rotated = rotsprite(crop, degrees);
  const nextMask = new Uint8Array(rotated.width * rotated.height);
  for (let y = 0; y < rotated.height; y += 1) {
    for (let x = 0; x < rotated.width; x += 1) {
      const color = getPixel(rotated, x, y);
      if (!color || color.a === 0) continue;
      nextMask[y * rotated.width + x] = 1;
    }
  }
  if (!nextMask.some((bit) => bit === 1)) return null;
  const cx = bounds.minX + srcW / 2;
  const cy = bounds.minY + srcH / 2;
  return {
    image: rotated,
    mask: nextMask,
    x: Math.round(cx - rotated.width / 2),
    y: Math.round(cy - rotated.height / 2),
  };
}
