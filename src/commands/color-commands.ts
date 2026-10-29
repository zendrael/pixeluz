import { findCel } from "../domain/sprite";
import { convertColors } from "../domain/quantize";
import type { ColorMode, ImageBuffer, SpriteDocument } from "../domain/types";
import type { Command } from "./command";

export class SetColorModeCommand implements Command {
  readonly label = "Modo de cor";
  private prepared = false;
  private beforeMode: ColorMode = "rgba";
  private beforePalette: SpriteDocument["palette"] = [];
  private afterPalette: SpriteDocument["palette"] = [];
  private readonly images: ImageBuffer[] = [];
  private readonly before: Uint8ClampedArray[] = [];
  private readonly after: Uint8ClampedArray[] = [];

  constructor(private readonly mode: ColorMode) {}

  execute(doc: SpriteDocument): void {
    if (!this.prepared) this.prepare(doc);
    doc.colorMode = this.mode;
    doc.palette = this.afterPalette.map((color) => ({ ...color }));
    this.images.forEach((image, index) => {
      const pixels = this.after[index];
      if (pixels) image.data.set(pixels);
    });
  }

  undo(doc: SpriteDocument): void {
    if (!this.prepared) return;
    doc.colorMode = this.beforeMode;
    doc.palette = this.beforePalette.map((color) => ({ ...color }));
    this.images.forEach((image, index) => {
      const pixels = this.before[index];
      if (pixels) image.data.set(pixels);
    });
  }

  private prepare(doc: SpriteDocument): void {
    this.beforeMode = doc.colorMode;
    this.beforePalette = doc.palette.map((color) => ({ ...color }));
    const seen = new Set<ImageBuffer>();
    for (const cel of doc.cels) {
      if (seen.has(cel.image)) continue;
      seen.add(cel.image);
      this.images.push(cel.image);
      this.before.push(cel.image.data.slice());
    }
    const converted = convertColors(this.images, this.mode, doc.palette);
    this.afterPalette = converted.palette;
    this.after.push(...converted.pixels);
    this.prepared = true;
  }
}

export class FilterCelCommand implements Command {
  readonly label = "Filtro";
  private before: Uint8ClampedArray | null = null;

  constructor(
    private readonly layerId: string,
    private readonly frameId: string,
    private readonly after: Uint8ClampedArray,
  ) {}

  execute(doc: SpriteDocument): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (!cel || cel.image.data.length !== this.after.length) return;
    if (!this.before) this.before = cel.image.data.slice();
    cel.image.data.set(this.after);
  }

  undo(doc: SpriteDocument): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (!cel || !this.before) return;
    cel.image.data.set(this.before);
  }
}
