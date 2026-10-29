import { getPixel } from "../domain/image-buffer";
import { placePixel } from "../domain/symmetry";
import type { Tool, ToolContext } from "./tool";

export class EyedropperTool implements Tool {
  readonly id = "eyedropper" as const;
  readonly cursor = "crosshair";

  onDown(ctx: ToolContext): void {
    ctx.session.pausePlayback();
    const placed = placePixel(ctx.spriteX, ctx.spriteY, ctx.session.doc.width, ctx.session.doc.height, ctx.session.tile);
    if (!placed) return;
    const pixel = getPixel(ctx.session.composite(), placed[0], placed[1]);
    if (!pixel) return;
    if (ctx.button === 2) ctx.session.setBackground(pixel);
    else ctx.session.setForeground(pixel);
  }

  onMove(): void {}
  onUp(): void {}
  onCancel(): void {}
}
