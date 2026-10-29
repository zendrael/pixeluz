import { createId } from "../domain/ids";
import { MAX_SPRITE_SIZE, MIN_SPRITE_SIZE } from "../domain/limits";
import type {
  BlendMode,
  Cel,
  ColorMode,
  Frame,
  GridSettings,
  ImageBuffer,
  Layer,
  LayerKind,
  LoopDirection,
  Rgba,
  Slice,
  SpriteDocument,
  Tag,
  Tileset,
} from "../domain/types";

export interface LoadedProject {
  sprite: SpriteDocument;
  foreground: Rgba;
  background: Rgba;
}

const BLEND_MODES = new Set<BlendMode>([
  "normal",
  "darken",
  "multiply",
  "color-burn",
  "lighten",
  "screen",
  "color-dodge",
  "addition",
  "overlay",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
  "subtract",
  "divide",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

const LAYER_KINDS = new Set<LayerKind>(["image", "group", "reference", "tilemap"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readColor(value: unknown, label: string): Rgba {
  if (!isRecord(value)) throw new Error(label);
  const channels = [value.r, value.g, value.b, value.a];
  if (!channels.every((channel) => typeof channel === "number" && channel >= 0 && channel <= 255)) {
    throw new Error(label);
  }
  return {
    r: Math.round(value.r as number),
    g: Math.round(value.g as number),
    b: Math.round(value.b as number),
    a: Math.round(value.a as number),
  };
}

function encodePixels(data: Uint8ClampedArray): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < data.length; index += chunk) {
    binary += String.fromCharCode(...data.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function decodePixels(pixels: string, width: number, height: number): ImageBuffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Imagem do cel inválida");
  }
  const binary = atob(pixels);
  if (binary.length !== width * height * 4) throw new Error("Imagem do cel inválida");
  const data = new Uint8ClampedArray(binary.length);
  for (let index = 0; index < binary.length; index++) data[index] = binary.charCodeAt(index);
  return { width, height, data };
}

function writeImage(image: ImageBuffer): { width: number; height: number; pixels: string } {
  return { width: image.width, height: image.height, pixels: encodePixels(image.data) };
}

function readImage(value: unknown): ImageBuffer {
  if (!isRecord(value) || typeof value.pixels !== "string" || typeof value.width !== "number" || typeof value.height !== "number") {
    throw new Error("Imagem do cel inválida");
  }
  return decodePixels(value.pixels, value.width, value.height);
}

export function serializeProject(project: LoadedProject): string {
  const sprite = project.sprite;
  const writtenLinks = new Set<string>();
  return JSON.stringify({
    version: 1,
    foreground: project.foreground,
    background: project.background,
    sprite: {
      id: sprite.id,
      name: sprite.name,
      width: sprite.width,
      height: sprite.height,
      colorMode: sprite.colorMode,
      palette: sprite.palette,
      frames: sprite.frames,
      layers: sprite.layers,
      cels: sprite.cels.map((cel) => {
        const payload: Record<string, unknown> = {
          layerId: cel.layerId,
          frameId: cel.frameId,
          x: cel.x,
          y: cel.y,
          opacity: cel.opacity,
        };
        if (cel.linkId) payload.linkId = cel.linkId;
        if (cel.tiles) payload.tiles = cel.tiles;
        if (!cel.linkId || !writtenLinks.has(cel.linkId)) {
          if (cel.linkId) writtenLinks.add(cel.linkId);
          payload.image = writeImage(cel.image);
        }
        return payload;
      }),
      tags: sprite.tags,
      slices: sprite.slices,
      tilesets: sprite.tilesets.map((tileset) => ({
        id: tileset.id,
        name: tileset.name,
        tileWidth: tileset.tileWidth,
        tileHeight: tileset.tileHeight,
        tiles: tileset.tiles.map(writeImage),
      })),
      grid: sprite.grid,
    },
  });
}

export function deserializeProject(raw: string): LoadedProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Arquivo de projeto inválido");
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.sprite)) {
    throw new Error("Versão de projeto não suportada");
  }
  const sprite = parsed.sprite;
  if (sprite.colorMode !== "rgba" && sprite.colorMode !== "indexed" && sprite.colorMode !== "grayscale") {
    throw new Error("Modo de cor não suportado");
  }
  const width = sprite.width;
  const height = sprite.height;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_SPRITE_SIZE ||
    height < MIN_SPRITE_SIZE ||
    width > MAX_SPRITE_SIZE ||
    height > MAX_SPRITE_SIZE
  ) {
    throw new Error("Tamanho de sprite inválido");
  }

  const frames = readFrames(sprite.frames);
  const layers = readLayers(sprite.layers);
  const frameIds = new Set(frames.map((frame) => frame.id));
  const layerIds = new Set(layers.map((layer) => layer.id));
  const cels = readCels(sprite.cels, frameIds, layerIds);
  if (frames.length === 0 || layers.length === 0) throw new Error("Arquivo de projeto inválido");

  const document: SpriteDocument = {
    id: typeof sprite.id === "string" && sprite.id ? sprite.id : createId(),
    name: typeof sprite.name === "string" && sprite.name.trim() ? sprite.name : "Sem título",
    width,
    height,
    colorMode: sprite.colorMode as ColorMode,
    palette: readPalette(sprite.palette),
    frames,
    layers,
    cels,
    tags: readTags(sprite.tags),
    slices: readSlices(sprite.slices),
    tilesets: readTilesets(sprite.tilesets),
    grid: readGrid(sprite.grid),
  };

  return {
    sprite: document,
    foreground: readColor(parsed.foreground, "Cor de frente inválida"),
    background: readColor(parsed.background, "Cor de fundo inválida"),
  };
}

