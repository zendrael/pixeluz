import { BLACK } from "../domain/color";
import { createId } from "../domain/ids";
import { createImage } from "../domain/image-buffer";
import { MAX_SPRITE_SIZE, MIN_FRAME_MS, MIN_SPRITE_SIZE } from "../domain/limits";
import { luma } from "../domain/color";
import { createCel } from "../domain/sprite";
import { gridShape } from "../domain/tiles";
import type { BlendMode, Cel, ColorMode, Layer, LayerKind, LoopDirection, Rgba, SpriteDocument, Tileset } from "../domain/types";
import { zlibInflate, zlibStore } from "./zlib";

const TILE_ID_MASK = 0x1fffffff;
const TILESET_CHUNK = 0x2023;

const ASE_MAGIC = 0xa5e0;
const FRAME_MAGIC = 0xf1fa;

const BLEND_TO_ASE: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  "color-dodge": 6,
  "color-burn": 7,
  "hard-light": 8,
  "soft-light": 9,
  difference: 10,
  exclusion: 11,
  hue: 12,
  saturation: 13,
  color: 14,
  luminosity: 15,
  addition: 16,
  subtract: 17,
  divide: 18,
};

const ASE_TO_BLEND: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "addition",
  "subtract",
  "divide",
];

export function isAseFile(bytes: Uint8Array): boolean {
  return bytes.length >= 6 && bytes[4] === 0xe0 && bytes[5] === 0xa5;
}

export function writeAse(doc: SpriteDocument): Uint8Array {
  const depth = doc.colorMode === "indexed" ? 8 : doc.colorMode === "grayscale" ? 16 : 32;
  const filePalette = asePalette(doc);
  const buf = new Buf();
  buf.u32(0);
  buf.u16(ASE_MAGIC);
  buf.u16(doc.frames.length);
  buf.u16(doc.width);
  buf.u16(doc.height);
  buf.u16(depth);
  buf.u32(1);
  buf.u16(doc.frames[0]?.durationMs ?? 100);
  buf.u32(0);
  buf.u32(0);
  buf.u8(filePalette.transparentIndex);
  buf.zeros(3);
  buf.u16(filePalette.colors.length === 256 ? 0 : filePalette.colors.length);
  buf.u8(1);
  buf.u8(1);
  buf.i16(doc.grid.x);
  buf.i16(doc.grid.y);
  buf.u16(doc.grid.width);
  buf.u16(doc.grid.height);
  buf.zeros(84);
  const anchors = new Map<string, number>();
  doc.frames.forEach((frame, frameIndex) => {
    const chunks: Uint8Array[] = [];
    if (frameIndex === 0) {
      doc.layers.forEach((layer) => chunks.push(layerChunk(doc, layer)));
      chunks.push(paletteChunk(filePalette.colors));
      doc.tilesets.forEach((tileset, index) => chunks.push(tilesetChunk(tileset, index, doc.colorMode, filePalette)));
      if (doc.tags.length > 0) chunks.push(tagsChunk(doc));
    }
    for (const cel of doc.cels) {
      if (cel.frameId !== frame.id) continue;
      const layerIndex = doc.layers.findIndex((layer) => layer.id === cel.layerId);
      const layer = doc.layers[layerIndex];
      if (!layer || layer.kind === "group") continue;
      if (layer.kind === "tilemap") {
        const tileset = doc.tilesets.find((item) => item.id === layer.tilesetId);
        if (!tileset) continue;
        chunks.push(tilemapCelChunk(doc, cel, layerIndex, tileset));
        continue;
      }
      const linkKey = cel.linkId ? `${cel.layerId}:${cel.linkId}` : "";
      const anchor = linkKey ? anchors.get(linkKey) : undefined;
      if (linkKey && anchor === undefined) anchors.set(linkKey, frameIndex);
      chunks.push(celChunk(doc, cel, layerIndex, filePalette, anchor));
    }
    writeFrame(buf, Math.max(MIN_FRAME_MS, Math.min(65535, frame.durationMs)), chunks);
  });
  buf.patchU32(0, buf.length);
  return buf.toUint8Array();
}

