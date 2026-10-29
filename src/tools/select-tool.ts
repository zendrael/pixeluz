import type { SelectMode } from "../domain/draw-options";
import { findCel } from "../domain/sprite";
import { placePixel } from "../domain/symmetry";
import { combineMasks, selectionMode } from "../domain/selection";
import { fillEllipse, fillPolygon, fillRectangle, floodMask } from "../render/raster";
import type { Tool, ToolContext, ToolId } from "./tool";

type SelectKind = "rect" | "ellipse" | "lasso" | "polygon" | "wand";

export class SelectTool implements Tool {
  readonly cursor = "crosshair";
  private start: { x: number; y: number } | null = null;
  private points: Array<[number, number]> = [];
  private before: Uint8Array | null = null;
  private mode: SelectMode = "replace";
  private active: ToolContext | null = null;

  constructor(readonly id: ToolId, private readonly kind: SelectKind) {}

  onDown(ctx: ToolContext): void {
    this.active = ctx;
    ctx.session.pausePlayback();
    if (this.kind === "polygon" && this.points.length > 0) {
      if (ctx.clicks >= 2 && this.points.length >= 3) {
        this.finish(ctx);
        return;
      }
      this.points.push(this.clamp(ctx));
      this.apply(ctx, fillPolygon(this.points));
      return;
    }
    this.mode = selectionMode(ctx.shift, ctx.alt, ctx.session.selectMode);
    this.before = ctx.session.selection ? new Uint8Array(ctx.session.selection) : null;
    if (this.kind === "wand") {
      this.wand(ctx);
      return;
    }
    const point = this.clamp(ctx);
    if (this.kind === "polygon") {
      this.points.push(point);
      this.apply(ctx, fillPolygon(this.points));
      return;
    }
    this.start = { x: point[0], y: point[1] };
    this.points = [point];
    this.apply(ctx, this.shape(ctx));
  }

  onMove(ctx: ToolContext): void {
    if (this.kind === "wand") return;
    if (this.kind === "polygon") {
      if (this.points.length === 0) return;
      const hover = [...this.points, this.clamp(ctx)];
      this.apply(ctx, fillPolygon(hover));
      return;
    }
    if (!this.start) return;
    if (this.kind === "lasso") this.points.push(this.clamp(ctx));
    this.apply(ctx, this.shape(ctx));
  }

  onUp(ctx: ToolContext): void {
    if (this.kind === "polygon" || this.kind === "wand") return;
    if (!this.start) return;
    this.apply(ctx, this.shape(ctx));
    this.start = null;
    this.points = [];
  }

  onCancel(): void {
    if ((this.start || this.points.length > 0) && this.active) this.active.session.setSelection(this.before);
    this.start = null;
    this.points = [];
    this.before = null;
  }

  onKey(event: KeyboardEvent): boolean {
    if (this.kind !== "polygon" || this.points.length === 0 || !this.active) return false;
    if (event.key === "Enter" && this.points.length >= 3) {
      this.finish(this.active);
      return true;
    }
    if (event.key === "Escape") {
      this.onCancel();
      return true;
    }
    if (event.key === "Backspace") {
      this.points.pop();
      if (this.points.length === 0) this.onCancel();
      else this.apply(this.active, fillPolygon(this.points));
      return true;
    }
    return false;
  }

  private finish(ctx: ToolContext): void {
    this.apply(ctx, fillPolygon(this.points));
    this.points = [];
    this.start = null;
  }

  private wand(ctx: ToolContext): void {
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return;
    const placed = placePixel(ctx.spriteX, ctx.spriteY, cel.image.width, cel.image.height, ctx.session.tile);
    if (!placed) return;
    const mask = floodMask(cel.image, placed[0], placed[1]);
    if (!mask) return;
    ctx.session.setSelection(combineMasks(this.before, mask, this.mode));
  }

  private shape(ctx: ToolContext): Array<[number, number]> {
    if (!this.start) return [];
    const end = this.clamp(ctx);
    if (this.kind === "lasso") return fillPolygon(this.points);
    if (this.kind === "ellipse") return fillEllipse(this.start.x, this.start.y, end[0], end[1]);
    return fillRectangle(this.start.x, this.start.y, end[0], end[1]);
  }

  private apply(ctx: ToolContext, points: Array<[number, number]>): void {
    const { width, height } = ctx.session.doc;
    const incoming = new Uint8Array(width * height);
    for (const [x, y] of points) {
      const placed = placePixel(x, y, width, height, ctx.session.tile);
      if (!placed) continue;
      incoming[placed[1] * width + placed[0]] = 1;
    }
    ctx.session.setSelection(combineMasks(this.before, incoming, this.mode));
  }

  private clamp(ctx: ToolContext): [number, number] {
    const { width, height } = ctx.session.doc;
    const tile = ctx.session.tile;
    return [axis(ctx.spriteX, width, tile === "x" || tile === "both"), axis(ctx.spriteY, height, tile === "y" || tile === "both")];
  }
}

function axis(value: number, size: number, tiled: boolean): number {
  const min = tiled ? -size : 0;
  const max = tiled ? size * 2 - 1 : size - 1;
  return Math.max(min, Math.min(max, value));
}
