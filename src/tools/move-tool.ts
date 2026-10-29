import { diffSnapshot, restoreSnapshot } from "../domain/image-buffer";
import { editSelection } from "../domain/selection-edit";
import { findCel } from "../domain/sprite";
import { canPaint, type Tool, type ToolContext } from "./tool";

export class MoveTool implements Tool {
  readonly id = "move" as const;
  readonly cursor = "move";
  private origin: { x: number; y: number } | null = null;
  private baseline: Uint8ClampedArray | null = null;
  private mask: Uint8Array | null = null;
  private copy = false;
  private active: ToolContext | null = null;

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    const selection = ctx.session.selection;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!selection || !cel || !contains(selection, cel.image.width, cel.image.height, ctx.spriteX, ctx.spriteY)) return;
    this.active = ctx;
    this.origin = { x: ctx.spriteX, y: ctx.spriteY };
    this.baseline = cel.image.data.slice();
    this.mask = new Uint8Array(selection);
    this.copy = ctx.alt;
    ctx.session.pausePlayback();
    ctx.session.beginStroke();
  }

  onMove(ctx: ToolContext): void {
    this.shift(ctx, false);
  }

  onUp(ctx: ToolContext): void {
    if (!this.origin || !this.baseline || !this.mask) return;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    const next = this.shift(ctx, true);
    if (cel) {
      const changes = diffSnapshot(cel.image, this.baseline);
      ctx.session.commitPixels(ctx.session.activeLayerId, ctx.session.activeFrameId, changes, true);
      if (next) ctx.session.setSelection(next);
    }
    this.clear();
  }

  onCancel(): void {
    const ctx = this.active;
    if (ctx && this.baseline) {
      const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
      if (cel) restoreSnapshot(cel.image, this.baseline);
      if (this.mask) ctx.session.setSelection(this.mask);
      ctx.session.invalidateCanvas();
    }
    this.clear();
  }

  private shift(ctx: ToolContext, commit: boolean): Uint8Array | null {
    if (!this.origin || !this.baseline || !this.mask) return null;
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return null;
    restoreSnapshot(cel.image, this.baseline);
    const dx = ctx.spriteX - this.origin.x;
    const dy = ctx.spriteY - this.origin.y;
    const next = editSelection(cel.image, this.mask, this.copy ? "duplicate" : "move", dx, dy);
    if (!commit) ctx.session.invalidateCanvas();
    return next;
  }

  private clear(): void {
    this.origin = null;
    this.baseline = null;
    this.mask = null;
    this.active = null;
  }
}

function contains(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return mask[y * width + x] === 1;
}
