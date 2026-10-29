import { findCel } from "../domain/sprite";
import type { PixelChange } from "../domain/types";
import { curvePixels, linePixels } from "../render/raster";
import { paintStroke } from "../render/paint";
import { canPaint, type Tool, type ToolContext, type ToolId } from "./tool";
import { paintSettings, showStroke } from "./paint-settings";

type PlotKind = "curve" | "contour" | "polygon";

export class PlotTool implements Tool {
  readonly cursor = "crosshair";
  private knots: Array<[number, number]> = [];
  private hover: [number, number] | null = null;
  private drawing = false;
  private active: ToolContext | null = null;
  private button = 0;

  constructor(readonly id: ToolId, private readonly kind: PlotKind) {}

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    this.active = ctx;
    this.button = ctx.button;
    ctx.session.pausePlayback();
    if (this.kind === "contour") {
      ctx.session.beginStroke();
      this.drawing = true;
      this.knots = [[ctx.spriteX, ctx.spriteY]];
      this.preview(ctx);
      return;
    }
    if (ctx.clicks >= 2 && this.knots.length >= 2) {
      this.commit(ctx);
      return;
    }
    this.knots.push([ctx.spriteX, ctx.spriteY]);
    this.hover = null;
    this.preview(ctx);
  }

  onMove(ctx: ToolContext): void {
    if (this.kind === "contour") {
      if (!this.drawing) return;
      this.append(ctx.spriteX, ctx.spriteY);
      this.preview(ctx);
      return;
    }
    if (this.knots.length === 0) return;
    this.hover = [ctx.spriteX, ctx.spriteY];
    this.preview(ctx);
  }

  onUp(ctx: ToolContext): void {
    if (this.kind !== "contour" || !this.drawing) return;
    this.drawing = false;
    this.commit(ctx);
  }

  onCancel(): void {
    this.knots = [];
    this.hover = null;
    this.drawing = false;
    this.active?.session.setPreview(null);
  }

  onKey(event: KeyboardEvent): boolean {
    if (this.kind === "contour" || this.knots.length === 0 || !this.active) return false;
    if (event.key === "Enter") {
      this.commit(this.active);
      return true;
    }
    if (event.key === "Escape") {
      this.onCancel();
      return true;
    }
    if (event.key === "Backspace") {
      this.knots.pop();
      if (this.knots.length === 0) this.onCancel();
      else this.preview(this.active);
      return true;
    }
    return false;
  }

  private append(x: number, y: number): void {
    const last = this.knots[this.knots.length - 1];
    if (last && last[0] === x && last[1] === y) return;
    this.knots.push([x, y]);
  }

  private path(): Array<[number, number]> {
    const knots = this.hover ? [...this.knots, this.hover] : [...this.knots];
    if (this.kind === "curve") return curvePixels(knots);
    return trace(knots, this.kind === "polygon" || this.kind === "contour");
  }

  private preview(ctx: ToolContext): void {
    const color = this.button === 2 ? ctx.session.background : ctx.session.foreground;
    showStroke(ctx.session, this.path(), color, paintSettings(ctx.session, color, this.button, ctx.pressure, ctx.pointerType, false));
  }

  private commit(ctx: ToolContext): void {
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    const knots = this.knots;
    this.knots = [];
    this.hover = null;
    ctx.session.setPreview(null);
    if (!cel || knots.length === 0) return;
    const color = this.button === 2 ? ctx.session.background : ctx.session.foreground;
    const tracked = new Map<string, PixelChange>();
    const settings = paintSettings(ctx.session, color, this.button, ctx.pressure, ctx.pointerType, this.kind === "contour" && ctx.session.pixelPerfect);
    const points = this.kind === "curve" ? curvePixels(knots) : trace(knots, true);
    paintStroke(cel.image, points, settings, tracked);
    ctx.session.commitPixels(ctx.session.activeLayerId, ctx.session.activeFrameId, [...tracked.values()], true);
  }
}

function trace(knots: Array<[number, number]>, close: boolean): Array<[number, number]> {
  if (knots.length === 0) return [];
  const sequence = close && knots.length > 2 ? [...knots, knots[0]!] : knots;
  const points: Array<[number, number]> = [];
  for (let index = 0; index < sequence.length - 1; index++) {
    const from = sequence[index];
    const to = sequence[index + 1];
    if (!from || !to) continue;
    const segment = linePixels(from[0], from[1], to[0], to[1]);
    for (const point of index === 0 ? segment : segment.slice(1)) points.push(point);
  }
  const only = knots[0];
  if (points.length === 0 && only) points.push(only);
  return points;
}