function readFrames(value: unknown): Frame[] {
  if (!Array.isArray(value)) throw new Error("Arquivo de projeto inválido");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.durationMs !== "number") {
      throw new Error("Arquivo de projeto inválido");
    }
    return { id: item.id, durationMs: Math.max(1, Math.round(item.durationMs)) };
  });
}

function readLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) throw new Error("Arquivo de projeto inválido");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      throw new Error("Arquivo de projeto inválido");
    }
    const kind = item.kind;
    const blendMode = item.blendMode;
    if (typeof kind !== "string" || !LAYER_KINDS.has(kind as LayerKind)) throw new Error("Arquivo de projeto inválido");
    if (typeof blendMode !== "string" || !BLEND_MODES.has(blendMode as BlendMode)) {
      throw new Error("Arquivo de projeto inválido");
    }
    return {
      id: item.id,
      name: item.name,
      kind: kind as LayerKind,
      opacity: typeof item.opacity === "number" ? Math.round(item.opacity) : 255,
      blendMode: blendMode as BlendMode,
      visible: item.visible !== false,
      locked: item.locked === true,
      parentId: typeof item.parentId === "string" ? item.parentId : null,
      ...(typeof item.tilesetId === "string" ? { tilesetId: item.tilesetId } : {}),
    };
  });
}

function readCels(value: unknown, frameIds: Set<string>, layerIds: Set<string>): Cel[] {
  if (!Array.isArray(value)) throw new Error("Arquivo de projeto inválido");
  const shared = new Map<string, ImageBuffer>();
  return value.map((item) => {
    if (!isRecord(item) || typeof item.layerId !== "string" || typeof item.frameId !== "string") {
      throw new Error("Arquivo de projeto inválido");
    }
    if (!frameIds.has(item.frameId) || !layerIds.has(item.layerId)) throw new Error("Arquivo de projeto inválido");
    const linkId = typeof item.linkId === "string" && item.linkId ? item.linkId : undefined;
    let image = linkId ? shared.get(linkId) : undefined;
    if (!image) {
      image = readImage(item.image);
      if (linkId) shared.set(linkId, image);
    }
    const cel: Cel = {
      layerId: item.layerId,
      frameId: item.frameId,
      x: typeof item.x === "number" ? Math.round(item.x) : 0,
      y: typeof item.y === "number" ? Math.round(item.y) : 0,
      opacity: typeof item.opacity === "number" ? Math.round(item.opacity) : 255,
      image,
    };
    if (linkId) cel.linkId = linkId;
    if (Array.isArray(item.tiles)) {
      cel.tiles = item.tiles.map((value) => (typeof value === "number" && value > 0 ? Math.round(value) : 0));
    }
    return cel;
  });
}

function readPalette(value: unknown): Rgba[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 256) throw new Error("Paleta inválida");
  return value.map((color) => readColor(color, "Paleta inválida"));
}

function readTags(value: unknown): Tag[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Arquivo de projeto inválido");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      throw new Error("Arquivo de projeto inválido");
    }
    const direction = item.direction;
    if (direction !== "forward" && direction !== "reverse" && direction !== "ping-pong") {
      throw new Error("Arquivo de projeto inválido");
    }
    return {
      id: item.id,
      name: item.name,
      from: typeof item.from === "number" ? item.from : 0,
      to: typeof item.to === "number" ? item.to : 0,
      direction: direction as LoopDirection,
    };
  });
}

function readSlices(value: unknown): Slice[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Arquivo de projeto inválido");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string" || !Array.isArray(item.keys)) {
      throw new Error("Arquivo de projeto inválido");
    }
    return {
      id: item.id,
      name: item.name,
      keys: item.keys.map((key) => {
        if (!isRecord(key)) throw new Error("Arquivo de projeto inválido");
        return {
          frameIndex: typeof key.frameIndex === "number" ? key.frameIndex : 0,
          x: typeof key.x === "number" ? key.x : 0,
          y: typeof key.y === "number" ? key.y : 0,
          width: typeof key.width === "number" ? key.width : 1,
          height: typeof key.height === "number" ? key.height : 1,
        };
      }),
    };
  });
}

function readTilesets(value: unknown): Tileset[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Arquivo de projeto inválido");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string" || !Array.isArray(item.tiles)) {
      throw new Error("Arquivo de projeto inválido");
    }
    return {
      id: item.id,
      name: item.name,
      tileWidth: typeof item.tileWidth === "number" ? item.tileWidth : 16,
      tileHeight: typeof item.tileHeight === "number" ? item.tileHeight : 16,
      tiles: item.tiles.map(readImage),
    };
  });
}

function readGrid(value: unknown): GridSettings {
  if (!isRecord(value)) return { width: 16, height: 16, x: 0, y: 0 };
  return {
    width: typeof value.width === "number" ? value.width : 16,
    height: typeof value.height === "number" ? value.height : 16,
    x: typeof value.x === "number" ? value.x : 0,
    y: typeof value.y === "number" ? value.y : 0,
  };
}
