import { createImage, getPixel, setPixel } from "./image-buffer";
import type { ImageBuffer, Rgba } from "./types";

export function rotsprite(image: ImageBuffer, degrees: number): ImageBuffer {
  const turns = ((degrees % 360) + 360) % 360;
  if (turns === 0) return { width: image.width, height: image.height, data: image.data.slice() };
  let scaled = image;
  for (let pass = 0; pass < 3; pass += 1) scaled = scale2x(scaled);
  return downsample(rotateNearest(scaled, turns), 8);
}

export function scale2x(image: ImageBuffer): ImageBuffer {
  const out = createImage(image.width * 2, image.height * 2);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = at(image, x, y);
      if (!pixel) continue;
      const up = at(image, x, y - 1);
      const down = at(image, x, y + 1);
      const left = at(image, x - 1, y);
      const right = at(image, x + 1, y);
      let e0 = pixel;
      let e1 = pixel;
      let e2 = pixel;
      let e3 = pixel;
      if (!same(up, down) && !same(left, right)) {
        e0 = same(left, up) && left ? left : pixel;
        e1 = same(up, right) && right ? right : pixel;
        e2 = same(left, down) && left ? left : pixel;
        e3 = same(down, right) && right ? right : pixel;
      }
      setPixel(out, x * 2, y * 2, e0);
      setPixel(out, x * 2 + 1, y * 2, e1);
      setPixel(out, x * 2, y * 2 + 1, e2);
      setPixel(out, x * 2 + 1, y * 2 + 1, e3);
    }
  }
  return out;
}

function rotateNearest(image: ImageBuffer, degrees: number): ImageBuffer {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = (image.width - 1) / 2;
  const cy = (image.height - 1) / 2;
  const corners = [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1],
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of corners) {
    if (x === undefined || y === undefined) continue;
    const rx = cos * (x - cx) - sin * (y - cy);
    const ry = sin * (x - cx) + cos * (y - cy);
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  const width = Math.max(1, Math.ceil(maxX - minX + 1));
  const height = Math.max(1, Math.ceil(maxY - minY + 1));
  const out = createImage(width, height);
  const ocx = (width - 1) / 2;
  const ocy = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - ocx;
      const dy = y - ocy;
      const sx = Math.round(cos * dx + sin * dy + cx);
      const sy = Math.round(-sin * dx + cos * dy + cy);
      const pixel = at(image, sx, sy);
      if (pixel) setPixel(out, x, y, pixel);
    }
  }
  return out;
}

function downsample(image: ImageBuffer, factor: number): ImageBuffer {
  const width = Math.max(1, Math.ceil(image.width / factor));
  const height = Math.max(1, Math.ceil(image.height / factor));
  const out = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(image.width - 1, x * factor + Math.floor(factor / 2));
      const sy = Math.min(image.height - 1, y * factor + Math.floor(factor / 2));
      const pixel = at(image, sx, sy);
      if (pixel) setPixel(out, x, y, pixel);
    }
  }
  return out;
}

function at(image: ImageBuffer, x: number, y: number): Rgba | null {
  return getPixel(image, x, y);
}

function same(a: Rgba | null, b: Rgba | null): boolean {
  if (!a || !b) return a === b;
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}
