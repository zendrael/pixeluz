import type { ImageBuffer } from "./types";

export type BrushShape = "square" | "circle" | "custom";
export type InkId = "simple" | "alpha" | "copy" | "lock-alpha" | "shading";
export type SymmetryMode = "off" | "horizontal" | "vertical" | "both";
export type TileMode = "off" | "x" | "y" | "both";
export type GradientKind = "linear" | "radial";
export type BayerSize = 2 | 4 | 8;
export type SelectMode = "replace" | "add" | "subtract" | "intersect";

export interface Stamp {
  x: number;
  y: number;
  alpha: number;
}

export interface DrawState {
  brushSize: number;
  brushShape: BrushShape;
  brushAngle: number;
  brushOpacity: number;
  customBrush: ImageBuffer | null;
  ink: InkId;
  pixelPerfect: boolean;
  symmetry: SymmetryMode;
  tile: TileMode;
  gradientKind: GradientKind;
  bayer: BayerSize;
  selectMode: SelectMode;
  selection: Uint8Array | null;
}
