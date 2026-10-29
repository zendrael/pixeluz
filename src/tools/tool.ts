import type { BayerSize, BrushShape, GradientKind, InkId, SelectMode, SymmetryMode, TileMode } from "../domain/draw-options";
import { isPaintable } from "../domain/sprite";
import type { ImageBuffer, PixelChange, Rgba, SpriteDocument } from "../domain/types";

export interface EditorApi {
  readonly doc: SpriteDocument;
  readonly foreground: Rgba;
  readonly background: Rgba;
  readonly activeFrameId: string;
  readonly activeLayerId: string;
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
  readonly brushSize: number;
  readonly brushShape: BrushShape;
  readonly brushAngle: number;
  readonly brushOpacity: number;
  readonly customBrush: ImageBuffer | null;
  readonly ink: InkId;
  readonly pixelPerfect: boolean;
  readonly symmetry: SymmetryMode;
  readonly tile: TileMode;
  readonly gradientKind: GradientKind;
  readonly bayer: BayerSize;
  readonly selectMode: SelectMode;
  readonly selection: Uint8Array | null;
  composite(): ImageBuffer;
  setForeground(color: Rgba): void;
  setBackground(color: Rgba): void;
  commitPixels(layerId: string, frameId: string, changes: PixelChange[], alreadyApplied: boolean): void;
  setPreview(image: ImageBuffer | null): void;
  setSelection(mask: Uint8Array | null): void;
  invalidateCanvas(): void;
  setView(zoom: number, panX: number, panY: number): void;
  zoomAt(canvasX: number, canvasY: number, direction: 1 | -1): void;
  panBy(dx: number, dy: number): void;
  pausePlayback(): void;
  beginStroke(): void;
  endStroke(): void;
  activeLayerIsTilemap(): boolean;
  beginTileStroke(): void;
  replayTileStroke(points: Array<[number, number]>, color: Rgba): void;
  commitTileStroke(): void;
}

export type ToolId =
  | "pencil"
  | "eraser"
  | "eyedropper"
  | "bucket"
  | "line"
  | "curve"
  | "rectangle"
  | "ellipse"
  | "contour"
  | "polygon"
  | "gradient"
  | "select-rect"
  | "select-ellipse"
  | "select-lasso"
  | "select-polygon"
  | "select-wand"
  | "move"
  | "zoom"
  | "hand";

export interface ToolContext {
  session: EditorApi;
  spriteX: number;
  spriteY: number;
  canvasX: number;
  canvasY: number;
  button: number;
  shift: boolean;
  alt: boolean;
  pressure: number;
  pointerType: string;
  clicks: number;
}

export function canPaint(session: EditorApi): boolean {
  return isPaintable(session.doc, session.activeLayerId);
}

export interface Tool {
  readonly id: ToolId;
  readonly cursor: string;
  onDown(ctx: ToolContext): void;
  onMove(ctx: ToolContext): void;
  onUp(ctx: ToolContext): void;
  onCancel(): void;
  onKey?(event: KeyboardEvent): boolean;
}
