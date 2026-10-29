import { diffSnapshot, restoreSnapshot } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import { paintGradient } from "../render/paint";
import { canPaint, type Tool, type ToolContext } from "./tool";

export class GradientTool implements Tool {
  readonly id = "gradient" as const;
  readonly cursor = "crosshair";
  private start: { x: number; y: number } | null = null;
  private baseline: Uint8ClampedArray | null = null;
  private button = 0;
  private active: ToolContext | null = null;

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return;
    this.active = ctx;
    this.button = ctx.button;
    this.start = { x: ctx.spriteX, y: ctx.spriteY };
    this.baseline = cel.image.data.slice();
    ctx.session.pausePlayback();
    ctx.session.beginStroke();
    this.apply(ctx);
  }

  onMove(ctx: ToolContext): void {
    if (!this.start) return;
    this.apply(ctx);
  }

  onUp(ctx: ToolContext): void {
    if (!this.start || !this.baseline) return;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    this.apply(ctx);
    if (cel && this.baseline) {
      const changes = diffSnapshot(cel.image, this.baseline);
      ctx.session.commitPixels(ctx.session.activeLayerId, ctx.session.activeFrameId, changes, true);
    }
    this.clear();
  }

  onCancel(): void {
    const ctx = this.active;
    if (!ctx || !this.baseline) {
      this.clear();
      return;
    }
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (cel) restoreSnapshot(cel.image, this.baseline);
    ctx.session.invalidateCanvas();
    this.clear();
  }

  private apply(ctx: ToolContext): void {
    if (!this.start || !this.baseline) return;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return;
    const fg = this.button === 2 ? ctx.session.background : ctx.session.foreground;
    const bg = this.button === 2 ? ctx.session.foreground : ctx.session.background;
    paintGradient(
      cel.image,
      this.baseline,
      this.start.x,
      this.start.y,
      ctx.spriteX,
      ctx.spriteY,
      fg,
      bg,
      ctx.session.gradientKind,
      ctx.session.bayer,
      ctx.session.selection,
      ctx.session.doc.colorMode,
      ctx.session.doc.palette,
    );
    ctx.session.invalidateCanvas();
  }

  private clear(): void {
    this.start = null;
    this.baseline = null;
    this.active = null;
  }
}
