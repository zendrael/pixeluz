import type { Tool, ToolContext } from "./tool";

export class ZoomTool implements Tool {
  readonly id = "zoom" as const;
  readonly cursor = "zoom-in";

  onDown(ctx: ToolContext): void {
    ctx.session.zoomAt(ctx.canvasX, ctx.canvasY, ctx.button === 2 || ctx.alt ? -1 : 1);
  }

  onMove(): void {}
  onUp(): void {}
  onCancel(): void {}
}

export class HandTool implements Tool {
  readonly id = "hand" as const;
  readonly cursor = "grab";
  private last: { x: number; y: number } | null = null;

  onDown(ctx: ToolContext): void {
    this.last = { x: ctx.canvasX, y: ctx.canvasY };
  }

  onMove(ctx: ToolContext): void {
    if (!this.last) return;
    ctx.session.panBy(ctx.canvasX - this.last.x, ctx.canvasY - this.last.y);
    this.last = { x: ctx.canvasX, y: ctx.canvasY };
  }

  onUp(): void {
    this.last = null;
  }

  onCancel(): void {
    this.last = null;
  }
}