export async function readAse(bytes: Uint8Array): Promise<SpriteDocument> {
  if (!isAseFile(bytes) || bytes.length < 128) throw new Error("Arquivo ASE inválido");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(4, true) !== ASE_MAGIC) throw new Error("Arquivo ASE inválido");
  const frameCount = view.getUint16(6, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  const depth = view.getUint16(12, true);
  if (width < MIN_SPRITE_SIZE || height < MIN_SPRITE_SIZE || width > MAX_SPRITE_SIZE || height > MAX_SPRITE_SIZE) {
    throw new Error(`Sprite maior que o limite de ${MAX_SPRITE_SIZE}`);
  }
  const colorMode = modeFromDepth(depth);
  const headerFlags = view.getUint32(14, true);
  const speed = view.getUint16(18, true);
  const transparentIndex = bytes[28] ?? 0;
  const grid = {
    x: view.getInt16(34, true),
    y: view.getInt16(36, true),
    width: view.getUint16(38, true) || 16,
    height: view.getUint16(40, true) || 16,
  };
  const layers: Layer[] = [];
  const groupAt: Array<string | null> = [];
  const layerTilesetIndex: number[] = [];
  const frames: SpriteDocument["frames"] = [];
  const tags: SpriteDocument["tags"] = [];
  const tilesets: Tileset[] = [];
  let palette: Rgba[] = [{ ...BLACK }];
  let sawNewPalette = false;
  const rawCels: RawCel[] = [];
  let offset = 128;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    if (offset + 16 > bytes.length) throw new Error("Arquivo ASE inválido");
    const frameBytes = view.getUint32(offset, true);
    if (view.getUint16(offset + 4, true) !== FRAME_MAGIC) throw new Error("Arquivo ASE inválido");
    const oldCount = view.getUint16(offset + 6, true);
    const duration = view.getUint16(offset + 8, true);
    const newCount = view.getUint32(offset + 12, true);
    const chunkCount = newCount > 0 ? newCount : oldCount;
    frames.push({ id: createId(), durationMs: clampDuration(duration || speed) });
    let cursor = offset + 16;
    const frameEnd = Math.min(bytes.length, offset + frameBytes);
    for (let chunkIndex = 0; chunkIndex < chunkCount && cursor + 6 <= frameEnd; chunkIndex += 1) {
      const size = view.getUint32(cursor, true);
      const type = view.getUint16(cursor + 4, true);
      if (size < 6 || cursor + size > bytes.length) throw new Error("Arquivo ASE inválido");
      const data = bytes.subarray(cursor + 6, cursor + size);
      if (type === 0x2004) readLayer(data, layers, groupAt, layerTilesetIndex, (headerFlags & 1) !== 0);
      else if (type === TILESET_CHUNK) tilesets.push(await readTileset(data, colorMode, palette, transparentIndex));
      else if (type === 0x2019) {
        palette = readNewPalette(data);
        sawNewPalette = true;
      } else if ((type === 0x0004 || type === 0x0011) && !sawNewPalette) palette = readOldPalette(data, type === 0x0011);
      else if (type === 0x2018) tags.push(...readTags(data));
      else if (type === 0x2005) rawCels.push(await readCel(data, frameIndex, colorMode, palette, transparentIndex));
      cursor += size;
    }
    offset += frameBytes;
  }
  if (frames.length === 0) throw new Error("Arquivo ASE inválido");
  if (layers.length === 0) {
    layers.push({
      id: createId(),
      name: "Camada 1",
      kind: "image",
      opacity: 255,
      blendMode: "normal",
      visible: true,
      locked: false,
      parentId: null,
    });
  }
  layers.forEach((layer, index) => {
    if (layer.kind !== "tilemap") return;
    const tileset = tilesets[layerTilesetIndex[index] ?? 0];
    if (tileset) layer.tilesetId = tileset.id;
  });
  const cels = materializeCels(rawCels, layers, frames, width, height, tilesets);
  return {
    id: createId(),
    name: "Sem título",
    width,
    height,
    colorMode,
    palette: palette.length > 0 ? palette.slice(0, 256) : [{ ...BLACK }],
    frames,
    layers,
    cels,
    tags,
    slices: [],
    tilesets,
    grid,
  };
}

