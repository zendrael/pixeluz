import { clamp8, hslToRgb, rgbaEqual, rgbToHsl } from "./color";
import type { ImageBuffer, Rgba } from "./types";

export type FilterKind = "invert" | "brightness" | "hue" | "outline" | "replace";

export interface FilterOptions {
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
  outline: Rgba;
  from: Rgba;
  to: Rgba;
  tolerance: number;
}

export function filterPixels(image: ImageBuffer, selection: Uint8Array | null, kind: FilterKind, options: FilterOptions): Uint8ClampedArray {
  const source = image.data;
  const output = source.slice();
  const mask = selection && selection.length === image.width * image.height ? selection : null;
  if (kind === "outline") return outline(image, output, mask, options.outline);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      if (mask && mask[y * image.width + x] !== 1) continue;
      const pixel = read(source, index);
      if (kind === "invert") {
        if (pixel.a === 0) continue;
        write(output, index, { r: 255 - pixel.r, g: 255 - pixel.g, b: 255 - pixel.b, a: pixel.a });
      } else if (kind === "brightness") {
        if (pixel.a === 0) continue;
        const [r, g, b] = brightnessContrast(pixel, options.brightness, options.contrast);
        write(output, index, { r, g, b, a: pixel.a });
      } else if (kind === "hue") {
        if (pixel.a === 0) continue;
        write(output, index, { ...shiftHue(pixel, options.hue, options.saturation), a: pixel.a });
      } else if (kind === "replace" && matches(pixel, options.from, options.tolerance)) {
        write(output, index, { ...options.to });
      }
    }
  }
  return output;
}

function outline(image: ImageBuffer, output: Uint8ClampedArray, mask: Uint8Array | null, color: Rgba): Uint8ClampedArray {
  const source = image.data;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixelIndex = y * image.width + x;
      if (mask && mask[pixelIndex] !== 1) continue;
      const index = pixelIndex * 4;
      if ((source[index + 3] ?? 0) !== 0) continue;
      if (!opaqueNeighbor(source, image.width, image.height, x, y)) continue;
      write(output, index, color);
    }
  }
  return output;
}

function opaqueNeighbor(data: Uint8ClampedArray, width: number, height: number, x: number, y: number): boolean {
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
  return neighbors.some(([nx, ny]) => {
    if (nx === undefined || ny === undefined || nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
    return (data[(ny * width + nx) * 4 + 3] ?? 0) > 0;
  });
}

function brightnessContrast(pixel: Rgba, brightness: number, contrast: number): [number, number, number] {
  const offset = (clampUnit(brightness) / 100) * 255;
  const factor = 1 + clampUnit(contrast) / 100;
  const map = (value: number) => clamp8((value - 128) * factor + 128 + offset);
  return [map(pixel.r), map(pixel.g), map(pixel.b)];
}

function shiftHue(pixel: Rgba, hue: number, saturation: number): Rgba {
  const [h, s, l] = rgbToHsl(pixel.r, pixel.g, pixel.b);
  const nextHue = h + clampUnit(hue) / 360;
  const wrapped = nextHue - Math.floor(nextHue);
  const nextSaturation = Math.max(0, Math.min(1, s * (1 + clampUnit(saturation) / 100)));
  const [r, g, b] = hslToRgb(wrapped, nextSaturation, l);
  return { r, g, b, a: pixel.a };
}

function matches(pixel: Rgba, from: Rgba, tolerance: number): boolean {
  const limit = Math.max(0, Math.min(255, Math.round(tolerance)));
  if (limit <= 0) return rgbaEqual(pixel, from);
  if (from.a === 0) return pixel.a === 0;
  if (pixel.a === 0) return false;
  return Math.max(Math.abs(pixel.r - from.r), Math.abs(pixel.g - from.g), Math.abs(pixel.b - from.b)) <= limit;
}

function clampUnit(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

function read(data: Uint8ClampedArray, index: number): Rgba {
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 0,
  };
}

function write(data: Uint8ClampedArray, index: number, color: Rgba): void {
  data[index] = color.r;
  data[index + 1] = color.g;
  data[index + 2] = color.b;
  data[index + 3] = color.a;
}
