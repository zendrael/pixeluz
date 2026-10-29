import { clamp8, hslToRgb, rgbToHsl } from "../domain/color";
import type { BlendMode } from "../domain/types";

export function blendRgb(mode: BlendMode, sr: number, sg: number, sb: number, dr: number, dg: number, db: number): [number, number, number] {
  if (mode === "normal") return [sr, sg, sb];
  if (mode === "hue" || mode === "saturation" || mode === "color" || mode === "luminosity") {
    return blendHsl(mode, sr, sg, sb, dr, dg, db);
  }
  return [channel(mode, sr, dr), channel(mode, sg, dg), channel(mode, sb, db)];
}

function channel(mode: BlendMode, src: number, dst: number): number {
  const s = src / 255;
  const d = dst / 255;
  let value = s;
  if (mode === "darken") value = Math.min(s, d);
  else if (mode === "multiply") value = s * d;
  else if (mode === "color-burn") value = s <= 0 ? 0 : 1 - (1 - d) / s;
  else if (mode === "lighten") value = Math.max(s, d);
  else if (mode === "screen") value = 1 - (1 - s) * (1 - d);
  else if (mode === "color-dodge") value = s >= 1 ? 1 : d / (1 - s);
  else if (mode === "addition") value = s + d;
  else if (mode === "overlay") value = d < 0.5 ? 2 * s * d : 1 - 2 * (1 - s) * (1 - d);
  else if (mode === "soft-light") value = (1 - 2 * s) * d * d + 2 * s * d;
  else if (mode === "hard-light") value = s < 0.5 ? 2 * s * d : 1 - 2 * (1 - s) * (1 - d);
  else if (mode === "difference") value = Math.abs(s - d);
  else if (mode === "exclusion") value = s + d - 2 * s * d;
  else if (mode === "subtract") value = d - s;
  else if (mode === "divide") value = s <= 0 ? 1 : d / s;
  return clamp8(value * 255);
}

function blendHsl(mode: BlendMode, sr: number, sg: number, sb: number, dr: number, dg: number, db: number): [number, number, number] {
  const src = rgbToHsl(sr, sg, sb);
  const dst = rgbToHsl(dr, dg, db);
  if (mode === "hue") return hslToRgb(src[0], dst[1], dst[2]);
  if (mode === "saturation") return hslToRgb(dst[0], src[1], dst[2]);
  if (mode === "color") return hslToRgb(src[0], src[1], dst[2]);
  return hslToRgb(dst[0], dst[1], src[2]);
}