interface FilePalette {
  colors: Rgba[];
  transparentIndex: number;
}

interface RawCel {
  layerIndex: number;
  frameIndex: number;
  x: number;
  y: number;
  opacity: number;
  width: number;
  height: number;
  rgba: Uint8ClampedArray | null;
  linkFrame: number | null;
  tiles?: number[];
}

function asePalette(doc: SpriteDocument): FilePalette {
  if (doc.colorMode !== "indexed") {
    const colors = doc.palette.length > 0 ? doc.palette.slice(0, 256) : [{ ...BLACK }];
    return { colors, transparentIndex: 0 };
  }
  const opaque = doc.palette.filter((color) => color.a > 0).slice(0, 255);
  return { colors: [{ r: 0, g: 0, b: 0, a: 0 }, ...opaque], transparentIndex: 0 };
}

function layerChunk(doc: SpriteDocument, layer: Layer): Uint8Array {
  const body = new Buf();
  let flags = 0;
  if (layer.visible) flags |= 1;
  if (!layer.locked) flags |= 2;
  if (layer.kind === "reference") flags |= 64;
  body.u16(flags);
  body.u16(layer.kind === "group" ? 1 : layer.kind === "tilemap" ? 2 : 0);
  body.u16(layerDepth(doc, layer));
  body.u16(0);
  body.u16(0);
  body.u16(BLEND_TO_ASE[layer.blendMode]);
  body.u8(layer.opacity);
  body.zeros(3);
  body.string(layer.name);
  if (layer.kind === "tilemap") {
    const tilesetIndex = doc.tilesets.findIndex((item) => item.id === layer.tilesetId);
    body.u32(Math.max(0, tilesetIndex));
  }
  return wrapChunk(0x2004, body);
}

function tilesetChunk(tileset: Tileset, id: number, mode: ColorMode, palette: FilePalette): Uint8Array {
  const body = new Buf();
  body.u32(id);
  body.u32(2 | 4);
  body.u32(tileset.tiles.length);
  body.u16(tileset.tileWidth);
  body.u16(tileset.tileHeight);
  body.i16(1);
  body.zeros(14);
  body.string(tileset.name);
  const pixels = stackTiles(tileset, mode, palette);
  const packed = zlibStore(pixels);
  body.u32(packed.length);
  body.bytes(packed);
  return wrapChunk(TILESET_CHUNK, body);
}

function stackTiles(tileset: Tileset, mode: ColorMode, palette: FilePalette): Uint8Array {
  const tilePixels = tileset.tileWidth * tileset.tileHeight;
  const parts = tileset.tiles.map((tile) => {
    const cel: Cel = { layerId: "", frameId: "", image: tile, x: 0, y: 0, opacity: 255 };
    return pixelBytes({ colorMode: mode } as SpriteDocument, cel, palette);
  });
  const bytesPerTile = mode === "indexed" ? tilePixels : mode === "grayscale" ? tilePixels * 2 : tilePixels * 4;
  const out = new Uint8Array(bytesPerTile * tileset.tiles.length);
  parts.forEach((part, index) => out.set(part.subarray(0, bytesPerTile), index * bytesPerTile));
  return out;
}

