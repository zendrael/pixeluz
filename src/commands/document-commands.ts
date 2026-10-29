import { nearestOpaque } from "../domain/quantize";
import type { GridSettings, Rgba, SpriteDocument } from "../domain/types";
import type { Command } from "./command";

export class SetLayerVisibleCommand implements Command {
  readonly label = "Visibilidade";

  constructor(
    private readonly layerId: string,
    private readonly before: boolean,
    private readonly after: boolean,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.after);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.before);
  }

  private set(doc: SpriteDocument, visible: boolean): void {
    const layer = doc.layers.find((item) => item.id === this.layerId);
    if (layer) layer.visible = visible;
  }
}

export class RenameSpriteCommand implements Command {
  readonly label = "Renomear";

  constructor(
    private readonly before: string,
    private readonly after: string,
  ) {}

  execute(doc: SpriteDocument): void {
    doc.name = this.after;
  }

  undo(doc: SpriteDocument): void {
    doc.name = this.before;
  }
}

export class SetGridCommand implements Command {
  readonly label = "Grade";
  private readonly before: GridSettings;
  private readonly after: GridSettings;

  constructor(before: GridSettings, after: GridSettings) {
    this.before = { ...before };
    this.after = { ...after };
  }

  execute(doc: SpriteDocument): void {
    doc.grid = { ...this.after };
  }

  undo(doc: SpriteDocument): void {
    doc.grid = { ...this.before };
  }
}

export class SetPaletteColorCommand implements Command {
  readonly label = "Paleta";
  private readonly before: Rgba;
  private readonly after: Rgba;
  private collected = false;
  private readonly spots: Array<{ data: Uint8ClampedArray; index: number }> = [];

  constructor(
    private readonly index: number,
    before: Rgba,
    after: Rgba,
  ) {
    this.before = { ...before };
    this.after = { ...after };
  }

  execute(doc: SpriteDocument): void {
    if (!this.collected) this.collect(doc);
    if (doc.palette[this.index]) doc.palette[this.index] = { ...this.after };
    this.paint(this.after);
  }

  undo(doc: SpriteDocument): void {
    if (doc.palette[this.index]) doc.palette[this.index] = { ...this.before };
    this.paint(this.before);
  }

  private collect(doc: SpriteDocument): void {
    this.collected = true;
    if (doc.colorMode !== "indexed") return;
    const seen = new Set<Uint8ClampedArray>();
    for (const cel of doc.cels) {
      const data = cel.image.data;
      if (seen.has(data)) continue;
      seen.add(data);
      for (let index = 0; index < data.length; index += 4) {
        if (
          data[index] === this.before.r &&
          data[index + 1] === this.before.g &&
          data[index + 2] === this.before.b &&
          data[index + 3] === this.before.a
        ) {
          this.spots.push({ data, index });
        }
      }
    }
  }

  private paint(color: Rgba): void {
    for (const spot of this.spots) {
      spot.data[spot.index] = color.r;
      spot.data[spot.index + 1] = color.g;
      spot.data[spot.index + 2] = color.b;
      spot.data[spot.index + 3] = color.a;
    }
  }
}

export class AddPaletteColorCommand implements Command {
  readonly label = "Adicionar cor";

  constructor(private readonly color: Rgba) {}

  execute(doc: SpriteDocument): void {
    doc.palette.push({ ...this.color });
  }

  undo(doc: SpriteDocument): void {
    doc.palette.pop();
  }
}

export class RemovePaletteColorCommand implements Command {
  readonly label = "Remover cor";

  constructor(
    private readonly index: number,
    private readonly color: Rgba,
  ) {}

  execute(doc: SpriteDocument): void {
    doc.palette.splice(this.index, 1);
  }

  undo(doc: SpriteDocument): void {
    doc.palette.splice(this.index, 0, { ...this.color });
  }
}

export class ReplacePaletteCommand implements Command {
  readonly label = "Paleta pronta";
  private ready = false;
  private before: Rgba[] = [];
  private readonly images: Array<{ data: Uint8ClampedArray; before: Uint8ClampedArray }> = [];

  constructor(private readonly after: Rgba[]) {}

  execute(doc: SpriteDocument): void {
    if (!this.ready) this.capture(doc);
    doc.palette = this.after.map((color) => ({ ...color }));
    if (doc.colorMode === "indexed") {
      for (const image of this.images) remap(image.data, image.before, doc.palette);
    }
  }

  undo(doc: SpriteDocument): void {
    doc.palette = this.before.map((color) => ({ ...color }));
    for (const image of this.images) image.data.set(image.before);
  }

  private capture(doc: SpriteDocument): void {
    this.before = doc.palette.map((color) => ({ ...color }));
    if (doc.colorMode === "indexed") {
      const seen = new Set<Uint8ClampedArray>();
      for (const cel of doc.cels) {
        if (seen.has(cel.image.data)) continue;
        seen.add(cel.image.data);
        this.images.push({ data: cel.image.data, before: cel.image.data.slice() });
      }
    }
    this.ready = true;
  }
}

function remap(target: Uint8ClampedArray, source: Uint8ClampedArray, palette: Rgba[]): void {
  for (let index = 0; index < source.length; index += 4) {
    const color = { r: source[index] ?? 0, g: source[index + 1] ?? 0, b: source[index + 2] ?? 0, a: source[index + 3] ?? 0 };
    const next = color.a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : (nearestOpaque(color, palette) ?? color);
    target[index] = next.r;
    target[index + 1] = next.g;
    target[index + 2] = next.b;
    target[index + 3] = color.a;
  }
}
