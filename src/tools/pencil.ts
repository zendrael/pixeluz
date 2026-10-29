import { TRANSPARENT } from "../domain/color";
import { findCel } from "../domain/sprite";
import { restoreSnapshot } from "../domain/image-buffer";
import type { PixelChange, Rgba } from "../domain/types";
import { linePixels } from "../render/raster";
import { paintStroke } from "../render/paint";
import { canPaint, type Tool, type ToolContext, type ToolId } from "./tool";
import { paintSettings } from "./paint-settings";

export class PencilTool implements Tool {
  readonly id: ToolId;
  readonly cursor = "crosshair";
  private drawing = false;
  private button = 0;
  private active: ToolContext | null = null;
  private last: { x: number; y: number } | null = null;
  private anchor: { x: number; y: number } | null = null;
  private raw: Array<[number, number]> = [];
  private baseline: Uint8ClampedArray | null = null;
  private tiling = false;
  private readonly changes = new Map<string, PixelChange>();

  constructor(private readonly mode: "paint" | "erase") {
    this.id = mode === "erase" ? "eraser" : "pencil";
  }

  onDown(ctx: ToolContext): void {
    if (ctx.session.activeLayerIsTilemap()) {
      this.startTile(ctx);
      return;
    }
    if (!canPaint(ctx.session)) return;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return;
    this.active = ctx;
    ctx.session.pausePlayback();
    ctx.session.beginStroke();
    this.drawing = true;
    this.button = ctx.button;
    this.baseline = cel.image.data.slice();
    this.changes.clear();
    this.raw = ctx.shift && this.anchor ? linePixels(this.anchor.x, this.anchor.y, ctx.spriteX, ctx.spriteY) : [[ctx.spriteX, ctx.spriteY]];
    this.last = { x: ctx.spriteX, y: ctx.spriteY };
    this.anchor = { x: ctx.spriteX, y: ctx.spriteY };
    this.replay(ctx);
  }

  private startTile(ctx: ToolContext): void {
    this.tiling = true;
    this.active = ctx;
    ctx.session.pausePlayback();
    ctx.session.beginStroke();
    ctx.session.beginTileStroke();
    this.drawing = true;
    this.button = ctx.button;
    this.changes.clear();
    this.raw = ctx.shift && this.anchor ? linePixels(this.anchor.x, this.anchor.y, ctx.spriteX, ctx.spriteY) : [[ctx.spriteX, ctx.spriteY]];
    this.last = { x: ctx.spriteX, y: ctx.spriteY };
    this.anchor = { x: ctx.spriteX, y: ctx.spriteY };
    ctx.session.replayTileStroke(this.raw, this.tileColor(ctx));
  }

  onMove(ctx: ToolContext): void {
    if (!this.drawing || !this.last) return;
    const segment = linePixels(this.last.x, this.last.y, ctx.spriteX, ctx.spriteY);
    for (const point of segment) {
      const last = this.raw[this.raw.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) continue;
      this.raw.push(point);
    }
    this.last = { x: ctx.spriteX, y: ctx.spriteY };
    this.anchor = { x: ctx.spriteX, y: ctx.spriteY };
    if (this.tiling) ctx.session.replayTileStroke(this.raw, this.tileColor(ctx));
    else this.replay(ctx);
  }

  onUp(ctx: ToolContext): void {
    this.finish(ctx);
  }

  onCancel(): void {
    if (this.active) this.finish(this.active);
  }

  private finish(ctx: ToolContext): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    if (this.tiling) {
      this.tiling = false;
      ctx.session.commitTileStroke();
      this.raw = [];
      return;
    }
    ctx.session.commitPixels(ctx.session.activeLayerId, ctx.session.activeFrameId, [...this.changes.values()], true);
    this.changes.clear();
    this.raw = [];
    this.baseline = null;
  }

  private tileColor(ctx: ToolContext): Rgba {
    if (this.mode === "erase" || this.button === 2) return TRANSPARENT;
    return ctx.session.foreground;
  }

  private color(ctx: ToolContext): Rgba {
    if (this.mode === "erase") return TRANSPARENT;
    return this.button === 2 ? ctx.session.background : ctx.session.foreground;
  }

  private replay(ctx: ToolContext): void {
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel || !this.baseline) return;
    restoreSnapshot(cel.image, this.baseline);
    this.changes.clear();
    const settings = paintSettings(ctx.session, this.color(ctx), this.button, ctx.pressure, ctx.pointerType, ctx.session.pixelPerfect);
    if (this.mode === "erase") settings.ink = "copy";
    paintStroke(cel.image, this.raw, settings, this.changes);
    ctx.session.invalidateCanvas();
  }
}