function tilemapCelChunk(doc: SpriteDocument, cel: Cel, layerIndex: number, tileset: Tileset): Uint8Array {
  const shape = gridShape(doc.width, doc.height, tileset);
  const tiles = cel.tiles ?? new Array<number>(shape.cols * shape.rows).fill(0);
  const body = new Buf();
  body.u16(layerIndex);
  body.i16(cel.x);
  body.i16(cel.y);
  body.u8(cel.opacity);
  body.u16(3);
  body.i16(0);
  body.zeros(5);
  body.u16(shape.cols);
  body.u16(shape.rows);
  body.u16(32);
  body.u32(TILE_ID_MASK);
  body.u32(0);
  body.u32(0);
  body.u32(0);
  body.zeros(10);
  const raw = new Uint8Array(shape.cols * shape.rows * 4);
  const view = new DataView(raw.buffer);
  for (let index = 0; index < shape.cols * shape.rows; index += 1) {
    view.setUint32(index * 4, (tiles[index] ?? 0) & TILE_ID_MASK, true);
  }
  body.bytes(zlibStore(raw));
  return wrapChunk(0x2005, body);
}

function paletteChunk(colors: Rgba[]): Uint8Array {
  const body = new Buf();
  const last = Math.max(0, colors.length - 1);
  body.u32(colors.length);
  body.u32(0);
  body.u32(last);
  body.zeros(8);
  for (const color of colors) {
    body.u16(0);
    body.u8(color.r);
    body.u8(color.g);
    body.u8(color.b);
    body.u8(color.a);
  }
  return wrapChunk(0x2019, body);
}

function tagsChunk(doc: SpriteDocument): Uint8Array {
  const body = new Buf();
  body.u16(doc.tags.length);
  body.zeros(8);
  for (const tag of doc.tags) {
    body.u16(tag.from);
    body.u16(tag.to);
    body.u8(tag.direction === "reverse" ? 1 : tag.direction === "ping-pong" ? 2 : 0);
    body.u16(0);
    body.zeros(6);
    body.zeros(3);
    body.u8(0);
    body.string(tag.name);
  }
  return wrapChunk(0x2018, body);
}

function celChunk(doc: SpriteDocument, cel: Cel, layerIndex: number, palette: FilePalette, anchor: number | undefined): Uint8Array {
  const body = new Buf();
  body.u16(layerIndex);
  body.i16(cel.x);
  body.i16(cel.y);
  body.u8(cel.opacity);
  body.u16(anchor === undefined ? 2 : 1);
  body.i16(0);
  body.zeros(5);
  if (anchor === undefined) {
    body.u16(cel.image.width);
    body.u16(cel.image.height);
    body.bytes(zlibStore(pixelBytes(doc, cel, palette)));
  } else body.u16(anchor);
  return wrapChunk(0x2005, body);
}

function pixelBytes(doc: SpriteDocument, cel: Cel, palette: FilePalette): Uint8Array {
  const count = cel.image.width * cel.image.height;
  if (doc.colorMode === "indexed") {
    const bytes = new Uint8Array(count);
    for (let index = 0; index < count; index += 1) {
      const pixel = readPixel(cel.image.data, index * 4);
      bytes[index] = pixel.a === 0 ? palette.transparentIndex : paletteIndex(pixel, palette);
    }
    return bytes;
  }
  if (doc.colorMode === "grayscale") {
    const bytes = new Uint8Array(count * 2);
    for (let index = 0; index < count; index += 1) {
      const pixel = readPixel(cel.image.data, index * 4);
      bytes[index * 2] = luma(pixel.r, pixel.g, pixel.b);
      bytes[index * 2 + 1] = pixel.a;
    }
    return bytes;
  }
  return new Uint8Array(cel.image.data);
}

function paletteIndex(color: Rgba, palette: FilePalette): number {
  let best = 1;
  let bestDist = Number.POSITIVE_INFINITY;
  palette.colors.forEach((entry, index) => {
    if (index === palette.transparentIndex || entry.a === 0) return;
    const dist = (entry.r - color.r) ** 2 + (entry.g - color.g) ** 2 + (entry.b - color.b) ** 2;
    if (dist < bestDist) {
      best = index;
      bestDist = dist;
    }
  });
  return best;
}

function writeFrame(buf: Buf, duration: number, chunks: Uint8Array[]): void {
  const size = 16 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  buf.u32(size);
  buf.u16(FRAME_MAGIC);
  buf.u16(chunks.length);
  buf.u16(duration);
  buf.zeros(2);
  buf.u32(chunks.length);
  for (const chunk of chunks) buf.bytes(chunk);
}

