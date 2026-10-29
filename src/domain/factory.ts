import { BLACK, WHITE } from "./color";
import { createImage } from "./image-buffer";
import { createId } from "./ids";
import { DEFAULT_FRAME_MS, MAX_SPRITE_SIZE, MIN_SPRITE_SIZE } from "./limits";
import type { Rgba, SpriteDocument } from "./types";

const DEFAULT_HEX = [
  "#1a1c2c",
  "#5d275d",
  "#b13e53",
  "#ef7d57",
  "#ffcd75",
  "#a7f070",
  "#38b764",
  "#257179",
  "#29366f",
  "#3b5dc9",
  "#41a6f6",
  "#73eff7",
  "#f4f4f4",
  "#94b0c2",
  "#566c86",
  "#333c57",
];

function hex(value: string): Rgba {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
    a: 255,
  };
}

export function defaultPalette(): Rgba[] {
  return DEFAULT_HEX.map(hex);
}

export function createSprite(width = 32, height = 32, name = "Sem título"): SpriteDocument {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_SPRITE_SIZE ||
    height < MIN_SPRITE_SIZE ||
    width > MAX_SPRITE_SIZE ||
    height > MAX_SPRITE_SIZE
  ) {
    throw new Error("Tamanho de sprite inválido");
  }

  const layerId = createId();
  const frameId = createId();
  return {
    id: createId(),
    name: name.trim() || "Sem título",
    width,
    height,
    colorMode: "rgba",
    palette: defaultPalette(),
    frames: [{ id: frameId, durationMs: DEFAULT_FRAME_MS }],
    layers: [
      {
        id: layerId,
        name: "Camada 1",
        kind: "image",
        opacity: 255,
        blendMode: "normal",
        visible: true,
        locked: false,
        parentId: null,
      },
    ],
    cels: [
      {
        layerId,
        frameId,
        image: createImage(width, height),
        x: 0,
        y: 0,
        opacity: 255,
      },
    ],
    tags: [],
    slices: [],
    tilesets: [],
    grid: { width: 16, height: 16, x: 0, y: 0 },
  };
}

export const DEFAULT_FOREGROUND = BLACK;
export const DEFAULT_BACKGROUND = WHITE;
