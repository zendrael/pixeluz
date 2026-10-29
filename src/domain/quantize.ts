import { luma } from "./color";
import type { ColorMode, ImageBuffer, Rgba } from "./types";

const MAX_COLORS = 256;

export function fitColor(color: Rgba, mode: ColorMode, palette: Rgba[]): Rgba {
  if (color.a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  if (mode === "grayscale") {
    const gray = luma(color.r, color.g, color.b);
    return { r: gray, g: gray, b: gray, a: color.a };
  }
  if (mode !== "indexed") return { r: color.r, g: color.g, b: color.b, a: color.a };
  const nearest = nearestOpaque(color, palette);
  return nearest ? { r: nearest.r, g: nearest.g, b: nearest.b, a: color.a } : { r: color.r, g: color.g, b: color.b, a: color.a };
}

export function convertColors(images: ImageBuffer[], mode: ColorMode, palette: Rgba[]): { palette: Rgba[]; pixels: Uint8ClampedArray[] } {
  if (mode === "rgba") {
    return {
      palette: palette.length > 0 ? palette.map((color) => ({ ...color })) : [{ r: 0, g: 0, b: 0, a: 255 }],
      pixels: images.map((image) => image.data.slice()),
    };
  }
  if (mode === "grayscale") {
    const pixels = images.map((image) => grayPixels(image));
    return { palette: grayRamp(pixels), pixels };
  }
  const nextPalette = quantizePalette(images, MAX_COLORS);
  return { palette: nextPalette, pixels: images.map((image) => indexedPixels(image, nextPalette)) };
}

export function quantizePalette(images: ImageBuffer[], maxColors: number): Rgba[] {
  const counts = new Map<string, Sample>();
  for (const image of images) collect(image, counts);
  const samples = [...counts.values()];
  if (samples.length === 0) return [{ r: 0, g: 0, b: 0, a: 255 }];
  samples.sort((a, b) => b.n - a.n || a.r - b.r || a.g - b.g || a.b - b.b);
  if (samples.length <= maxColors) return samples.map(sampleColor);
  return medianCut(samples, maxColors).map(sampleColor);
}

export function nearestOpaque(color: Rgba, palette: Rgba[]): Rgba | null {
  let best: Rgba | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const entry of palette) {
    if (entry.a === 0) continue;
    const dist = (entry.r - color.r) ** 2 + (entry.g - color.g) ** 2 + (entry.b - color.b) ** 2;
    if (dist < bestDist) {
      best = entry;
      bestDist = dist;
    }
  }
  return best;
}

interface Sample {
  r: number;
  g: number;
  b: number;
  n: number;
}

function sampleColor(sample: Sample): Rgba {
  return { r: sample.r, g: sample.g, b: sample.b, a: 255 };
}

function collect(image: ImageBuffer, counts: Map<string, Sample>): void {
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) === 0) continue;
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    const key = `${r},${g},${b}`;
    const sample = counts.get(key);
    if (sample) sample.n += 1;
    else counts.set(key, { r, g, b, n: 1 });
  }
}

function medianCut(samples: Sample[], maxColors: number): Sample[] {
  let boxes = [samples];
  while (boxes.length < maxColors) {
    let best = -1;
    let bestSpan = 0;
    let bestChannel: "r" | "g" | "b" = "r";
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (!box || box.length < 2) continue;
      const range = channelRange(box);
      if (range.span > bestSpan) {
        best = index;
        bestSpan = range.span;
        bestChannel = range.channel;
      }
    }
    if (best < 0) break;
    const box = boxes[best];
    if (!box) break;
    const sorted = [...box].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const total = sorted.reduce((sum, sample) => sum + sample.n, 0);
    let seen = 0;
    let split = 1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      seen += sorted[index]?.n ?? 0;
      if (seen >= total / 2) {
        split = index + 1;
        break;
      }
    }
    boxes = [...boxes.slice(0, best), sorted.slice(0, split), sorted.slice(split), ...boxes.slice(best + 1)];
  }
  return boxes.map(average);
}

function channelRange(box: Sample[]): { channel: "r" | "g" | "b"; span: number } {
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;
  for (const sample of box) {
    minR = Math.min(minR, sample.r);
    maxR = Math.max(maxR, sample.r);
    minG = Math.min(minG, sample.g);
    maxG = Math.max(maxG, sample.g);
    minB = Math.min(minB, sample.b);
    maxB = Math.max(maxB, sample.b);
  }
  const spans = [
    { channel: "r" as const, span: maxR - minR },
    { channel: "g" as const, span: maxG - minG },
    { channel: "b" as const, span: maxB - minB },
  ];
  return spans.sort((a, b) => b.span - a.span)[0] ?? { channel: "r", span: 0 };
}

function average(box: Sample[]): Sample {
  let weight = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const sample of box) {
    weight += sample.n;
    r += sample.r * sample.n;
    g += sample.g * sample.n;
    b += sample.b * sample.n;
  }
  if (weight === 0) return { r: 0, g: 0, b: 0, n: 1 };
  return { r: Math.round(r / weight), g: Math.round(g / weight), b: Math.round(b / weight), n: weight };
}

function grayPixels(image: ImageBuffer): Uint8ClampedArray {
  const data = image.data.slice();
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) === 0) continue;
    const gray = luma(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0);
    data[index] = gray;
    data[index + 1] = gray;
    data[index + 2] = gray;
  }
  return data;
}

function grayRamp(pixels: Uint8ClampedArray[]): Rgba[] {
  const levels = new Set<number>();
  for (const data of pixels) {
    for (let index = 0; index < data.length; index += 4) {
      if ((data[index + 3] ?? 0) === 0) continue;
      levels.add(data[index] ?? 0);
    }
  }
  const sorted = [...levels].sort((a, b) => a - b);
  const chosen = sorted.length > 0 && sorted.length <= 32 ? sorted : Array.from({ length: 16 }, (_, index) => Math.round((index * 255) / 15));
  return chosen.map((gray) => ({ r: gray, g: gray, b: gray, a: 255 }));
}

function indexedPixels(image: ImageBuffer, palette: Rgba[]): Uint8ClampedArray {
  const data = image.data.slice();
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;
    if (alpha === 0) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      continue;
    }
    const nearest = nearestOpaque({ r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0, a: alpha }, palette);
    if (!nearest) continue;
    data[index] = nearest.r;
    data[index + 1] = nearest.g;
    data[index + 2] = nearest.b;
  }
  return data;
}