function readLayer(
  data: Uint8Array,
  layers: Layer[],
  groupAt: Array<string | null>,
  layerTilesetIndex: number[],
  opacityValid: boolean,
): void {
  const cursor = new Cursor(data);
  const flags = cursor.u16();
  const type = cursor.u16();
  const level = cursor.u16();
  cursor.skip(4);
  const blend = cursor.u16();
  const opacity = cursor.u8();
  cursor.skip(3);
  const name = cursor.string();
  const kind: LayerKind = type === 1 ? "group" : type === 2 ? "tilemap" : flags & 64 ? "reference" : "image";
  const tilesetIndex = kind === "tilemap" ? cursor.u32() : 0;
  const id = createId();
  const parentId = level === 0 ? null : (groupAt[level - 1] ?? null);
  if (kind === "group") {
    groupAt[level] = id;
    groupAt.length = level + 1;
  }
  layerTilesetIndex.push(tilesetIndex);
  layers.push({
    id,
    name: name || `Camada ${layers.length + 1}`,
    kind,
    opacity: opacityValid ? opacity : 255,
    blendMode: ASE_TO_BLEND[blend] ?? "normal",
    visible: (flags & 1) !== 0,
    locked: (flags & 2) === 0,
    parentId,
  });
}

async function readTileset(data: Uint8Array, mode: ColorMode, palette: Rgba[], transparentIndex: number): Promise<Tileset> {
  const cursor = new Cursor(data);
  cursor.u32();
  const flags = cursor.u32();
  const count = cursor.u32();
  const tileWidth = Math.max(1, cursor.u16());
  const tileHeight = Math.max(1, cursor.u16());
  cursor.i16();
  cursor.skip(14);
  const name = cursor.string() || "Tileset";
  if (flags & 1) {
    cursor.u32();
    cursor.u32();
  }
  const tiles: ReturnType<typeof createImage>[] = [];
  if (flags & 2) {
    const length = cursor.u32();
    const packed = await zlibInflate(cursor.rest().subarray(0, length));
    const bytesPerTile = mode === "indexed" ? tileWidth * tileHeight : mode === "grayscale" ? tileWidth * tileHeight * 2 : tileWidth * tileHeight * 4;
    for (let index = 0; index < count; index += 1) {
      const slice = packed.subarray(index * bytesPerTile, (index + 1) * bytesPerTile);
      const rgba = pixelsToRgba(slice, tileWidth, tileHeight, mode, palette, transparentIndex);
      const image = createImage(tileWidth, tileHeight);
      image.data.set(rgba);
      tiles.push(image);
    }
  }
  while (tiles.length < Math.max(1, count)) tiles.push(createImage(tileWidth, tileHeight));
  return { id: createId(), name, tileWidth, tileHeight, tiles };
}

function readNewPalette(data: Uint8Array): Rgba[] {
  const cursor = new Cursor(data);
  const size = cursor.u32();
  const first = cursor.u32();
  const last = cursor.u32();
  cursor.skip(8);
  const colors = Array.from({ length: Math.min(256, size) }, () => ({ ...BLACK }));
  for (let index = first; index <= last && index < colors.length; index += 1) {
    const flags = cursor.u16();
    colors[index] = { r: cursor.u8(), g: cursor.u8(), b: cursor.u8(), a: cursor.u8() };
    if (flags & 1) cursor.string();
  }
  return colors.length > 0 ? colors : [{ ...BLACK }];
}

function readOldPalette(data: Uint8Array, scaled: boolean): Rgba[] {
  const cursor = new Cursor(data);
  const packets = cursor.u16();
  const colors: Rgba[] = [];
  let index = 0;
  for (let packet = 0; packet < packets; packet += 1) {
    index += cursor.u8();
    let count = cursor.u8();
    if (count === 0) count = 256;
    for (let color = 0; color < count; color += 1) {
      const channel = (value: number) => (scaled ? Math.round((value * 255) / 63) : value);
      colors[index] = { r: channel(cursor.u8()), g: channel(cursor.u8()), b: channel(cursor.u8()), a: 255 };
      index += 1;
    }
  }
  for (let index = 0; index < colors.length; index += 1) if (!colors[index]) colors[index] = { ...BLACK };
  return colors.length > 0 ? colors.slice(0, 256) : [{ ...BLACK }];
}

