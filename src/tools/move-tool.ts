import { canPaint, type Tool, type ToolContext } from "./tool";

export class MoveTool implements Tool {
  readonly id = "move" as const;
  readonly cursor = "move";
  private last: { x: number; y: number } | null = null;

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    const selection = ctx.session.selection;
    if (!selection || !contains(selection, ctx.session.doc.width, ctx.session.doc.height, ctx.spriteX, ctx.spriteY)) return;
    if (!ctx.session.floating) {
      if (!ctx.session.liftSelection(ctx.alt)) return;
    }
    this.last = { x: ctx.spriteX, y: ctx.spriteY };
    ctx.session.pausePlayback();
  }

  onMove(ctx: ToolContext): void {
    if (!this.last || !ctx.session.floating) return;
    const dx = ctx.spriteX - this.last.x;
    const dy = ctx.spriteY - this.last.y;
    if (dx === 0 && dy === 0) return;
    ctx.session.moveFloating(dx, dy);
    this.last = { x: ctx.spriteX, y: ctx.spriteY };
  }

  onUp(_ctx: ToolContext): void {
    this.clear();
  }

  onCancel(): void {
    this.clear();
  }

  private clear(): void {
    this.last = null;
  }
}

function contains(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return mask[y * width + x] === 1;
}
