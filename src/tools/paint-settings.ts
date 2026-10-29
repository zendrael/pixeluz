import { clamp8 } from "../domain/color";
import { penFactor } from "../domain/brush";
import type { EditorApi } from "./tool";
import type { PaintSettings } from "../render/paint";
import { createImage } from "../domain/image-buffer";
import { coverPoints } from "../render/paint";
import type { Rgba } from "../domain/types";

export function paintSettings(
  session: EditorApi,
  color: Rgba,
  button: number,
  pressure: number,
  pointerType: string,
  pixelPerfect: boolean,
): PaintSettings {
  const factor = penFactor(pressure, pointerType);
  return {
    width: session.doc.width,
    height: session.doc.height,
    brushSize: Math.max(1, Math.round(session.brushSize * factor)),
    brushShape: session.brushShape,
    brushAngle: session.brushAngle,
    customBrush: session.customBrush,
    symmetry: session.symmetry,
    tile: session.tile,
    selection: session.selection,
    color,
    opacity: clamp8(session.brushOpacity * factor),
    ink: session.ink,
    palette: session.doc.palette,
    button,
    pixelPerfect,
    colorMode: session.doc.colorMode,
  };
}

export function showStroke(session: EditorApi, points: Array<[number, number]>, color: Rgba, settings: PaintSettings): void {
  const overlay = createImage(session.doc.width, session.doc.height);
  const shown = color.a === 0 ? { r: 255, g: 255, b: 255, a: 160 } : color;
  for (const pixel of coverPoints(points, settings)) {
    const index = (pixel.y * overlay.width + pixel.x) * 4;
    overlay.data[index] = shown.r;
    overlay.data[index + 1] = shown.g;
    overlay.data[index + 2] = shown.b;
    overlay.data[index + 3] = shown.a;
  }
  session.setPreview(overlay);
}