function readTags(data: Uint8Array): SpriteDocument["tags"] {
  const cursor = new Cursor(data);
  const count = cursor.u16();
  cursor.skip(8);
  const tags: SpriteDocument["tags"] = [];
  for (let index = 0; index < count; index += 1) {
    const from = cursor.u16();
    const to = cursor.u16();
    const direction = cursor.u8();
    cursor.u16();
    cursor.skip(10);
    tags.push({
      id: createId(),
      name: cursor.string() || `Tag ${index + 1}`,
      from,
      to,
      direction: loopFromAse(direction),
    });
  }
  return tags;
}

async function readCel(
  data: Uint8Array,
  frameIndex: number,
  mode: ColorMode,
  palette: Rgba[],
  transparentIndex: number,
): Promise<RawCel> {
  const cursor = new Cursor(data);
  const layerIndex = cursor.u16();
  const x = cursor.i16();
  const y = cursor.i16();
  const opacity = cursor.u8();
  const type = cursor.u16();
  cursor.skip(7);
  if (type === 1) {
    return { layerIndex, frameIndex, x, y, opacity, width: 0, height: 0, rgba: null, linkFrame: cursor.u16() };
  }
  if (type === 3) {
    const cols = cursor.u16();
    const rows = cursor.u16();
    const bits = cursor.u16();
    const idMask = cursor.u32() || TILE_ID_MASK;
    cursor.u32();
    cursor.u32();
    cursor.u32();
    cursor.skip(10);
    const packed = await zlibInflate(cursor.rest());
    const tiles: number[] = [];
    const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
    const stride = bits <= 8 ? 1 : bits <= 16 ? 2 : 4;
    for (let index = 0; index < cols * rows; index += 1) {
      const offset = index * stride;
      const value =
        stride === 1 ? (packed[offset] ?? 0) : stride === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true);
      tiles.push(value & idMask);
    }
    return { layerIndex, frameIndex, x, y, opacity, width: cols, height: rows, rgba: null, linkFrame: null, tiles };
  }
  if (type !== 0 && type !== 2) {
    return { layerIndex, frameIndex, x, y, opacity, width: 0, height: 0, rgba: null, linkFrame: null };
  }
  const width = cursor.u16();
  const height = cursor.u16();
  const packed = type === 2 ? await zlibInflate(cursor.rest()) : cursor.rest();
  return {
    layerIndex,
    frameIndex,
    x,
    y,
    opacity,
    width,
    height,
    rgba: pixelsToRgba(packed, width, height, mode, palette, transparentIndex),
    linkFrame: null,
  };
}

function pixelsToRgba(data: Uint8Array, width: number, height: number, mode: ColorMode, palette: Rgba[], transparentIndex: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    if (mode === "indexed") {
      const colorIndex = data[index] ?? 0;
      const color = palette[colorIndex] ?? BLACK;
      writeRgba(rgba, index, colorIndex === transparentIndex ? { ...color, a: 0 } : color);
    } else if (mode === "grayscale") {
      writeRgba(rgba, index, {
        r: data[index * 2] ?? 0,
        g: data[index * 2] ?? 0,
        b: data[index * 2] ?? 0,
        a: data[index * 2 + 1] ?? 255,
      });
    } else {
      writeRgba(rgba, index, {
        r: data[index * 4] ?? 0,
        g: data[index * 4 + 1] ?? 0,
        b: data[index * 4 + 2] ?? 0,
        a: data[index * 4 + 3] ?? 255,
      });
    }
  }
  return rgba;
}

