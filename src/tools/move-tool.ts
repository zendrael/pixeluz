import { cloneImage } from "../domain/image-buffer";
import { maskBounds } from "../domain/selection";
import { hitTransformHandle, type TransformHandle } from "../domain/transform-handles";
import type { FloatingSelection } from "../app/selection-clipboard";
import { canPaint, type Tool, type ToolContext } from "./tool";

export class MoveTool implements Tool {
  readonly id = "move" as const;
  readonly cursor = "move";
  private last: { x: number; y: number } | null = null;
  private mode: "move" | TransformHandle | null = null;
  private baseline: FloatingSelection | null = null;
  private origin = { x: 0, y: 0, dist: 1, angle: 0 };

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    const selection = ctx.session.selection;
    if (!selection) return;
    const handle = hitTransformHandle(
      selection,
      ctx.session.doc.width,
      ctx.session.doc.height,
      ctx.spriteX,
      ctx.spriteY,
      ctx.session.zoom,
    );
    if (handle) {
      if (!ctx.session.floating && !ctx.session.liftSelection(false)) return;
      const float = ctx.session.floating;
      if (!float) return;
      this.baseline = {
        image: cloneImage(float.image),
        mask: float.mask.slice(),
        x: float.x,
        y: float.y,
      };
      const bounds = maskBounds(selection, ctx.session.doc.width, ctx.session.doc.height);
      if (!bounds) return;
      const cx = (bounds.minX + bounds.maxX + 1) / 2;
      const cy = (bounds.minY + bounds.maxY + 1) / 2;
      const dx = ctx.spriteX - cx;
      const dy = ctx.spriteY - cy;
      this.origin = {
        x: cx,
        y: cy,
        dist: Math.max(0.5, Math.hypot(dx, dy)),
        angle: Math.atan2(dy, dx),
      };
      this.mode = handle;
      ctx.session.pausePlayback();
      return;
    }
    if (!contains(selection, ctx.session.doc.width, ctx.session.doc.height, ctx.spriteX, ctx.spriteY)) return;
    if (!ctx.session.floating) {
      if (!ctx.session.liftSelection(ctx.alt)) return;
    }
    this.mode = "move";
    this.last = { x: ctx.spriteX, y: ctx.spriteY };
    ctx.session.pausePlayback();
  }

  onMove(ctx: ToolContext): void {
    if (this.mode === "move") {
      if (!this.last || !ctx.session.floating) return;
      const dx = ctx.spriteX - this.last.x;
      const dy = ctx.spriteY - this.last.y;
      if (dx === 0 && dy === 0) return;
      ctx.session.moveFloating(dx, dy);
      this.last = { x: ctx.spriteX, y: ctx.spriteY };
      return;
    }
    if (!this.mode || !this.baseline) return;
    const dx = ctx.spriteX - this.origin.x;
    const dy = ctx.spriteY - this.origin.y;
    ctx.session.resetFloating(this.baseline);
    if (this.mode === "rotate") {
      const angle = ((Math.atan2(dy, dx) - this.origin.angle) * 180) / Math.PI;
      ctx.session.freeRotateSelection(angle);
      return;
    }
    const dist = Math.max(0.5, Math.hypot(dx, dy));
    const percent = Math.max(25, Math.min(400, (dist / this.origin.dist) * 100));
    ctx.session.freeScaleSelection(percent);
  }

  onUp(_ctx: ToolContext): void {
    this.clear();
  }

  onCancel(): void {
    this.clear();
  }

  private clear(): void {
    this.last = null;
    this.mode = null;
    this.baseline = null;
  }
}

function contains(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return mask[y * width + x] === 1;
}
