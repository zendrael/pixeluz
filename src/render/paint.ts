import { clamp8 } from "../domain/color";
import { fitColor } from "../domain/quantize";
import { brushStamps } from "../domain/brush";
import type { BrushShape, GradientKind, InkId, SymmetryMode, TileMode } from "../domain/draw-options";
import { resolveInk } from "../domain/ink";
import { getPixel, setPixel } from "../domain/image-buffer";
import { placePixel, symmetricPoints } from "../domain/symmetry";
import type { ColorMode, ImageBuffer, PixelChange, Rgba } from "../domain/types";
import { bayerValue } from "./bayer";
import { pixelPerfectPoints } from "./pixel-perfect";

export interface CoverSettings {
  width: number;
  height: number;
  brushSize: number;
  brushShape: BrushShape;
  brushAngle: number;
  customBrush: ImageBuffer | null;
  symmetry: SymmetryMode;
  tile: TileMode;
  selection: Uint8Array | null;
}

export interface PaintSettings extends CoverSettings {
  color: Rgba;
  opacity: number;
  ink: InkId;
  palette: Rgba[];
  button: number;
  pixelPerfect: boolean;
  colorMode?: ColorMode;
}

export interface Coverage {
  x: number;
  y: number;
  alpha: number;
}

export function coverPoints(points: Array<[number, number]>, settings: CoverSettings): Coverage[] {
  const stamps = brushStamps(settings.brushShape, settings.brushSize, settings.brushAngle, settings.customBrush);
  const seen = new Map<string, Coverage>();
  for (const [x, y] of points) {
    for (const [sx, sy] of symmetricPoints(x, y, settings.width, settings.height, settings.symmetry)) {
      for (const stamp of stamps) writeCoverage(seen, settings, sx + stamp.x, sy + stamp.y, stamp.alpha);
    }
  }
  return [...seen.values()];
}

export function paintStroke(
  image: ImageBuffer,
  points: Array<[number, number]>,
  settings: PaintSettings,
  existing: Map<string, PixelChange>,
): void {
  const centers =
    settings.pixelPerfect && settings.brushSize <= 1 && settings.brushShape === "square"
      ? pixelPerfectPoints(points)
      : points;
  for (const pixel of coverPoints(centers, settings)) {
    const key = `${pixel.x},${pixel.y}`;
    if (existing.has(key)) continue;
    const before = getPixel(image, pixel.x, pixel.y);
    if (!before) continue;
    const src = { ...settings.color, a: clamp8((settings.color.a * settings.opacity * pixel.alpha) / (255 * 255)) };
    const resolved = resolveInk(before, src, settings.ink, settings.palette, settings.button);
    const after = resolved ? fitColor(resolved, settings.colorMode ?? "rgba", settings.palette) : null;
    if (!after || (after.r === before.r && after.g === before.g && after.b === before.b && after.a === before.a)) continue;
    setPixel(image, pixel.x, pixel.y, after);
    existing.set(key, { x: pixel.x, y: pixel.y, before: { ...before }, after: { ...after } });
  }
}

export function paintGradient(
  image: ImageBuffer,
  snapshot: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fg: Rgba,
  bg: Rgba,
  kind: GradientKind,
  bayer: 2 | 4 | 8,
  selection: Uint8Array | null,
  colorMode: ColorMode = "rgba",
  palette: Rgba[] = [],
): void {
  image.data.set(snapshot);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (selection && selection.length === image.width * image.height && selection[y * image.width + x] !== 1) continue;
      const t = gradientT(x, y, x0, y0, dx, dy, length, kind);
      const useFg = t * (bayer * bayer) > bayerValue(bayer, x, y);
      const color = fitColor(useFg ? fg : bg, colorMode, palette);
      setPixel(image, x, y, color);
    }
  }
}

function gradientT(
  x: number,
  y: number,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  length: number,
  kind: GradientKind,
): number {
  if (length === 0) return 1;
  if (kind === "radial") return Math.max(0, Math.min(1, Math.hypot(x - x0, y - y0) / length));
  const dot = (x - x0) * dx + (y - y0) * dy;
  return Math.max(0, Math.min(1, dot / (length * length)));
}

function writeCoverage(seen: Map<string, Coverage>, settings: CoverSettings, x: number, y: number, alpha: number): void {
  const placed = placePixel(x, y, settings.width, settings.height, settings.tile);
  if (!placed) return;
  const [px, py] = placed;
  if (!allows(settings, px, py)) return;
  const key = `${px},${py}`;
  const previous = seen.get(key);
  if (!previous || previous.alpha < alpha) seen.set(key, { x: px, y: py, alpha });
}

function allows(settings: CoverSettings, x: number, y: number): boolean {
  const selection = settings.selection;
  if (!selection || selection.length !== settings.width * settings.height) return true;
  return selection[y * settings.width + x] === 1;
}