function materializeCels(
  rawCels: RawCel[],
  layers: Layer[],
  frames: SpriteDocument["frames"],
  width: number,
  height: number,
  tilesets: Tileset[],
): Cel[] {
  const placed = new Map<string, { image: ReturnType<typeof createImage>; linkId?: string; tiles?: number[] }>();
  for (const raw of rawCels) {
    if (raw.linkFrame !== null) continue;
    const layer = layers[raw.layerIndex];
    const frame = frames[raw.frameIndex];
    if (!layer || !frame || layer.kind === "group") continue;
    if (layer.kind === "tilemap") {
      const tileset = tilesets.find((item) => item.id === layer.tilesetId) ?? tilesets[0];
      const shape = tileset ? gridShape(width, height, tileset) : { cols: raw.width, rows: raw.height };
      const tiles = raw.tiles ?? new Array<number>(shape.cols * shape.rows).fill(0);
      placed.set(key(raw.layerIndex, raw.frameIndex), { image: createImage(width, height), tiles });
      continue;
    }
    if (!raw.rgba) continue;
    placed.set(key(raw.layerIndex, raw.frameIndex), { image: expand(width, height, raw) });
  }
  for (const raw of rawCels) {
    if (raw.linkFrame === null) continue;
    const layer = layers[raw.layerIndex];
    const frame = frames[raw.frameIndex];
    const source = rawCels.find((item) => item.layerIndex === raw.layerIndex && item.frameIndex === raw.linkFrame && item.rgba);
    if (!layer || !frame || !source?.rgba || layer.kind === "group" || layer.kind === "tilemap") continue;
    const samePlace = source.x === raw.x && source.y === raw.y;
    const sourceImage = placed.get(key(source.layerIndex, source.frameIndex))?.image;
    if (samePlace && sourceImage) {
      const linkId = `ase-${raw.layerIndex}-${raw.linkFrame}`;
      const sourceRecord = placed.get(key(source.layerIndex, source.frameIndex));
      if (sourceRecord) sourceRecord.linkId = linkId;
      placed.set(key(raw.layerIndex, raw.frameIndex), { image: sourceImage, linkId });
    } else placed.set(key(raw.layerIndex, raw.frameIndex), { image: expand(width, height, { ...source, x: raw.x, y: raw.y }) });
  }
  const cels: Cel[] = [];
  for (const [id, record] of placed) {
    const [layerIndex, frameIndex] = id.split(":").map(Number);
    const layer = layers[layerIndex ?? -1];
    const frame = frames[frameIndex ?? -1];
    const raw = rawCels.find((item) => item.layerIndex === layerIndex && item.frameIndex === frameIndex);
    if (!layer || !frame) continue;
    const cel = createCel(layer.id, frame.id, width, height);
    cel.image = record.image;
    cel.opacity = raw?.opacity ?? 255;
    if (record.linkId) cel.linkId = record.linkId;
    if (record.tiles) cel.tiles = record.tiles;
    cels.push(cel);
  }
  for (const layer of layers) {
    if (layer.kind === "group") continue;
    for (const frame of frames) {
      if (cels.some((cel) => cel.layerId === layer.id && cel.frameId === frame.id)) continue;
      const cel = createCel(layer.id, frame.id, width, height);
      if (layer.kind === "tilemap") {
        const tileset = tilesets.find((item) => item.id === layer.tilesetId) ?? tilesets[0];
        if (tileset) cel.tiles = new Array<number>(gridShape(width, height, tileset).cols * gridShape(width, height, tileset).rows).fill(0);
      }
      cels.push(cel);
    }
  }
  return cels;
}

function expand(width: number, height: number, raw: RawCel): ReturnType<typeof createImage> {
  const image = createImage(width, height);
  if (!raw.rgba) return image;
  for (let y = 0; y < raw.height; y += 1) {
    for (let x = 0; x < raw.width; x += 1) {
      const dx = x + raw.x;
      const dy = y + raw.y;
      if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;
      const from = (y * raw.width + x) * 4;
      const to = (dy * width + dx) * 4;
      image.data[to] = raw.rgba[from] ?? 0;
      image.data[to + 1] = raw.rgba[from + 1] ?? 0;
      image.data[to + 2] = raw.rgba[from + 2] ?? 0;
      image.data[to + 3] = raw.rgba[from + 3] ?? 0;
    }
  }
  return image;
}

