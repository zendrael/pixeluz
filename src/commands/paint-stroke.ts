import { findCel } from "../domain/sprite";
import type { PixelChange, SpriteDocument } from "../domain/types";
import type { Command } from "./command";

export class PaintStrokeCommand implements Command {
  readonly label = "Pintar";
  private readonly changes: PixelChange[];

  constructor(private readonly layerId: string, private readonly frameId: string, changes: PixelChange[]) {
    this.changes = changes.map((change) => ({
      x: change.x,
      y: change.y,
      before: { ...change.before },
      after: { ...change.after },
    }));
  }

  execute(doc: SpriteDocument): void {
    this.apply(doc, "after");
  }

  undo(doc: SpriteDocument): void {
    this.apply(doc, "before");
  }

  private apply(doc: SpriteDocument, side: "before" | "after"): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (!cel) return;
    for (const change of this.changes) {
      const color = change[side];
      const index = (change.y * cel.image.width + change.x) * 4;
      if (change.x < 0 || change.y < 0 || change.x >= cel.image.width || change.y >= cel.image.height) continue;
      cel.image.data[index] = color.r;
      cel.image.data[index + 1] = color.g;
      cel.image.data[index + 2] = color.b;
      cel.image.data[index + 3] = color.a;
    }
  }
}
