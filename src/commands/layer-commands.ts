import { cloneImage } from "../domain/image-buffer";
import type { Cel, Layer, SpriteDocument, Tileset } from "../domain/types";
import type { Command } from "./command";

function cloneCel(cel: Cel): Cel {
  const copy: Cel = { ...cel, image: cloneImage(cel.image) };
  if (cel.tiles) copy.tiles = cel.tiles.slice();
  return copy;
}

export class AddLayerCommand implements Command {
  readonly label = "Nova camada";

  constructor(
    private readonly index: number,
    private readonly layer: Layer,
    private readonly cels: Cel[],
  ) {}

  execute(doc: SpriteDocument): void {
    doc.layers.splice(this.index, 0, { ...this.layer });
    for (const cel of this.cels) doc.cels.push(cloneCel(cel));
  }

  undo(doc: SpriteDocument): void {
    doc.layers.splice(this.index, 1);
    doc.cels = doc.cels.filter((cel) => cel.layerId !== this.layer.id);
  }
}

export class DeleteLayerCommand implements Command {
  readonly label = "Apagar camada";
  private removed: Cel[] = [];
  private childParents: Array<{ id: string; parentId: string | null }> = [];

  constructor(
    private readonly index: number,
    private readonly layer: Layer,
  ) {}

  execute(doc: SpriteDocument): void {
    this.childParents = doc.layers
      .filter((item) => item.parentId === this.layer.id)
      .map((item) => ({ id: item.id, parentId: item.parentId }));
    for (const item of doc.layers) {
      if (item.parentId === this.layer.id) item.parentId = this.layer.parentId;
    }
    this.removed = doc.cels.filter((cel) => cel.layerId === this.layer.id).map(cloneCel);
    doc.layers.splice(this.index, 1);
    doc.cels = doc.cels.filter((cel) => cel.layerId !== this.layer.id);
  }

  undo(doc: SpriteDocument): void {
    doc.layers.splice(this.index, 0, { ...this.layer });
    for (const cel of this.removed) doc.cels.push(cloneCel(cel));
    for (const child of this.childParents) {
      const layer = doc.layers.find((item) => item.id === child.id);
      if (layer) layer.parentId = this.layer.id;
    }
  }
}

export class RenameLayerCommand implements Command {
  readonly label = "Renomear camada";

  constructor(
    private readonly layerId: string,
    private readonly before: string,
    private readonly after: string,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.after);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.before);
  }

  private set(doc: SpriteDocument, name: string): void {
    const layer = doc.layers.find((item) => item.id === this.layerId);
    if (layer) layer.name = name;
  }
}

export class MoveLayerCommand implements Command {
  readonly label = "Reordenar camada";

  constructor(
    private readonly from: number,
    private readonly to: number,
  ) {}

  execute(doc: SpriteDocument): void {
    reorder(doc.layers, this.from, this.to);
  }

  undo(doc: SpriteDocument): void {
    reorder(doc.layers, this.to, this.from);
  }
}

export class AddTilemapCommand implements Command {
  readonly label = "Camada de tiles";

  constructor(
    private readonly index: number,
    private readonly layer: Layer,
    private readonly cels: Cel[],
    private readonly tileset: Tileset | null,
  ) {}

  execute(doc: SpriteDocument): void {
    if (this.tileset && !doc.tilesets.some((item) => item.id === this.tileset?.id)) doc.tilesets.push(this.tileset);
    doc.layers.splice(this.index, 0, { ...this.layer });
    for (const cel of this.cels) doc.cels.push(cloneCel(cel));
  }

  undo(doc: SpriteDocument): void {
    doc.layers.splice(this.index, 1);
    doc.cels = doc.cels.filter((cel) => cel.layerId !== this.layer.id);
    if (this.tileset) doc.tilesets = doc.tilesets.filter((item) => item.id !== this.tileset?.id);
  }
}

function reorder<T>(list: T[], from: number, to: number): void {
  const [item] = list.splice(from, 1);
  if (item !== undefined) list.splice(to, 0, item);
}
