import { blendOver, rgbaEqual } from "./color";
import type { InkId } from "./draw-options";
import type { Rgba } from "./types";

export function resolveInk(dst: Rgba, src: Rgba, ink: InkId, palette: Rgba[], button: number): Rgba | null {
  if (ink === "shading") return shade(dst, palette, button);
  if (ink === "lock-alpha") {
    if (dst.a === 0 || src.a === 0) return null;
    const mixed = blendOver(dst, src);
    return { r: mixed.r, g: mixed.g, b: mixed.b, a: dst.a };
  }
  if (ink === "alpha") return src.a === 0 ? null : blendOver(dst, src);
  if (ink === "copy") return src;
  if (src.a === 0) return null;
  return src;
}

function shade(dst: Rgba, palette: Rgba[], button: number): Rgba | null {
  if (palette.length === 0) return null;
  const index = palette.findIndex((color) => rgbaEqual(color, dst));
  if (index < 0) return palette[button === 2 ? palette.length - 1 : 0] ?? null;
  const next = button === 2 ? Math.max(0, index - 1) : Math.min(palette.length - 1, index + 1);
  const color = palette[next];
  return color ? { ...color } : null;
}
