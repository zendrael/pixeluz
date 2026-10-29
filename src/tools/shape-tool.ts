import { findCel } from "../domain/sprite";
import type { PixelChange } from "../domain/types";
import { paintStroke } from "../render/paint";
import { canPaint, type Tool, type ToolContext, type ToolId } from "./tool";
import { paintSettings, showStroke } from "./paint-settings";

type Raster = (x0: number, y0: number, x1: number, y1: number) => Array<[number, number]>;
type Constrain = (x0: number, y0: number, x1: number, y1: number) => [number, number];

export class ShapeTool implements Tool {
  readonly cursor = "crosshair";
  private start: { x: number; y: number } | null = null;
  private active: ToolContext | null = null;
  private button = 0;
  private points: Array<[number, number]> = [];

  constructor(
    readonly id: ToolId,
    private readonly raster: Raster,
    private readonly constrain: Constrain,
  ) {}

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    this.active = ctx;
    ctx.session.pausePlayback();
    ctx.session.beginStroke();
    this.start = { x: ctx.spriteX, y: ctx.spriteY };
    this.button = ctx.button;
    this.preview(ctx);
  }

  onMove(ctx: ToolContext): void {
    if (!this.start) return;
    this.preview(ctx);
  }

  onUp(ctx: ToolContext): void {
    if (!this.start) return;
    this.preview(ctx);
    this.commit(ctx);
    this.start = null;
    this.points = [];
    ctx.session.setPreview(null);
  }

  onCancel(): void {
    this.start = null;
    this.points = [];
    this.active?.session.setPreview(null);
  }

  private preview(ctx: ToolContext): void {
    if (!this.start) return;
    let x1 = ctx.spriteX;
    let y1 = ctx.spriteY;
    if (ctx.shift) [x1, y1] = this.constrain(this.start.x, this.start.y, x1, y1);
    this.points = this.raster(this.start.x, this.start.y, x1, y1);
    const color = this.button === 2 ? ctx.session.background : ctx.session.foreground;
    showStroke(ctx.session, this.points, color, paintSettings(ctx.session, color, this.button, ctx.pressure, ctx.pointerType, false));
  }

  private commit(ctx: ToolContext): void {
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return;
    const color = this.button === 2 ? ctx.session.background : ctx.session.foreground;
    const tracked = new Map<string, PixelChange>();
    const settings = paintSettings(ctx.session, color, this.button, ctx.pressure, ctx.pointerType, false);
    paintStroke(cel.image, this.points, settings, tracked);
    ctx.session.commitPixels(ctx.session.activeLayerId, ctx.session.activeFrameId, [...tracked.values()], true);
  }
}
