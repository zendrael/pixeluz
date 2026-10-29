import { cloneImage } from "../domain/image-buffer";
import type { Cel, Frame, SpriteDocument } from "../domain/types";
import type { Command } from "./command";

export class AddFrameCommand implements Command {
  readonly label = "Novo quadro";

  constructor(
    private readonly index: number,
    private readonly frame: Frame,
    private readonly cels: Cel[],
  ) {}

  execute(doc: SpriteDocument): void {
    doc.frames.splice(this.index, 0, this.frame);
    doc.cels.push(...this.cels);
  }

  undo(doc: SpriteDocument): void {
    doc.frames = doc.frames.filter((frame) => frame.id !== this.frame.id);
    const ids = new Set(this.cels.map((cel) => cel.frameId));
    doc.cels = doc.cels.filter((cel) => !ids.has(cel.frameId));
  }
}

export class DeleteFrameCommand implements Command {
  readonly label = "Apagar quadro";
  private removed: Cel[] = [];

  constructor(
    private readonly index: number,
    private readonly frame: Frame,
  ) {}

  execute(doc: SpriteDocument): void {
    doc.frames.splice(this.index, 1);
    this.removed = doc.cels.filter((cel) => cel.frameId === this.frame.id);
    doc.cels = doc.cels.filter((cel) => cel.frameId !== this.frame.id);
  }

  undo(doc: SpriteDocument): void {
    doc.frames.splice(this.index, 0, this.frame);
    doc.cels.push(...this.removed);
  }
}

export class SetFrameDurationCommand implements Command {
  readonly label = "Duração";

  constructor(
    private readonly frameId: string,
    private readonly before: number,
    private readonly after: number,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.after);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.before);
  }

  private set(doc: SpriteDocument, value: number): void {
    const frame = doc.frames.find((item) => item.id === this.frameId);
    if (frame) frame.durationMs = value;
  }
}

export function duplicateCels(source: Cel[], frameId: string): Cel[] {
  return source.map((cel) => {
    const copy: Cel = {
      layerId: cel.layerId,
      frameId,
      image: cloneImage(cel.image),
      x: cel.x,
      y: cel.y,
      opacity: cel.opacity,
    };
    if (cel.tiles) copy.tiles = cel.tiles.slice();
    return copy;
  });
}
