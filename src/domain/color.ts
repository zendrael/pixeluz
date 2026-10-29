import type { Rgba } from "./types";

export const TRANSPARENT: Rgba = { r: 0, g: 0, b: 0, a: 0 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 };
export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 255 };

export function rgbaEqual(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
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
