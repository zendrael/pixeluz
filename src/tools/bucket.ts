import { findCel } from "../domain/sprite";
import { placePixel } from "../domain/symmetry";
import { floodFill } from "../render/raster";
import { canPaint, type Tool, type ToolContext } from "./tool";

export class BucketTool implements Tool {
  readonly id = "bucket" as const;
  readonly cursor = "crosshair";

  onDown(ctx: ToolContext): void {
    if (!canPaint(ctx.session)) return;
    ctx.session.pausePlayback();
    const cel = findCel(ctx.session.doc, ctx.session.activeLayerId, ctx.session.activeFrameId);
    if (!cel) return;
    const placed = placePixel(ctx.spriteX, ctx.spriteY, cel.image.width, cel.image.height, ctx.session.tile);
    if (!placed) return;
    const color = ctx.button === 2 ? ctx.session.background : ctx.session.foreground;
    const changes = floodFill(cel.image, placed[0], placed[1], color);
    ctx.session.commitPixels(ctx.session.activeLayerId, ctx.session.activeFrameId, changes, true);
  }

  onMove(): void {}
  onUp(): void {}
  onCancel(): void {}
}
