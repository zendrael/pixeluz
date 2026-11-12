import type { Rgba } from "./types";

export const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 };
export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 255 };

export function rgbaEqual(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export function rgbaWithinTolerance(a: Rgba, b: Rgba, tolerance: number): boolean {
  if (tolerance <= 0) return rgbaEqual(a, b);
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance &&
    Math.abs(a.a - b.a) <= tolerance
  );
}

export function clamp8(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbaToHex(color: Rgba): string {
  const channel = (value: number) => clamp8(value).toString(16).padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function hexToRgba(hex: string, alpha = 255): Rgba {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return { r: 0, g: 0, b: 0, a: alpha };
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: alpha,
  };
}

export function rgbaToCss(color: Rgba): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${(color.a / 255).toFixed(3)})`;
}

export function luma(r: number, g: number, b: number): number {
  return clamp8((r * 77 + g * 150 + b * 29) >> 8);
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const light = (max + min) / 2;
  if (max === min) return [0, 0, light];
  const delta = max - min;
  const saturation = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return [hue / 6, saturation, light];
}

/** Hue 0–360, saturation and value 0–100. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = max === 0 ? 0 : (delta / max) * 100;
  return [hue, saturation, max * 100];
}

/** Hue 0–360, saturation and value 0–100. */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const val = Math.max(0, Math.min(100, v)) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hue < 60) [rp, gp, bp] = [c, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, c, 0];
  else if (hue < 180) [rp, gp, bp] = [0, c, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, c];
  else if (hue < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [clamp8((rp + m) * 255), clamp8((gp + m) * 255), clamp8((bp + m) * 255)];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const gray = clamp8(l * 255);
    return [gray, gray, gray];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [clamp8(hueChannel(p, q, h + 1 / 3) * 255), clamp8(hueChannel(p, q, h) * 255), clamp8(hueChannel(p, q, h - 1 / 3) * 255)];
}

function hueChannel(p: number, q: number, t: number): number {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

export function blendOver(dst: Rgba, src: Rgba): Rgba {
  const srcA = src.a / 255;
  const dstA = dst.a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0.0001) return TRANSPARENT;
  const inv = (1 - srcA) * dstA;
  return {
    r: clamp8((src.r * srcA + dst.r * inv) / outA),
    g: clamp8((src.g * srcA + dst.g * inv) / outA),
    b: clamp8((src.b * srcA + dst.b * inv) / outA),
    a: clamp8(outA * 255),
  };
}
