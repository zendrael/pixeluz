import { createImage } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import { shiftTileGrid } from "../domain/tiles";
import type { ImageBuffer, Slice, SpriteDocument } from "../domain/types";
import type { Command } from "./command";

export class ResizeCanvasCommand implements Command {
  readonly label = "Tamanho do canvas";
  private ready = false;
  private beforeWidth = 0;
  private beforeHeight = 0;
  private readonly images: Array<{
    image: ImageBuffer;
    before: Uint8ClampedArray;
    after: Uint8ClampedArray;
    beforeWidth: number;
    beforeHeight: number;
  }> = [];
  private readonly grids: Array<{ layerId: string; frameId: string; before: number[]; after: number[] }> = [];
  private beforeSlices: Slice[] = [];
  private afterSlices: Slice[] = [];

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  execute(doc: SpriteDocument): void {
    if (!this.ready) this.prepare(doc);
    this.apply(doc, true);
  }

  undo(doc: SpriteDocument): void {
    if (!this.ready) return;
    this.apply(doc, false);
  }

  private prepare(doc: SpriteDocument): void {
    this.beforeWidth = doc.width;
    this.beforeHeight = doc.height;
    this.beforeSlices = copySlices(doc.slices);
    const seen = new Set<ImageBuffer>();
    for (const cel of doc.cels) {
      if (seen.has(cel.image)) continue;
      seen.add(cel.image);
      this.images.push({
        image: cel.image,
        before: cel.image.data.slice(),
        after: shiftPixels(cel.image, this.width, this.height, this.dx, this.dy),
        beforeWidth: cel.image.width,
        beforeHeight: cel.image.height,
      });
      if (cel.tiles) {
        const layer = doc.layers.find((item) => item.id === cel.layerId);
        const tileset = doc.tilesets.find((item) => item.id === layer?.tilesetId);
        this.grids.push({
          layerId: cel.layerId,
          frameId: cel.frameId,
          before: cel.tiles.slice(),
          after: tileset
            ? shiftTileGrid(cel.tiles, doc.width, doc.height, this.width, this.height, tileset, this.dx, this.dy)
            : cel.tiles.slice(),
        });
      }
    }
    this.afterSlices = copySlices(doc.slices).map((slice) => ({
      ...slice,
      keys: slice.keys.map((key) => clampKey(key.x + this.dx, key.y + this.dy, key.width, key.height, this.width, this.height, key.frameIndex)),
    }));
    this.ready = true;
  }

  private apply(doc: SpriteDocument, forward: boolean): void {
    doc.width = forward ? this.width : this.beforeWidth;
    doc.height = forward ? this.height : this.beforeHeight;
    for (const snap of this.images) {
      const pixels = forward ? snap.after : snap.before;
      snap.image.width = forward ? this.width : snap.beforeWidth;
      snap.image.height = forward ? this.height : snap.beforeHeight;
      snap.image.data = new Uint8ClampedArray(pixels);
    }
    for (const grid of this.grids) {
      const cel = findCel(doc, grid.layerId, grid.frameId);
      if (cel) cel.tiles = (forward ? grid.after : grid.before).slice();
    }
    doc.slices = copySlices(forward ? this.afterSlices : this.beforeSlices);
  }
}

export class AddSliceCommand implements Command {
  readonly label = "Novo slice";

  constructor(private readonly slice: Slice) {}

  execute(doc: SpriteDocument): void {
    doc.slices.push(this.slice);
  }

  undo(doc: SpriteDocument): void {
    doc.slices = doc.slices.filter((slice) => slice.id !== this.slice.id);
  }
}

export class DeleteSliceCommand implements Command {
  readonly label = "Apagar slice";
  private index = -1;
  private removed: Slice | null = null;

  constructor(private readonly sliceId: string) {}

  execute(doc: SpriteDocument): void {
    this.index = doc.slices.findIndex((slice) => slice.id === this.sliceId);
    this.removed = this.index >= 0 ? (doc.slices[this.index] ?? null) : null;
    if (this.index >= 0) doc.slices.splice(this.index, 1);
  }

  undo(doc: SpriteDocument): void {
    if (this.removed && this.index >= 0) doc.slices.splice(this.index, 0, this.removed);
  }
}

export class TileEditCommand implements Command {
  readonly label = "Tiles";

  constructor(
    private readonly tilesetId: string,
    private readonly tileWidth: number,
    private readonly tileHeight: number,
    private readonly beforeTiles: Uint8ClampedArray[],
    private readonly afterTiles: Uint8ClampedArray[],
    private readonly grids: Array<{ layerId: string; frameId: string; before: number[]; after: number[] }>,
  ) {}

  execute(doc: SpriteDocument): void {
    this.apply(doc, this.afterTiles, "after");
  }

  undo(doc: SpriteDocument): void {
    this.apply(doc, this.beforeTiles, "before");
  }

  private apply(doc: SpriteDocument, pixels: Uint8ClampedArray[], side: "before" | "after"): void {
    const tileset = doc.tilesets.find((item) => item.id === this.tilesetId);
    if (!tileset) return;
    while (tileset.tiles.length > pixels.length) tileset.tiles.pop();
    pixels.forEach((data, index) => {
      let tile = tileset.tiles[index];
      if (!tile) {
        tile = createImage(this.tileWidth, this.tileHeight);
        tileset.tiles.push(tile);
      }
      tile.data = new Uint8ClampedArray(data);
    });
    for (const grid of this.grids) {
      const cel = findCel(doc, grid.layerId, grid.frameId);
      if (cel) cel.tiles = (side === "after" ? grid.after : grid.before).slice();
    }
  }
}

function shiftPixels(image: ImageBuffer, width: number, height: number, dx: number, dy: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const from = (y * image.width + x) * 4;
      const to = (ny * width + nx) * 4;
      data[to] = image.data[from] ?? 0;
      data[to + 1] = image.data[from + 1] ?? 0;
      data[to + 2] = image.data[from + 2] ?? 0;
      data[to + 3] = image.data[from + 3] ?? 0;
    }
  }
  return data;
}

function copySlices(slices: Slice[]): Slice[] {
  return slices.map((slice) => ({ ...slice, keys: slice.keys.map((key) => ({ ...key })) }));
}

function clampKey(x: number, y: number, width: number, height: number, canvasWidth: number, canvasHeight: number, frameIndex: number) {
  let nextX = x;
  let nextY = y;
  let nextW = width;
  let nextH = height;
  if (nextX < 0) {
    nextW += nextX;
    nextX = 0;
  }
  if (nextY < 0) {
    nextH += nextY;
    nextY = 0;
  }
  if (nextX + nextW > canvasWidth) nextW = canvasWidth - nextX;
  if (nextY + nextH > canvasHeight) nextH = canvasHeight - nextY;
  if (nextW < 1 || nextH < 1) return { frameIndex, x: 0, y: 0, width: 1, height: 1 };
  return { frameIndex, x: nextX, y: nextY, width: nextW, height: nextH };
}
