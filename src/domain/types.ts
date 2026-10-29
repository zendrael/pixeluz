export type ColorMode = "rgba" | "indexed" | "grayscale";

export type BlendMode =
  | "normal"
  | "darken"
  | "multiply"
  | "color-burn"
  | "lighten"
  | "screen"
  | "color-dodge"
  | "addition"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "difference"
  | "exclusion"
  | "subtract"
  | "divide"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export type LayerKind = "image" | "group" | "reference" | "tilemap";

export type LoopDirection = "forward" | "reverse" | "ping-pong";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ImageBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PixelChange {
  x: number;
  y: number;
  before: Rgba;
  after: Rgba;
}

export interface Frame {
  id: string;
  durationMs: number;
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  tilesetId?: string;
}

export interface Cel {
  layerId: string;
  frameId: string;
  image: ImageBuffer;
  x: number;
  y: number;
  opacity: number;
  linkId?: string;
  tiles?: number[];
}

export interface Tag {
  id: string;
  name: string;
  from: number;
  to: number;
  direction: LoopDirection;
}

export interface SliceKey {
  frameIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Slice {
  id: string;
  name: string;
  keys: SliceKey[];
}

export interface Tileset {
  id: string;
  name: string;
  tileWidth: number;
  tileHeight: number;
  tiles: ImageBuffer[];
}

export interface GridSettings {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SpriteDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  colorMode: ColorMode;
  palette: Rgba[];
  frames: Frame[];
  layers: Layer[];
  cels: Cel[];
  tags: Tag[];
  slices: Slice[];
  tilesets: Tileset[];
  grid: GridSettings;
}
