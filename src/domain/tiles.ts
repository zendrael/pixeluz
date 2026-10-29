import { fitColor } from "./quantize";
import { createImage, getPixel, setPixel } from "./image-buffer";
import { createCel } from "./sprite";
import type { Cel, ImageBuffer, Rgba, SpriteDocument, Tileset } from "./types";

export type TileDrawMode = "tiles" | "pixels";
export type TilePixelMode = "manual" | "auto" | "stack";

const MAX_TILES = 256;

export function gridShape(width: number, height: number, tileset: Tileset): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.ceil(width / tileset.tileWidth)),
    rows: Math.max(1, Math.ceil(height / tileset.tileHeight)),
  };
}

export function emptyTileGrid(width: number, height: number, tileset: Tileset): number[] {
  const { cols, rows } = gridShape(width, height, tileset);
  return new Array<number>(cols * rows).fill(0);
}

export function tileCel(doc: SpriteDocument, layerId: string, frameId: string, tileset: Tileset): Cel {
  const cel = createCel(layerId, frameId, doc.width, doc.height);
  cel.tiles = emptyTileGrid(doc.width, doc.height, tileset);
  return cel;
}

export function makeTileset(doc: SpriteDocument, id: string): Tileset {
  const tileWidth = clampTile(doc.grid.width);
  const tileHeight = clampTile(doc.grid.height);
  const blank = createImage(tileWidth, tileHeight);
  const solid = createImage(tileWidth, tileHeight);
  const color = doc.palette.find((entry) => entry.a > 0) ?? { r: 0, g: 0, b: 0, a: 255 };
  for (let index = 0; index < solid.data.length; index += 4) {
    solid.data[index] = color.r;
    solid.data[index + 1] = color.g;
    solid.data[index + 2] = color.b;
    solid.data[index + 3] = 255;
  }
  return { id, name: "Tileset 1", tileWidth, tileHeight, tiles: [blank, solid] };
}

export function rasterizeTiles(doc: SpriteDocument, tileset: Tileset, tiles: number[]): ImageBuffer {
  const image = createImage(doc.width, doc.height);
  const { cols, rows } = gridShape(doc.width, doc.height, tileset);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const id = tiles[row * cols + col] ?? 0;
      const tile = id > 0 ? tileset.tiles[id] : undefined;
      if (!tile) continue;
      copyTile(image, tile, col * tileset.tileWidth, row * tileset.tileHeight);
    }
  }
  return image;
}

export function paintTilePoints(
  doc: SpriteDocument,
  tileset: Tileset,
  cel: Cel,
  points: Array<[number, number]>,
  color: Rgba,
  draw: TileDrawMode,
  pixelMode: TilePixelMode,
  selectedTile: number,
  selection: Uint8Array | null,
): void {
  if (!cel.tiles) cel.tiles = emptyTileGrid(doc.width, doc.height, tileset);
  const seen = new Map<string, number>();
  for (const [x, y] of points) {
    if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) continue;
    if (selection && selection.length === doc.width * doc.height && selection[y * doc.width + x] !== 1) continue;
    if (draw === "tiles") {
      const slot = slotAt(doc, tileset, cel, x, y);
      if (slot < 0) continue;
      cel.tiles[slot] = color.a === 0 ? 0 : Math.min(selectedTile, tileset.tiles.length - 1);
      continue;
    }
    const target = ensurePixelTile(doc, tileset, cel, x, y, pixelMode, seen);
    if (target === null) continue;
    const tile = tileset.tiles[target];
    if (!tile) continue;
    const localX = x % tileset.tileWidth;
    const localY = y % tileset.tileHeight;
    const next = color.a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : fitColor(color, doc.colorMode, doc.palette);
    setPixel(tile, localX, localY, next);
  }
}

export function shiftTileGrid(tiles: number[] | undefined, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number, tileset: Tileset, dx: number, dy: number): number[] {
  const oldShape = gridShape(oldWidth, oldHeight, tileset);
  const nextShape = gridShape(newWidth, newHeight, tileset);
  const source = tiles ?? [];
  const shifted = new Array<number>(nextShape.cols * nextShape.rows).fill(0);
  const colShift = Math.round(dx / tileset.tileWidth);
  const rowShift = Math.round(dy / tileset.tileHeight);
  for (let row = 0; row < oldShape.rows; row += 1) {
    for (let col = 0; col < oldShape.cols; col += 1) {
      const id = source[row * oldShape.cols + col] ?? 0;
      const nextCol = col + colShift;
      const nextRow = row + rowShift;
      if (id <= 0 || nextCol < 0 || nextRow < 0 || nextCol >= nextShape.cols || nextRow >= nextShape.rows) continue;
      shifted[nextRow * nextShape.cols + nextCol] = id;
    }
  }
  return shifted;
}

function ensurePixelTile(
  doc: SpriteDocument,
  tileset: Tileset,
  cel: Cel,
  x: number,
  y: number,
  mode: TilePixelMode,
  seen: Map<string, number>,
): number | null {
  const slot = slotAt(doc, tileset, cel, x, y);
  if (slot < 0 || !cel.tiles) return null;
  const key = `${cel.layerId}:${cel.frameId}:${slot}`;
  const known = seen.get(key);
  if (known !== undefined) return known;
  const current = cel.tiles[slot] ?? 0;
  const uses = current > 0 ? tileUses(doc, tileset.id, current) : 0;
  const fresh = current === 0 || mode === "stack" || (mode === "auto" && uses > 1);
  if (!fresh) {
    seen.set(key, current);
    return current;
  }
  if (tileset.tiles.length >= MAX_TILES) {
    const fallback = current > 0 ? current : 0;
    if (fallback === 0) return null;
    seen.set(key, fallback);
    return fallback;
  }
  const source = current > 0 ? tileset.tiles[current] : tileset.tiles[0];
  const copy = createImage(tileset.tileWidth, tileset.tileHeight);
  if (source) copy.data.set(source.data.subarray(0, copy.data.length));
  tileset.tiles.push(copy);
  const id = tileset.tiles.length - 1;
  cel.tiles[slot] = id;
  seen.set(key, id);
  return id;
}

function tileUses(doc: SpriteDocument, tilesetId: string, tileId: number): number {
  let count = 0;
  for (const layer of doc.layers) {
    if (layer.kind !== "tilemap" || layer.tilesetId !== tilesetId) continue;
    for (const cel of doc.cels) {
      if (cel.layerId !== layer.id || !cel.tiles) continue;
      for (const id of cel.tiles) if (id === tileId) count += 1;
    }
  }
  return count;
}

function slotAt(doc: SpriteDocument, tileset: Tileset, cel: Cel, x: number, y: number): number {
  const { cols } = gridShape(doc.width, doc.height, tileset);
  const col = Math.floor(x / tileset.tileWidth);
  const row = Math.floor(y / tileset.tileHeight);
  const slot = row * cols + col;
  if (!cel.tiles || slot < 0 || slot >= cel.tiles.length) return -1;
  return slot;
}

function copyTile(target: ImageBuffer, tile: ImageBuffer, ox: number, oy: number): void {
  for (let y = 0; y < tile.height; y += 1) {
    for (let x = 0; x < tile.width; x += 1) {
      const pixel = getPixel(tile, x, y);
      if (!pixel || pixel.a === 0) continue;
      setPixel(target, ox + x, oy + y, pixel);
    }
  }
}

function clampTile(value: number): number {
  if (!Number.isInteger(value)) return 16;
  return Math.max(4, Math.min(32, value));
}