function key(layerIndex: number, frameIndex: number): string {
  return `${layerIndex}:${frameIndex}`;
}

function modeFromDepth(depth: number): ColorMode {
  if (depth === 8) return "indexed";
  if (depth === 16) return "grayscale";
  if (depth === 32) return "rgba";
  throw new Error("Arquivo ASE inválido");
}

function loopFromAse(direction: number): LoopDirection {
  if (direction === 1) return "reverse";
  if (direction === 2 || direction === 3) return "ping-pong";
  return "forward";
}

function layerDepth(doc: SpriteDocument, layer: Layer): number {
  let depth = 0;
  let parentId = layer.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId) && depth < 16) {
    seen.add(parentId);
    depth += 1;
    parentId = doc.layers.find((item) => item.id === parentId)?.parentId ?? null;
  }
  return depth;
}

function clampDuration(value: number): number {
  return Math.max(MIN_FRAME_MS, Math.min(5000, value || 100));
}

function readPixel(data: Uint8ClampedArray, index: number): Rgba {
  return { r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0, a: data[index + 3] ?? 0 };
}

function writeRgba(data: Uint8ClampedArray, index: number, color: Rgba): void {
  data[index * 4] = color.r;
  data[index * 4 + 1] = color.g;
  data[index * 4 + 2] = color.b;
  data[index * 4 + 3] = color.a;
}

function wrapChunk(type: number, body: Buf): Uint8Array {
  const out = new Buf();
  out.u32(body.length + 6);
  out.u16(type);
  out.bytes(body.toUint8Array());
  return out.toUint8Array();
}

class Buf {
  private data = new Uint8Array(256);
  length = 0;

  u8(value: number): void {
    this.grow(1);
    this.data[this.length] = value & 255;
    this.length += 1;
  }

  u16(value: number): void {
    this.u8(value);
    this.u8(value >> 8);
  }

  i16(value: number): void {
    this.u16(value < 0 ? value + 0x10000 : value);
  }

  u32(value: number): void {
    this.u16(value);
    this.u16(value >>> 16);
  }

  zeros(count: number): void {
    this.grow(count);
    this.length += count;
  }

  bytes(value: Uint8Array): void {
    this.grow(value.length);
    this.data.set(value, this.length);
    this.length += value.length;
  }

  string(value: string): void {
    const encoded = new TextEncoder().encode(value);
    const bytes = encoded.length > 65535 ? encoded.subarray(0, 65535) : encoded;
    this.u16(bytes.length);
    this.bytes(bytes);
  }

  patchU32(offset: number, value: number): void {
    this.data[offset] = value & 255;
    this.data[offset + 1] = (value >>> 8) & 255;
    this.data[offset + 2] = (value >>> 16) & 255;
    this.data[offset + 3] = (value >>> 24) & 255;
  }

  toUint8Array(): Uint8Array {
    return this.data.slice(0, this.length);
  }

  private grow(extra: number): void {
    if (this.length + extra <= this.data.length) return;
    let size = this.data.length;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.data.subarray(0, this.length));
    this.data = next;
  }
}

class Cursor {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  u8(): number {
    const value = this.data[this.offset] ?? 0;
    this.offset += 1;
    return value;
  }

  u16(): number {
    return this.u8() | (this.u8() << 8);
  }

  i16(): number {
    const value = this.u16();
    return value > 0x7fff ? value - 0x10000 : value;
  }

  u32(): number {
    return this.u16() | (this.u16() << 16);
  }

  skip(count: number): void {
    this.offset += count;
  }

  string(): string {
    const length = this.u16();
    const bytes = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }

  rest(): Uint8Array {
    return this.data.subarray(this.offset);
  }
}
