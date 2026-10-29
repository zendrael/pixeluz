import { cloneImage } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import type { BlendMode, Cel, ImageBuffer, SpriteDocument, Tag } from "../domain/types";
import type { Command } from "./command";

function cloneCel(cel: Cel): Cel {
  return { ...cel, image: cloneImage(cel.image) };
}

export class SetLayerOpacityCommand implements Command {
  readonly label = "Opacidade da camada";

  constructor(
    private readonly layerId: string,
    private readonly before: number,
    private readonly after: number,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.after);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.before);
  }

  private set(doc: SpriteDocument, opacity: number): void {
    const layer = doc.layers.find((item) => item.id === this.layerId);
    if (layer) layer.opacity = opacity;
  }
}

export class SetLayerBlendCommand implements Command {
  readonly label = "Mistura";

  constructor(
    private readonly layerId: string,
    private readonly before: BlendMode,
    private readonly after: BlendMode,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.after);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.before);
  }

  private set(doc: SpriteDocument, blendMode: BlendMode): void {
    const layer = doc.layers.find((item) => item.id === this.layerId);
    if (layer) layer.blendMode = blendMode;
  }
}

export class SetCelOpacityCommand implements Command {
  readonly label = "Opacidade do cel";

  constructor(
    private readonly layerId: string,
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

  private set(doc: SpriteDocument, opacity: number): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (cel) cel.opacity = opacity;
  }
}

export class SetCelOffsetCommand implements Command {
  readonly label = "Posição do cel";

  constructor(
    private readonly layerId: string,
    private readonly frameId: string,
    private readonly beforeX: number,
    private readonly beforeY: number,
    private readonly afterX: number,
    private readonly afterY: number,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.afterX, this.afterY);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.beforeX, this.beforeY);
  }

  private set(doc: SpriteDocument, x: number, y: number): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (!cel) return;
    cel.x = x;
    cel.y = y;
  }
}

export class LinkCelsCommand implements Command {
  readonly label = "Ligar cels";
  private readonly snapshots: ImageBuffer[];

  constructor(
    private readonly layerId: string,
    private readonly frameIds: string[],
    private readonly linkId: string,
    images: ImageBuffer[],
  ) {
    this.snapshots = images.map((image) => cloneImage(image));
  }

  execute(doc: SpriteDocument): void {
    const firstId = this.frameIds[0];
    const first = firstId ? findCel(doc, this.layerId, firstId) : undefined;
    if (!first) return;
    const shared = first.image;
    for (const frameId of this.frameIds) {
      const cel = findCel(doc, this.layerId, frameId);
      if (!cel) continue;
      cel.image = shared;
      cel.linkId = this.linkId;
    }
  }

  undo(doc: SpriteDocument): void {
    this.frameIds.forEach((frameId, index) => {
      const cel = findCel(doc, this.layerId, frameId);
      const snapshot = this.snapshots[index];
      if (!cel || !snapshot) return;
      cel.image = cloneImage(snapshot);
      delete cel.linkId;
    });
  }
}

export class UnlinkCelCommand implements Command {
  readonly label = "Desligar cel";
  private orphanId: string | null = null;

  constructor(
    private readonly layerId: string,
    private readonly frameId: string,
    private readonly linkId: string,
    private readonly shared: ImageBuffer,
  ) {}

  execute(doc: SpriteDocument): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (!cel) return;
    cel.image = cloneImage(this.shared);
    delete cel.linkId;
    const rest = doc.cels.filter((item) => item.layerId === this.layerId && item.linkId === this.linkId);
    this.orphanId = rest.length === 1 ? (rest[0]?.frameId ?? null) : null;
    if (rest.length === 1 && rest[0]) delete rest[0].linkId;
  }

  undo(doc: SpriteDocument): void {
    const cel = findCel(doc, this.layerId, this.frameId);
    if (cel) {
      cel.image = this.shared;
      cel.linkId = this.linkId;
    }
    if (!this.orphanId) return;
    const orphan = findCel(doc, this.layerId, this.orphanId);
    if (!orphan) return;
    orphan.image = this.shared;
    orphan.linkId = this.linkId;
  }
}

export class ReverseFramesCommand implements Command {
  readonly label = "Inverter faixa";

  constructor(
    private readonly from: number,
    private readonly to: number,
  ) {}

  execute(doc: SpriteDocument): void {
    this.reverse(doc);
  }

  undo(doc: SpriteDocument): void {
    this.reverse(doc);
  }

  private reverse(doc: SpriteDocument): void {
    const slice = doc.frames.slice(this.from, this.to + 1).reverse();
    doc.frames.splice(this.from, slice.length, ...slice);
  }
}

export class MoveFrameCommand implements Command {
  readonly label = "Reordenar quadro";

  constructor(
    private readonly from: number,
    private readonly to: number,
  ) {}

  execute(doc: SpriteDocument): void {
    reorder(doc.frames, this.from, this.to);
  }

  undo(doc: SpriteDocument): void {
    reorder(doc.frames, this.to, this.from);
  }
}

export class CopyCelsCommand implements Command {
  readonly label = "Copiar cels";
  private before: Cel[] = [];

  constructor(
    private readonly fromId: string,
    private readonly toId: string,
  ) {}

  execute(doc: SpriteDocument): void {
    this.before = doc.cels.filter((cel) => cel.frameId === this.toId).map(cloneCel);
    for (const source of doc.cels.filter((cel) => cel.frameId === this.fromId)) {
      const dest = findCel(doc, source.layerId, this.toId);
      if (!dest) {
        doc.cels.push({
          layerId: source.layerId,
          frameId: this.toId,
          image: cloneImage(source.image),
          x: source.x,
          y: source.y,
          opacity: source.opacity,
        });
        continue;
      }
      dest.image = cloneImage(source.image);
      dest.x = source.x;
      dest.y = source.y;
      dest.opacity = source.opacity;
      delete dest.linkId;
    }
  }

  undo(doc: SpriteDocument): void {
    doc.cels = doc.cels.filter((cel) => cel.frameId !== this.toId);
    for (const cel of this.before) doc.cels.push(cloneCel(cel));
  }
}

export class AddTagCommand implements Command {
  readonly label = "Nova tag";

  constructor(private readonly tag: Tag) {}

  execute(doc: SpriteDocument): void {
    doc.tags.push({ ...this.tag });
  }

  undo(doc: SpriteDocument): void {
    doc.tags = doc.tags.filter((tag) => tag.id !== this.tag.id);
  }
}

export class DeleteTagCommand implements Command {
  readonly label = "Apagar tag";

  constructor(
    private readonly index: number,
    private readonly tag: Tag,
  ) {}

  execute(doc: SpriteDocument): void {
    doc.tags.splice(this.index, 1);
  }

  undo(doc: SpriteDocument): void {
    doc.tags.splice(this.index, 0, { ...this.tag });
  }
}

export class SetTagCommand implements Command {
  readonly label = "Tag";

  constructor(
    private readonly tagId: string,
    private readonly before: Tag,
    private readonly after: Tag,
  ) {}

  execute(doc: SpriteDocument): void {
    this.set(doc, this.after);
  }

  undo(doc: SpriteDocument): void {
    this.set(doc, this.before);
  }

  private set(doc: SpriteDocument, value: Tag): void {
    const tag = doc.tags.find((item) => item.id === this.tagId);
    if (!tag) return;
    tag.name = value.name;
    tag.from = value.from;
    tag.to = value.to;
    tag.direction = value.direction;
  }
}

export function reorder<T>(list: T[], from: number, to: number): void {
  const [item] = list.splice(from, 1);
  if (item !== undefined) list.splice(to, 0, item);
}
