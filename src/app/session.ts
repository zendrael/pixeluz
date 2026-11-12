import {
  AddPaletteColorCommand,
  RemovePaletteColorCommand,
  RenameSpriteCommand,
  SetGridCommand,
  SetLayerLockedCommand,
  SetLayerVisibleCommand,
  ReplacePaletteCommand,
  SetPaletteColorCommand,
} from "../commands/document-commands";
import {
  AddFrameCommand,
  DeleteFrameCommand,
  SetFrameDurationCommand,
  duplicateCels,
} from "../commands/frame-commands";
import { History } from "../commands/history";
import { AddLayerCommand, AddTilemapCommand, DeleteLayerCommand, MoveLayerCommand, RenameLayerCommand } from "../commands/layer-commands";
import {
  AddTagCommand,
  CopyCelsCommand,
  DeleteTagCommand,
  LinkCelsCommand,
  MoveFrameCommand,
  ReverseFramesCommand,
  SetCelOffsetCommand,
  SetCelOpacityCommand,
  SetLayerBlendCommand,
  SetLayerOpacityCommand,
  SetTagCommand,
  UnlinkCelCommand,
} from "../commands/animation-commands";
import { AddSliceCommand, DeleteSliceCommand, ResizeCanvasCommand, TileEditCommand } from "../commands/canvas-commands";
import { FilterCelCommand, SetColorModeCommand } from "../commands/color-commands";
import { PaintStrokeCommand } from "../commands/paint-stroke";
import { rgbaEqual } from "../domain/color";
import { filterPixels, type FilterKind, type FilterOptions } from "../domain/filters";
import { fitColor } from "../domain/quantize";
import type { BayerSize, BrushShape, GradientKind, InkId, SelectMode, SymmetryMode, TileMode } from "../domain/draw-options";
import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, createSprite } from "../domain/factory";
import { createId } from "../domain/ids";
import { textDots } from "../domain/bitmap-font";
import { cloneImage, createImage, diffSnapshot, getPixel, setPixel } from "../domain/image-buffer";
import { MAX_BRUSH_SIZE, MAX_FRAME_MS, MAX_LAYERS, MAX_SPRITE_SIZE, MAX_ZOOM, MIN_FRAME_MS, MIN_SPRITE_SIZE, MIN_ZOOM, gridCell } from "../domain/limits";
import { framesInPlaybackOrder, playbackBounds, stepPlayback } from "../domain/playback";
import { rotsprite } from "../domain/rotsprite";
import {
  canvasMaskFromFloating,
  maskBounds,
  morphSelection,
  nudgedPasteOrigin,
  pasteOrigin,
  type SelectionMorph,
} from "../domain/selection";
import { rotateSelectionNearest, scaleSelectionNearest } from "../domain/free-transform";
import { editSelection, type SelectionOp } from "../domain/selection-edit";
import { contentLayers, createCel, findCel, findLayer, paintableLayers } from "../domain/sprite";
import { emptyTileGrid, makeTileset, paintTilePoints, rasterizeTiles, tileCel, type TileDrawMode, type TilePixelMode } from "../domain/tiles";
import type { BlendMode, ColorMode, ImageBuffer, Layer, LayerKind, PixelChange, Rgba, SpriteDocument, Tag } from "../domain/types";
import { compositeFrame } from "../render/composite";
import type { EditorApi } from "../tools/tool";
import type { Command } from "../commands/command";
import {
  getSelectionClipboard,
  setSelectionClipboard,
  takePasteNudge,
  type FloatingSelection,
} from "./selection-clipboard";

export type ChangeKind = "canvas" | "chrome" | "document";

type Listener = (kind: ChangeKind) => void;

export class EditorSession implements EditorApi {
  doc: SpriteDocument;
  foreground: Rgba = { ...DEFAULT_FOREGROUND };
  background: Rgba = { ...DEFAULT_BACKGROUND };
  zoom = 8;
  panX = 0;
  panY = 0;
  showPixelGrid = true;
  brushSize = 1;
  brushShape: BrushShape = "square";
  brushAngle = 0;
  brushOpacity = 255;
  customBrush: ImageBuffer | null = null;
  ink: InkId = "simple";
  pixelPerfect = false;
  symmetry: SymmetryMode = "off";
  tile: TileMode = "off";
  gradientKind: GradientKind = "linear";
  bayer: BayerSize = 4;
  selectMode: SelectMode = "replace";
  floodTolerance = 0;
  selection: Uint8Array | null = null;
  floating: FloatingSelection | null = null;
  onionBefore = 0;
  onionAfter = 0;
  onionOpacityBefore = 0.28;
  onionOpacityAfter = 0.18;
  onionTintBefore: Rgba = { r: 80, g: 160, b: 255, a: 255 };
  onionTintAfter: Rgba = { r: 255, g: 120, b: 80, a: 255 };
  collapsedGroups = new Set<string>();
  tileDrawMode: TileDrawMode = "tiles";
  selectedTile = 1;
  tilePixelMode: TilePixelMode = "auto";
  private tileSnapshot: { tiles: Uint8ClampedArray[]; grids: Array<{ layerId: string; frameId: string; tiles: number[] }> } | null = null;
  preview: ImageBuffer | null = null;
  activeFrameIndex = 0;
  activeLayerId: string;
  private _dirty = false;
  private edits = 0;
  private exportedEdit = -1;
  playing = false;
  private stroking = false;
  private timer = 0;
  private playPing: 1 | -1 = 1;
  private cache: { frameId: string; image: ImageBuffer } | null = null;
  private readonly history = new History();
  private readonly listeners = new Set<Listener>();

  constructor(doc = createSprite()) {
    this.doc = doc;
    this.activeLayerId = doc.layers[0]?.id ?? "";
  }

  get dirty(): boolean {
    return this._dirty;
  }

  set dirty(value: boolean) {
    this._dirty = value;
    if (value) this.edits += 1;
  }

  get projectDownloaded(): boolean {
    return this.exportedEdit >= 0;
  }

  get changedSinceDownload(): boolean {
    return this.projectDownloaded && this.exportedEdit !== this.edits;
  }

  editStamp(): number {
    return this.edits;
  }

  noteProjectDownloaded(edit: number): void {
    if (edit !== this.edits) return;
    this.exportedEdit = edit;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get activeFrameId(): string {
    return this.doc.frames[this.activeFrameIndex]?.id ?? this.doc.frames[0]?.id ?? "";
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  get strokeOpen(): boolean {
    return this.stroking;
  }

  composite(): ImageBuffer {
    const frameId = this.activeFrameId;
    if (this.cache?.frameId === frameId) return this.cache.image;
    const image = compositeFrame(this.doc, frameId, { references: true });
    this.cache = { frameId, image };
    return image;
  }

  setForeground(color: Rgba): void {
    const next = fitColor(color, this.doc.colorMode, this.doc.palette);
    if (rgbaEqual(this.foreground, next)) return;
    this.foreground = next;
    this.dirty = true;
    this.emit("chrome");
  }

  setBackground(color: Rgba): void {
    const next = fitColor(color, this.doc.colorMode, this.doc.palette);
    if (rgbaEqual(this.background, next)) return;
    this.background = next;
    this.dirty = true;
    this.emit("chrome");
  }

  setColorMode(mode: ColorMode): void {
    if (mode === this.doc.colorMode) return;
    this.run(new SetColorModeCommand(mode));
    this.foreground = fitColor(this.foreground, this.doc.colorMode, this.doc.palette);
    this.background = fitColor(this.background, this.doc.colorMode, this.doc.palette);
  }

  applyFilter(kind: FilterKind, options: FilterOptions): void {
    const layer = findLayer(this.doc, this.activeLayerId);
    const cel = this.activeCel();
    if (!layer || layer.locked || !cel) return;
    const next = filterPixels(cel.image, this.selection, kind, options);
    if (samePixels(cel.image.data, next)) return;
    this.run(new FilterCelCommand(cel.layerId, cel.frameId, next));
  }

  exportAnimation(options: { tagRange?: boolean } = {}): Array<{ image: ImageBuffer; durationMs: number }> {
    const frames = this.doc.frames.map((frame) => ({
      image: compositeFrame(this.doc, frame.id),
      durationMs: frame.durationMs,
    }));
    if (!options.tagRange) return frames;
    const bounds = playbackBounds(this.doc, this.activeFrameIndex);
    return framesInPlaybackOrder(frames, bounds.from, bounds.to, bounds.direction);
  }

  commitPixels(layerId: string, frameId: string, changes: PixelChange[], alreadyApplied: boolean): void {
    const layer = findLayer(this.doc, layerId);
    if (!layer || layer.locked) {
      if (alreadyApplied && changes.length > 0) {
        const cel = findCel(this.doc, layerId, frameId);
        if (cel) for (const change of changes) setPixel(cel.image, change.x, change.y, change.before);
      }
      this.cache = null;
      this.emit("canvas");
      return;
    }
    if (changes.length === 0) {
      this.cache = null;
      this.emit("canvas");
      return;
    }
    const command = new PaintStrokeCommand(layerId, frameId, changes);
    if (!alreadyApplied) command.execute(this.doc);
    this.history.pushApplied(command);
    this.dirty = true;
    this.cache = null;
    this.emit("canvas");
  }

  exportFrame(): ImageBuffer {
    return compositeFrame(this.doc, this.activeFrameId);
  }

  onionLayers(): Array<{ image: ImageBuffer; alpha: number; tint: Rgba }> {
    const layers: Array<{ image: ImageBuffer; alpha: number; tint: Rgba }> = [];
    for (let step = this.onionBefore; step >= 1; step -= 1) {
      const frame = this.doc.frames[this.activeFrameIndex - step];
      if (frame) {
        layers.push({
          image: compositeFrame(this.doc, frame.id, { references: true }),
          alpha: this.onionOpacityBefore,
          tint: this.onionTintBefore,
        });
      }
    }
    for (let step = 1; step <= this.onionAfter; step += 1) {
      const frame = this.doc.frames[this.activeFrameIndex + step];
      if (frame) {
        layers.push({
          image: compositeFrame(this.doc, frame.id, { references: true }),
          alpha: this.onionOpacityAfter,
          tint: this.onionTintAfter,
        });
      }
    }
    return layers;
  }

  setOnion(before: number, after: number): void {
    const nextBefore = Math.max(0, Math.min(8, Math.round(before)));
    const nextAfter = Math.max(0, Math.min(8, Math.round(after)));
    if (nextBefore === this.onionBefore && nextAfter === this.onionAfter) return;
    this.onionBefore = nextBefore;
    this.onionAfter = nextAfter;
    this.emit("canvas");
  }

  setOnionStyle(options: {
    opacityBefore?: number;
    opacityAfter?: number;
    tintBefore?: Rgba;
    tintAfter?: Rgba;
  }): void {
    if (options.opacityBefore !== undefined) {
      this.onionOpacityBefore = Math.max(0.05, Math.min(1, options.opacityBefore));
    }
    if (options.opacityAfter !== undefined) {
      this.onionOpacityAfter = Math.max(0.05, Math.min(1, options.opacityAfter));
    }
    if (options.tintBefore) this.onionTintBefore = { ...options.tintBefore, a: 255 };
    if (options.tintAfter) this.onionTintAfter = { ...options.tintAfter, a: 255 };
    this.emit("canvas");
  }

  toggleGroupCollapsed(layerId: string): boolean {
    const layer = findLayer(this.doc, layerId);
    if (!layer || layer.kind !== "group") return false;
    if (this.collapsedGroups.has(layerId)) this.collapsedGroups.delete(layerId);
    else this.collapsedGroups.add(layerId);
    this.emit("chrome");
    return true;
  }

  isGroupCollapsed(layerId: string): boolean {
    return this.collapsedGroups.has(layerId);
  }

  morphActiveSelection(op: SelectionMorph): boolean {
    const mask = this.selection;
    if (!mask) return false;
    const next = morphSelection(mask, this.doc.width, this.doc.height, op);
    if (!next) {
      if (op === "contract" || op === "border") {
        this.stampFloating();
        this.applySelectionMask(null);
        this.emit("chrome");
        return true;
      }
      return false;
    }
    this.stampFloating();
    this.applySelectionMask(next);
    this.emit("chrome");
    return true;
  }

  previewFilter(kind: FilterKind, options: FilterOptions): void {
    const layer = findLayer(this.doc, this.activeLayerId);
    const cel = this.activeCel();
    if (!layer || layer.locked || !cel) {
      this.setPreview(null);
      return;
    }
    const next = filterPixels(cel.image, this.selection, kind, options);
    const before = cel.image.data.slice();
    cel.image.data.set(next);
    const preview = compositeFrame(this.doc, this.activeFrameId, { references: true });
    cel.image.data.set(before);
    this.setPreview(preview);
  }

  freeScaleSelection(percent: number): boolean {
    const factor = Math.max(0.25, Math.min(4, percent / 100));
    if (Math.abs(factor - 1) < 0.001) return false;
    return this.replaceSelectionContent((image, mask) => scaleSelectionNearest(image, mask, factor));
  }

  freeRotateSelection(degrees: number): boolean {
    const turns = ((Math.round(degrees) % 360) + 360) % 360;
    if (turns === 0) return false;
    return this.replaceSelectionContent((image, mask) => rotateSelectionNearest(image, mask, turns));
  }

  resetFloating(float: FloatingSelection): void {
    this.floating = {
      image: cloneImage(float.image),
      mask: float.mask.slice(),
      x: float.x,
      y: float.y,
    };
    this.applySelectionMask(canvasMaskFromFloating(this.floating, this.doc.width, this.doc.height));
    this.emit("canvas");
  }

  private replaceSelectionContent(
    edit: (image: ImageBuffer, mask: Uint8Array) => { image: ImageBuffer; mask: Uint8Array; x: number; y: number } | null,
  ): boolean {
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!layer || (layer.kind !== "image" && layer.kind !== "reference") || !layer.visible || layer.locked) return false;
    if (!this.floating) {
      if (!this.selection) return false;
      if (!this.liftSelection(false)) return false;
    }
    const float = this.floating;
    if (!float) return false;
    const placed = createImage(this.doc.width, this.doc.height);
    const mask = canvasMaskFromFloating(float, this.doc.width, this.doc.height);
    for (let y = 0; y < float.image.height; y += 1) {
      for (let x = 0; x < float.image.width; x += 1) {
        if (float.mask[y * float.image.width + x] !== 1) continue;
        const color = getPixel(float.image, x, y);
        if (color) setPixel(placed, float.x + x, float.y + y, color);
      }
    }
    const next = edit(placed, mask);
    if (!next) return false;
    this.floating = { image: next.image, mask: next.mask, x: next.x, y: next.y };
    this.applySelectionMask(canvasMaskFromFloating(this.floating, this.doc.width, this.doc.height));
    this.emit("canvas");
    return true;
  }

  setPreview(image: ImageBuffer | null): void {
    if (image === null && this.preview === null) return;
    this.preview = image;
    this.emit("canvas");
  }

  setSelection(mask: Uint8Array | null): void {
    this.stampFloating();
    this.applySelectionMask(mask);
  }

  invalidateCanvas(): void {
    this.cache = null;
    this.emit("canvas");
  }

  setView(zoom: number, panX: number, panY: number): void {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
    const x = Math.round(panX);
    const y = Math.round(panY);
    if (nextZoom === this.zoom && x === this.panX && y === this.panY) return;
    this.zoom = nextZoom;
    this.panX = x;
    this.panY = y;
    this.emit("canvas");
  }

  zoomAt(canvasX: number, canvasY: number, direction: 1 | -1): void {
    const old = this.zoom;
    const next =
      direction > 0
        ? Math.min(MAX_ZOOM, old >= 32 ? MAX_ZOOM : Math.max(old + 1, old * 2))
        : Math.max(MIN_ZOOM, old <= 2 ? old - 1 : Math.floor(old / 2));
    if (next === old) return;
    this.zoomBy(canvasX, canvasY, next - old);
  }

  zoomBy(canvasX: number, canvasY: number, delta: number): void {
    const old = this.zoom;
    const spriteX = (canvasX - this.panX) / old;
    const spriteY = (canvasY - this.panY) / old;
    const next = old + delta;
    this.setView(next, canvasX - spriteX * next, canvasY - spriteY * next);
  }

  panBy(dx: number, dy: number): void {
    this.setView(this.zoom, this.panX + dx, this.panY + dy);
  }

  beginStroke(): void {
    if (this.stroking) return;
    this.stampFloating();
    this.stroking = true;
    this.emit("chrome");
  }

  endStroke(): void {
    if (!this.stroking) return;
    this.stroking = false;
    this.emit("chrome");
  }

  pausePlayback(): void {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this.timer);
    this.emit("chrome");
  }

  togglePlayback(): void {
    if (this.playing) {
      this.pausePlayback();
      return;
    }
    this.playing = true;
    const bounds = playbackBounds(this.doc, this.activeFrameIndex);
    this.playPing = bounds.direction === "reverse" ? -1 : 1;
    this.emit("chrome");
    this.schedule();
  }

  togglePixelGrid(): void {
    this.showPixelGrid = !this.showPixelGrid;
    this.emit("chrome");
  }

  setActiveFrame(index: number): void {
    const next = Math.max(0, Math.min(this.doc.frames.length - 1, index));
    if (next === this.activeFrameIndex) return;
    this.activeFrameIndex = next;
    this.cache = null;
    this.emit("document");
  }

  stepFrame(delta: number): void {
    if (this.doc.frames.length === 0) return;
    const next = (this.activeFrameIndex + delta + this.doc.frames.length) % this.doc.frames.length;
    this.setActiveFrame(next);
  }

  addFrame(empty: boolean): void {
    const source = this.doc.frames[this.activeFrameIndex];
    if (!source) return;
    const frame = { id: createId(), durationMs: source.durationMs };
    const cels = empty
      ? contentLayers(this.doc).map((layer) => this.blankCel(layer, frame.id))
      : duplicateCels(
          this.doc.cels.filter((cel) => cel.frameId === source.id),
          frame.id,
        );
    for (const layer of contentLayers(this.doc)) {
      if (!cels.some((cel) => cel.layerId === layer.id)) cels.push(this.blankCel(layer, frame.id));
    }
    const index = this.activeFrameIndex + 1;
    const command = new AddFrameCommand(index, frame, cels);
    command.execute(this.doc);
    this.history.pushApplied(command);
    this.dirty = true;
    this.cache = null;
    this.activeFrameIndex = index;
    this.emit("document");
  }

  deleteActiveFrame(): void {
    if (this.doc.frames.length <= 1) return;
    const index = this.activeFrameIndex;
    const frame = this.doc.frames[index];
    if (!frame) return;
    this.run(new DeleteFrameCommand(index, frame));
    this.clampFrame();
  }

  setFrameDuration(value: number): void {
    const frame = this.doc.frames[this.activeFrameIndex];
    if (!frame) return;
    const duration = Math.max(MIN_FRAME_MS, Math.min(MAX_FRAME_MS, Math.round(value)));
    if (duration === frame.durationMs) return;
    this.run(new SetFrameDurationCommand(frame.id, frame.durationMs, duration));
  }

  setName(name: string): void {
    const next = name.trim() || "Sem título";
    if (next === this.doc.name) return;
    this.run(new RenameSpriteCommand(this.doc.name, next));
  }

  toggleLayer(layerId: string): void {
    const layer = this.doc.layers.find((item) => item.id === layerId);
    if (!layer) return;
    this.run(new SetLayerVisibleCommand(layerId, layer.visible, !layer.visible));
  }

  toggleLayerLock(layerId: string): void {
    const layer = this.doc.layers.find((item) => item.id === layerId);
    if (!layer) return;
    this.run(new SetLayerLockedCommand(layerId, layer.locked, !layer.locked));
  }

  setActiveLayer(layerId: string): void {
    if (!this.doc.layers.some((layer) => layer.id === layerId) || layerId === this.activeLayerId) return;
    this.activeLayerId = layerId;
    this.emit("chrome");
  }

  addLayer(kind: LayerKind = "image"): boolean {
    if (kind === "tilemap") return this.addTilemap();
    if (this.doc.layers.length >= MAX_LAYERS) return false;
    const active = findLayer(this.doc, this.activeLayerId);
    const index = Math.max(0, this.doc.layers.findIndex((layer) => layer.id === this.activeLayerId) + 1);
    const label = kind === "group" ? "Grupo" : kind === "reference" ? "Referência" : "Camada";
    const layer: Layer = {
      id: createId(),
      name: `${label} ${this.doc.layers.length + 1}`,
      kind,
      opacity: 255,
      blendMode: "normal",
      visible: true,
      locked: false,
      parentId: active?.kind === "group" ? active.id : (active?.parentId ?? null),
    };
    const cels = kind === "group" ? [] : this.doc.frames.map((frame) => createCel(layer.id, frame.id, this.doc.width, this.doc.height));
    this.activeLayerId = layer.id;
    this.run(new AddLayerCommand(index, layer, cels));
    return true;
  }

  deleteActiveLayer(): void {
    if (this.doc.layers.length <= 1) return;
    const index = this.doc.layers.findIndex((layer) => layer.id === this.activeLayerId);
    const layer = this.doc.layers[index];
    if (!layer || index < 0) return;
    const paintable = paintableLayers(this.doc);
    if (layer.kind !== "group" && layer.kind !== "tilemap" && paintable.length <= 1) return;
    const neighbor = this.doc.layers[index + 1] ?? this.doc.layers[index - 1];
    if (neighbor) this.activeLayerId = neighbor.id;
    this.run(new DeleteLayerCommand(index, layer));
  }

  renameLayer(layerId: string, name: string): void {
    const layer = findLayer(this.doc, layerId);
    if (!layer) return;
    const next = name.trim() || layer.name;
    if (next === layer.name) return;
    this.run(new RenameLayerCommand(layerId, layer.name, next));
  }

  activeLayerIsTilemap(): boolean {
    return this.tileContext() !== null;
  }

  beginTileStroke(): void {
    const context = this.tileContext();
    if (!context) return;
    const grids = this.doc.cels
      .filter((cel) => this.doc.layers.some((layer) => layer.id === cel.layerId && layer.tilesetId === context.tileset.id))
      .map((cel) => ({ layerId: cel.layerId, frameId: cel.frameId, tiles: (cel.tiles ?? []).slice() }));
    this.tileSnapshot = { tiles: context.tileset.tiles.map((tile) => tile.data.slice()), grids };
  }

  replayTileStroke(points: Array<[number, number]>, color: Rgba): void {
    const context = this.tileContext();
    const snapshot = this.tileSnapshot;
    if (!context || !snapshot) return;
    this.restoreTileSnapshot(context.tileset.id, snapshot);
    paintTilePoints(
      this.doc,
      context.tileset,
      context.cel,
      points,
      color,
      this.tileDrawMode,
      this.tilePixelMode,
      this.selectedTile,
      this.selection,
    );
    this.invalidateCanvas();
  }

  commitTileStroke(): void {
    const context = this.tileContext();
    const snapshot = this.tileSnapshot;
    this.tileSnapshot = null;
    if (!context || !snapshot) return;
    const afterTiles = context.tileset.tiles.map((tile) => tile.data.slice());
    const changedTiles = afterTiles.length !== snapshot.tiles.length || afterTiles.some((data, index) => {
      const before = snapshot.tiles[index];
      return !before || !samePixels(data, before);
    });
    const grids = snapshot.grids.map((grid) => {
      const cel = findCel(this.doc, grid.layerId, grid.frameId);
      return { layerId: grid.layerId, frameId: grid.frameId, before: grid.tiles, after: (cel?.tiles ?? grid.tiles).slice() };
    });
    const changedGrid = grids.some((grid) => grid.before.join(",") !== grid.after.join(","));
    if (!changedTiles && !changedGrid) return;
    this.history.pushApplied(
      new TileEditCommand(context.tileset.id, context.tileset.tileWidth, context.tileset.tileHeight, snapshot.tiles, afterTiles, grids),
    );
    this.dirty = true;
    this.emit("document");
  }

  setGrid(width: number, height: number): void {
    const nextW = gridCell(width);
    const nextH = gridCell(height);
    if (nextW === this.doc.grid.width && nextH === this.doc.grid.height) return;
    this.run(new SetGridCommand(this.doc.grid, { ...this.doc.grid, width: nextW, height: nextH }));
  }

  resizeCanvas(width: number, height: number, anchor: string): void {
    const nextW = clampSize(width);
    const nextH = clampSize(height);
    const shift = anchorShift(this.doc.width, this.doc.height, nextW, nextH, anchor);
    this.applyResize(nextW, nextH, shift.dx, shift.dy);
  }

  cropToSelection(): boolean {
    if (!this.selection) return false;
    const bounds = maskBounds(this.selection, this.doc.width, this.doc.height);
    if (!bounds) return false;
    this.applyResize(bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1, -bounds.minX, -bounds.minY);
    return true;
  }

  autocrop(): void {
    let minX = this.doc.width;
    let minY = this.doc.height;
    let maxX = -1;
    let maxY = -1;
    for (const frame of this.doc.frames) {
      const image = compositeFrame(this.doc, frame.id);
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const pixel = getPixel(image, x, y);
          if (!pixel || pixel.a === 0) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return;
    this.applyResize(maxX - minX + 1, maxY - minY + 1, -minX, -minY);
  }

  applyRotSprite(degrees: number): void {
    const frame = this.doc.frames[this.activeFrameIndex];
    const layer = findLayer(this.doc, this.activeLayerId);
    const cel = frame ? findCel(this.doc, this.activeLayerId, frame.id) : null;
    if (!frame || !layer || !cel || layer.kind === "group") return;
    let sourceImage = cel.image;
    if (layer.kind === "tilemap") {
      const tileset = this.doc.tilesets.find((item) => item.id === layer.tilesetId);
      if (!tileset || !cel.tiles) return;
      sourceImage = rasterizeTiles(this.doc, tileset, cel.tiles);
    }
    const source = this.regionImage(sourceImage);
    if (!source) return;
    const rotated = rotsprite(source.image, degrees);
    const originX = source.x + Math.floor((source.image.width - rotated.width) / 2);
    const originY = source.y + Math.floor((source.image.height - rotated.height) / 2);
    if (layer.kind === "tilemap") {
      this.tilePixelMode = "manual";
      this.tileDrawMode = "pixels";
      this.stampTileDots(rotated, originX, originY);
      return;
    }
    const changes = this.stampImage(cel.image, rotated, originX, originY);
    this.commitPixels(layer.id, frame.id, changes, false);
  }

  insertText(value: string): void {
    const frame = this.doc.frames[this.activeFrameIndex];
    const layer = findLayer(this.doc, this.activeLayerId);
    const cel = frame ? findCel(this.doc, this.activeLayerId, frame.id) : null;
    if (!frame || !layer || !cel || layer.kind === "group" || !value.trim()) return;
    const bounds = this.selection ? maskBounds(this.selection, this.doc.width, this.doc.height) : null;
    const originX = bounds?.minX ?? 0;
    const originY = bounds?.minY ?? 0;
    const dots = textDots(value);
    if (layer.kind === "tilemap") {
      this.tilePixelMode = "manual";
      this.tileDrawMode = "pixels";
      const image = createImage(this.doc.width, this.doc.height);
      for (const [x, y] of dots) setPixel(image, originX + x, originY + y, this.foreground);
      this.stampTileDots(image, 0, 0);
      return;
    }
    const changes: PixelChange[] = [];
    for (const [x, y] of dots) {
      const px = originX + x;
      const py = originY + y;
      if (px < 0 || py < 0 || px >= this.doc.width || py >= this.doc.height) continue;
      const before = getPixel(cel.image, px, py);
      if (!before || rgbaEqual(before, this.foreground)) continue;
      changes.push({ x: px, y: py, before, after: { ...this.foreground } });
    }
    this.commitPixels(layer.id, frame.id, changes, false);
  }

  addSlice(): void {
    const bounds = this.selection ? maskBounds(this.selection, this.doc.width, this.doc.height) : null;
    const key = bounds
      ? { frameIndex: this.activeFrameIndex, x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX + 1, height: bounds.maxY - bounds.minY + 1 }
      : { frameIndex: this.activeFrameIndex, x: 0, y: 0, width: this.doc.width, height: this.doc.height };
    this.run(new AddSliceCommand({ id: createId(), name: `Slice ${this.doc.slices.length + 1}`, keys: [key] }));
  }

  deleteSlice(sliceId: string): void {
    if (!this.doc.slices.some((slice) => slice.id === sliceId)) return;
    this.run(new DeleteSliceCommand(sliceId));
  }

  setSelectedTile(index: number): void {
    this.selectedTile = Math.max(0, Math.round(index));
    this.emit("chrome");
  }

  setTileDrawMode(mode: TileDrawMode): void {
    this.tileDrawMode = mode;
    this.emit("chrome");
  }

  setTilePixelMode(mode: TilePixelMode): void {
    this.tilePixelMode = mode;
    this.emit("chrome");
  }

  moveLayer(direction: -1 | 1): void {
    const index = this.doc.layers.findIndex((layer) => layer.id === this.activeLayerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.doc.layers.length) return;
    this.run(new MoveLayerCommand(index, target));
  }

  setLayerOpacity(value: number): void {
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!layer) return;
    const opacity = clampByte(value);
    if (opacity === layer.opacity) return;
    this.run(new SetLayerOpacityCommand(layer.id, layer.opacity, opacity));
  }

  setLayerBlend(blendMode: BlendMode): void {
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!layer || layer.blendMode === blendMode) return;
    this.run(new SetLayerBlendCommand(layer.id, layer.blendMode, blendMode));
  }

  setCelOpacity(value: number): void {
    const cel = this.activeCel();
    if (!cel) return;
    const opacity = clampByte(value);
    if (opacity === cel.opacity) return;
    this.run(new SetCelOpacityCommand(cel.layerId, cel.frameId, cel.opacity, opacity));
  }

  setCelOffset(x: number, y: number): void {
    const cel = this.activeCel();
    if (!cel) return;
    const nextX = clampOffset(x);
    const nextY = clampOffset(y);
    if (nextX === cel.x && nextY === cel.y) return;
    this.run(new SetCelOffsetCommand(cel.layerId, cel.frameId, cel.x, cel.y, nextX, nextY));
  }

  linkActiveCel(): void {
    const current = this.activeCel();
    const previousFrame = this.doc.frames[this.activeFrameIndex - 1];
    if (!current || !previousFrame) return;
    const previous = findCel(this.doc, current.layerId, previousFrame.id);
    if (!previous) return;
    const ids = new Set<string>([current.frameId, previous.frameId]);
    const linkId = previous.linkId ?? current.linkId ?? createId();
    for (const cel of this.doc.cels) {
      if (cel.layerId !== current.layerId || !cel.linkId) continue;
      if (cel.linkId === previous.linkId || cel.linkId === current.linkId) ids.add(cel.frameId);
    }
    const frameIds = [...ids];
    const images = frameIds.map((frameId) => findCel(this.doc, current.layerId, frameId)?.image).filter((image): image is ImageBuffer => Boolean(image));
    if (images.length !== frameIds.length) return;
    this.run(new LinkCelsCommand(current.layerId, frameIds, linkId, images));
  }

  unlinkActiveCel(): void {
    const cel = this.activeCel();
    if (!cel?.linkId) return;
    this.run(new UnlinkCelCommand(cel.layerId, cel.frameId, cel.linkId, cel.image));
  }

  reversePlaybackRange(): void {
    const bounds = playbackBounds(this.doc, this.activeFrameIndex);
    if (bounds.to <= bounds.from) return;
    this.run(new ReverseFramesCommand(bounds.from, bounds.to));
  }

  moveActiveFrame(direction: -1 | 1): void {
    const target = this.activeFrameIndex + direction;
    if (target < 0 || target >= this.doc.frames.length) return;
    const index = this.activeFrameIndex;
    const command = new MoveFrameCommand(index, target);
    command.execute(this.doc);
    this.history.pushApplied(command);
    this.dirty = true;
    this.cache = null;
    this.activeFrameIndex = target;
    this.emit("document");
  }

  copyCelsToNext(): void {
    const source = this.doc.frames[this.activeFrameIndex];
    const target = this.doc.frames[this.activeFrameIndex + 1];
    if (!source || !target) return;
    this.run(new CopyCelsCommand(source.id, target.id));
  }

  addTag(): void {
    const tag: Tag = {
      id: createId(),
      name: `Tag ${this.doc.tags.length + 1}`,
      from: this.activeFrameIndex,
      to: this.activeFrameIndex,
      direction: "forward",
    };
    this.run(new AddTagCommand(tag));
  }

  deleteTag(tagId: string): void {
    const index = this.doc.tags.findIndex((tag) => tag.id === tagId);
    const tag = this.doc.tags[index];
    if (!tag || index < 0) return;
    this.run(new DeleteTagCommand(index, tag));
  }

  updateTag(tagId: string, patch: Partial<Pick<Tag, "name" | "from" | "to" | "direction">>): void {
    const tag = this.doc.tags.find((item) => item.id === tagId);
    if (!tag) return;
    const next: Tag = {
      ...tag,
      name: patch.name?.trim() || tag.name,
      from: patch.from === undefined ? tag.from : clampIndex(patch.from, this.doc.frames.length),
      to: patch.to === undefined ? tag.to : clampIndex(patch.to, this.doc.frames.length),
      direction: patch.direction ?? tag.direction,
    };
    if (next.name === tag.name && next.from === tag.from && next.to === tag.to && next.direction === tag.direction) return;
    this.run(new SetTagCommand(tagId, { ...tag }, next));
  }

  private activeCel() {
    return findCel(this.doc, this.activeLayerId, this.activeFrameId);
  }

  copySelection(): boolean {
    const cel = this.activeCel();
    const mask = this.selection;
    if (!cel || !mask || mask.length !== cel.image.width * cel.image.height) return false;
    const bounds = maskBounds(mask, cel.image.width, cel.image.height);
    if (!bounds) return false;
    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    const image = createImage(width, height);
    const clip = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (mask[(bounds.minY + y) * cel.image.width + bounds.minX + x] !== 1) continue;
        clip[y * width + x] = 1;
        const color = getPixel(cel.image, bounds.minX + x, bounds.minY + y);
        if (color) setPixel(image, x, y, color);
      }
    }
    if (!clip.some((bit) => bit === 1)) return false;
    setSelectionClipboard({ image, mask: clip, x: bounds.minX, y: bounds.minY });
    this.emit("chrome");
    return true;
  }

  cutSelection(): boolean {
    if (!this.copySelection()) return false;
    return this.liftSelection(false);
  }

  deleteSelectionContents(): boolean {
    const layer = findLayer(this.doc, this.activeLayerId);
    const mask = this.selection;
    if (!layer || (layer.kind !== "image" && layer.kind !== "reference") || !layer.visible || layer.locked || !mask) return false;
    if (this.floating) {
      this.floating = null;
      this.applySelectionMask(mask);
      this.emit("canvas");
      return true;
    }
    const cel = findCel(this.doc, this.activeLayerId, this.activeFrameId);
    if (!cel || mask.length !== cel.image.width * cel.image.height) return false;
    const snapshot = cel.image.data.slice();
    const clear = { r: 0, g: 0, b: 0, a: 0 };
    let touched = false;
    for (let y = 0; y < cel.image.height; y += 1) {
      for (let x = 0; x < cel.image.width; x += 1) {
        if (mask[y * cel.image.width + x] !== 1) continue;
        const current = getPixel(cel.image, x, y);
        if (!current || current.a === 0) continue;
        setPixel(cel.image, x, y, clear);
        touched = true;
      }
    }
    if (!touched) return false;
    const changes = diffSnapshot(cel.image, snapshot);
    if (changes.length > 0) this.commitPixels(this.activeLayerId, this.activeFrameId, changes, true);
    return true;
  }

  selectAll(): boolean {
    const mask = new Uint8Array(this.doc.width * this.doc.height);
    mask.fill(1);
    this.setSelection(mask);
    return true;
  }

  pasteClipboard(): boolean {
    const clip = getSelectionClipboard();
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!clip || !layer || (layer.kind !== "image" && layer.kind !== "reference") || !layer.visible || layer.locked) return false;
    const cel = findCel(this.doc, this.activeLayerId, this.activeFrameId);
    if (!cel) return false;
    this.stampFloating();
    const base = pasteOrigin(clip.x, clip.y, clip.image.width, clip.image.height, cel.image.width, cel.image.height);
    const origin = nudgedPasteOrigin(base, takePasteNudge(), clip.image.width, clip.image.height, cel.image.width, cel.image.height);
    this.floating = {
      image: cloneImage(clip.image),
      mask: clip.mask.slice(),
      x: origin.x,
      y: origin.y,
    };
    this.applySelectionMask(canvasMaskFromFloating(this.floating, cel.image.width, cel.image.height));
    this.emit("chrome");
    return true;
  }

  liftSelection(keepSource: boolean): boolean {
    const layer = findLayer(this.doc, this.activeLayerId);
    const mask = this.selection;
    if (!layer || (layer.kind !== "image" && layer.kind !== "reference") || !layer.visible || layer.locked || !mask) return false;
    if (this.floating) return true;
    const cel = findCel(this.doc, this.activeLayerId, this.activeFrameId);
    if (!cel || mask.length !== cel.image.width * cel.image.height) return false;
    const bounds = maskBounds(mask, cel.image.width, cel.image.height);
    if (!bounds) return false;
    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    const image = createImage(width, height);
    const clip = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (mask[(bounds.minY + y) * cel.image.width + bounds.minX + x] !== 1) continue;
        clip[y * width + x] = 1;
        const color = getPixel(cel.image, bounds.minX + x, bounds.minY + y);
        if (color) setPixel(image, x, y, color);
      }
    }
    if (!clip.some((bit) => bit === 1)) return false;
    if (!keepSource) {
      const snapshot = cel.image.data.slice();
      const clear = { r: 0, g: 0, b: 0, a: 0 };
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (clip[y * width + x] !== 1) continue;
          setPixel(cel.image, bounds.minX + x, bounds.minY + y, clear);
        }
      }
      const changes = diffSnapshot(cel.image, snapshot);
      if (changes.length > 0) this.commitPixels(this.activeLayerId, this.activeFrameId, changes, true);
    }
    this.floating = { image, mask: clip, x: bounds.minX, y: bounds.minY };
    this.applySelectionMask(canvasMaskFromFloating(this.floating, cel.image.width, cel.image.height));
    this.emit("chrome");
    return true;
  }

  moveFloating(dx: number, dy: number): boolean {
    if (!this.floating) return false;
    this.floating = { ...this.floating, x: this.floating.x + dx, y: this.floating.y + dy };
    this.applySelectionMask(canvasMaskFromFloating(this.floating, this.doc.width, this.doc.height));
    this.emit("canvas");
    return true;
  }

  stampFloating(): boolean {
    const float = this.floating;
    if (!float) return false;
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!layer || (layer.kind !== "image" && layer.kind !== "reference") || !layer.visible || layer.locked) {
      this.floating = null;
      return false;
    }
    const cel = findCel(this.doc, this.activeLayerId, this.activeFrameId);
    if (!cel) {
      this.floating = null;
      return false;
    }
    const snapshot = cel.image.data.slice();
    const next = new Uint8Array(cel.image.width * cel.image.height);
    for (let y = 0; y < float.image.height; y += 1) {
      for (let x = 0; x < float.image.width; x += 1) {
        if (float.mask[y * float.image.width + x] !== 1) continue;
        const px = float.x + x;
        const py = float.y + y;
        if (px < 0 || py < 0 || px >= cel.image.width || py >= cel.image.height) continue;
        const color = getPixel(float.image, x, y);
        if (!color) continue;
        setPixel(cel.image, px, py, color);
        next[py * cel.image.width + px] = 1;
      }
    }
    this.floating = null;
    const changes = diffSnapshot(cel.image, snapshot);
    if (changes.length > 0) this.commitPixels(this.activeLayerId, this.activeFrameId, changes, true);
    this.applySelectionMask(next.some((bit) => bit === 1) ? next : null);
    this.emit("chrome");
    return true;
  }

  transformSelection(op: SelectionOp, dx = 0, dy = 0): void {
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!layer || (layer.kind !== "image" && layer.kind !== "reference") || !layer.visible || layer.locked) return;
    if (this.floating) {
      const placed = createImage(this.doc.width, this.doc.height);
      const mask = canvasMaskFromFloating(this.floating, this.doc.width, this.doc.height);
      for (let y = 0; y < this.floating.image.height; y += 1) {
        for (let x = 0; x < this.floating.image.width; x += 1) {
          if (this.floating.mask[y * this.floating.image.width + x] !== 1) continue;
          const color = getPixel(this.floating.image, x, y);
          if (color) setPixel(placed, this.floating.x + x, this.floating.y + y, color);
        }
      }
      const next = editSelection(placed, mask, op, dx, dy);
      if (!next) return;
      const bounds = maskBounds(next, placed.width, placed.height);
      if (!bounds) return;
      const width = bounds.maxX - bounds.minX + 1;
      const height = bounds.maxY - bounds.minY + 1;
      const image = createImage(width, height);
      const clip = new Uint8Array(width * height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (next[(bounds.minY + y) * placed.width + bounds.minX + x] !== 1) continue;
          clip[y * width + x] = 1;
          const color = getPixel(placed, bounds.minX + x, bounds.minY + y);
          if (color) setPixel(image, x, y, color);
        }
      }
      this.floating = { image, mask: clip, x: bounds.minX, y: bounds.minY };
      this.applySelectionMask(canvasMaskFromFloating(this.floating, this.doc.width, this.doc.height));
      this.emit("canvas");
      return;
    }
    const mask = this.selection;
    if (!mask) return;
    const cel = findCel(this.doc, this.activeLayerId, this.activeFrameId);
    if (!cel) return;
    const snapshot = cel.image.data.slice();
    const next = editSelection(cel.image, mask, op, dx, dy);
    const changes = diffSnapshot(cel.image, snapshot);
    if (changes.length > 0) this.commitPixels(this.activeLayerId, this.activeFrameId, changes, true);
    this.applySelectionMask(next);
  }

  captureBrush(): boolean {
    const mask = this.selection;
    const cel = findCel(this.doc, this.activeLayerId, this.activeFrameId);
    if (!mask || !cel) return false;
    const bounds = maskBounds(mask, cel.image.width, cel.image.height);
    if (!bounds) return false;
    const width = Math.min(MAX_BRUSH_SIZE, bounds.maxX - bounds.minX + 1);
    const height = Math.min(MAX_BRUSH_SIZE, bounds.maxY - bounds.minY + 1);
    const image = createImage(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[(bounds.minY + y) * cel.image.width + bounds.minX + x] !== 1) continue;
        const color = getPixel(cel.image, bounds.minX + x, bounds.minY + y);
        if (color) setPixel(image, x, y, color);
      }
    }
    this.customBrush = image;
    this.brushShape = "custom";
    this.emit("chrome");
    return true;
  }

  clearSelection(): void {
    this.stampFloating();
    this.applySelectionMask(null);
  }

  private applySelectionMask(mask: Uint8Array | null): void {
    if (!mask || !mask.some((bit) => bit === 1)) {
      this.selection = null;
    } else {
      this.selection = new Uint8Array(mask);
    }
    this.emit("canvas");
  }

  setBrushSize(value: number): void {
    this.setNumber("brushSize", value, 1, MAX_BRUSH_SIZE);
  }

  setBrushAngle(value: number): void {
    const next = ((Math.round(value) % 360) + 360) % 360;
    if (next === this.brushAngle) return;
    this.brushAngle = next;
    this.emit("chrome");
  }

  setBrushOpacity(value: number): void {
    this.setNumber("brushOpacity", value, 0, 255);
  }

  setBrushShape(shape: BrushShape): void {
    if (shape === this.brushShape) return;
    this.brushShape = shape;
    this.emit("chrome");
  }

  setInk(ink: InkId): void {
    if (ink === this.ink) return;
    this.ink = ink;
    this.emit("chrome");
  }

  setPixelPerfect(on: boolean): void {
    if (on === this.pixelPerfect) return;
    this.pixelPerfect = on;
    this.emit("chrome");
  }

  setSymmetry(mode: SymmetryMode): void {
    if (mode === this.symmetry) return;
    this.symmetry = mode;
    this.emit("chrome");
  }

  setTile(mode: TileMode): void {
    if (mode === this.tile) return;
    this.tile = mode;
    this.emit("canvas");
  }

  setGradientKind(kind: GradientKind): void {
    if (kind === this.gradientKind) return;
    this.gradientKind = kind;
    this.emit("chrome");
  }

  setBayer(size: BayerSize): void {
    if (size === this.bayer) return;
    this.bayer = size;
    this.emit("chrome");
  }

  setSelectMode(mode: SelectMode): void {
    if (mode === this.selectMode) return;
    this.selectMode = mode;
    this.emit("chrome");
  }

  setFloodTolerance(value: number): void {
    const next = Math.max(0, Math.min(255, Math.round(value)));
    if (next === this.floodTolerance) return;
    this.floodTolerance = next;
    this.emit("chrome");
  }

  loadPalette(colors: Rgba[]): void {
    if (colors.length === 0 || colors.length > 256) return;
    this.run(new ReplacePaletteCommand(colors));
  }

  setPaletteColor(index: number, color: Rgba): void {
    const current = this.doc.palette[index];
    if (!current || rgbaEqual(current, color)) return;
    this.run(new SetPaletteColorCommand(index, current, color));
  }

  addPaletteColor(color: Rgba): void {
    if (this.doc.palette.length >= 256) return;
    this.run(new AddPaletteColorCommand(color));
  }

  removePaletteColor(index: number): void {
    const color = this.doc.palette[index];
    if (!color || this.doc.palette.length <= 1) return;
    this.run(new RemovePaletteColorCommand(index, color));
  }

  undo(): void {
    if (this.stroking || !this.history.undo(this.doc)) return;
    this.afterHistory();
  }

  redo(): void {
    if (this.stroking || !this.history.redo(this.doc)) return;
    this.afterHistory();
  }

  replaceDocument(doc: SpriteDocument, foreground: Rgba, background: Rgba): void {
    this.pausePlayback();
    this.doc = doc;
    this.foreground = { ...foreground };
    this.background = { ...background };
    this.history.clear();
    this.activeFrameIndex = 0;
    this.activeLayerId = doc.layers.find((layer) => layer.kind === "image")?.id ?? doc.layers[0]?.id ?? "";
    this.preview = null;
    this.selection = null;
    this.floating = null;
    this.cache = null;
    this.edits = 0;
    this.exportedEdit = -1;
    this.dirty = false;
    this.stroking = false;
    this.emit("document");
  }

  markClean(): void {
    this.dirty = false;
    this.emit("chrome");
  }

  private setNumber(key: "brushSize" | "brushOpacity", value: number, min: number, max: number): void {
    const next = Math.max(min, Math.min(max, Math.round(value)));
    if (next === this[key]) return;
    this[key] = next;
    this.emit("chrome");
  }

  private blankCel(layer: Layer, frameId: string) {
    const tileset = layer.kind === "tilemap" ? this.doc.tilesets.find((item) => item.id === layer.tilesetId) : undefined;
    return tileset ? tileCel(this.doc, layer.id, frameId, tileset) : createCel(layer.id, frameId, this.doc.width, this.doc.height);
  }

  private addTilemap(): boolean {
    if (this.doc.layers.length >= MAX_LAYERS) return false;
    const existing = this.doc.tilesets[0];
    const created = existing ? null : makeTileset(this.doc, createId());
    const tileset = existing ?? created;
    if (!tileset) return false;
    const active = findLayer(this.doc, this.activeLayerId);
    const index = Math.max(0, this.doc.layers.findIndex((layer) => layer.id === this.activeLayerId) + 1);
    const layer: Layer = {
      id: createId(),
      name: `Tilemap ${this.doc.layers.filter((item) => item.kind === "tilemap").length + 1}`,
      kind: "tilemap",
      opacity: 255,
      blendMode: "normal",
      visible: true,
      locked: false,
      parentId: active?.kind === "group" ? active.id : (active?.parentId ?? null),
      tilesetId: tileset.id,
    };
    const cels = this.doc.frames.map((frame) => tileCel(this.doc, layer.id, frame.id, tileset));
    this.activeLayerId = layer.id;
    this.run(new AddTilemapCommand(index, layer, cels, created));
    return true;
  }

  private tileContext() {
    const frame = this.doc.frames[this.activeFrameIndex];
    const layer = findLayer(this.doc, this.activeLayerId);
    if (!frame || layer?.kind !== "tilemap" || layer.locked || !layer.visible || !layer.tilesetId) return null;
    const tileset = this.doc.tilesets.find((item) => item.id === layer.tilesetId);
    const cel = findCel(this.doc, layer.id, frame.id);
    if (!tileset || !cel) return null;
    if (!cel.tiles) cel.tiles = emptyTileGrid(this.doc.width, this.doc.height, tileset);
    return { layer, tileset, cel };
  }

  private restoreTileSnapshot(tilesetId: string, snapshot: { tiles: Uint8ClampedArray[]; grids: Array<{ layerId: string; frameId: string; tiles: number[] }> }): void {
    const tileset = this.doc.tilesets.find((item) => item.id === tilesetId);
    if (!tileset) return;
    while (tileset.tiles.length > snapshot.tiles.length) tileset.tiles.pop();
    snapshot.tiles.forEach((data, index) => {
      const tile = tileset.tiles[index];
      if (tile) tile.data = new Uint8ClampedArray(data);
    });
    for (const grid of snapshot.grids) {
      const cel = findCel(this.doc, grid.layerId, grid.frameId);
      if (cel) cel.tiles = grid.tiles.slice();
    }
  }

  private applyResize(width: number, height: number, dx: number, dy: number): void {
    if (width === this.doc.width && height === this.doc.height && dx === 0 && dy === 0) return;
    this.run(new ResizeCanvasCommand(width, height, dx, dy));
    this.selection = null;
    this.invalidateCanvas();
  }

  private regionImage(image: ImageBuffer): { image: ImageBuffer; x: number; y: number } | null {
    const bounds = this.selection ? maskBounds(this.selection, this.doc.width, this.doc.height) : null;
    if (bounds) {
      const width = bounds.maxX - bounds.minX + 1;
      const height = bounds.maxY - bounds.minY + 1;
      const cropped = createImage(width, height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pixel = getPixel(image, bounds.minX + x, bounds.minY + y);
          if (pixel) setPixel(cropped, x, y, pixel);
        }
      }
      return { image: cropped, x: bounds.minX, y: bounds.minY };
    }
    let minX = image.width;
    let minY = image.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const pixel = getPixel(image, x, y);
        if (!pixel || pixel.a === 0) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX) return null;
    const cropped = createImage(maxX - minX + 1, maxY - minY + 1);
    for (let y = 0; y < cropped.height; y += 1) {
      for (let x = 0; x < cropped.width; x += 1) {
        const pixel = getPixel(image, minX + x, minY + y);
        if (pixel) setPixel(cropped, x, y, pixel);
      }
    }
    return { image: cropped, x: minX, y: minY };
  }

  private stampImage(target: ImageBuffer, source: ImageBuffer, originX: number, originY: number): PixelChange[] {
    const changes: PixelChange[] = [];
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const pixel = getPixel(source, x, y);
        if (!pixel || pixel.a === 0) continue;
        const px = originX + x;
        const py = originY + y;
        if (px < 0 || py < 0 || px >= target.width || py >= target.height) continue;
        const before = getPixel(target, px, py);
        if (!before || rgbaEqual(before, pixel)) continue;
        changes.push({ x: px, y: py, before, after: pixel });
      }
    }
    return changes;
  }

  private stampTileDots(image: ImageBuffer, originX: number, originY: number): void {
    const context = this.tileContext();
    if (!context) return;
    this.tilePixelMode = "manual";
    this.tileDrawMode = "pixels";
    this.beginTileStroke();
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const pixel = getPixel(image, x, y);
        if (!pixel || pixel.a === 0) continue;
        paintTilePoints(this.doc, context.tileset, context.cel, [[originX + x, originY + y]], pixel, "pixels", "manual", this.selectedTile, null);
      }
    }
    this.commitTileStroke();
  }

  private run(command: Command): void {
    command.execute(this.doc);
    this.history.pushApplied(command);
    this.dirty = true;
    this.cache = null;
    this.clampFrame();
    this.emit("document");
  }

  private afterHistory(): void {
    this.dirty = true;
    this.cache = null;
    this.preview = null;
    this.clampFrame();
    if (!this.doc.layers.some((layer) => layer.id === this.activeLayerId)) {
      this.activeLayerId = paintableLayers(this.doc)[0]?.id ?? this.doc.layers[0]?.id ?? "";
    }
    this.emit("document");
  }

  private clampFrame(): void {
    if (this.activeFrameIndex >= this.doc.frames.length) {
      this.activeFrameIndex = Math.max(0, this.doc.frames.length - 1);
    }
  }

  private schedule(): void {
    const bounds = playbackBounds(this.doc, this.activeFrameIndex);
    const frame = this.doc.frames[this.activeFrameIndex];
    const delay = Math.max(MIN_FRAME_MS, frame?.durationMs ?? 100);
    this.timer = window.setTimeout(() => {
      if (!this.playing) return;
      const step = stepPlayback(this.activeFrameIndex, bounds.from, bounds.to, bounds.direction, this.playPing);
      this.activeFrameIndex = step.index;
      this.playPing = step.ping;
      this.cache = null;
      this.emit("document");
      this.schedule();
    }, delay);
  }

  private emit(kind: ChangeKind): void {
    for (const listener of this.listeners) listener(kind);
  }
}

function samePixels(left: Uint8ClampedArray, right: Uint8ClampedArray): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampOffset(value: number): number {
  return Math.max(-1024, Math.min(1024, Math.round(value)));
}

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(Math.max(0, length - 1), Math.round(value)));
}

function clampSize(value: number): number {
  return Math.max(MIN_SPRITE_SIZE, Math.min(MAX_SPRITE_SIZE, Math.round(value) || MIN_SPRITE_SIZE));
}

function anchorShift(width: number, height: number, nextW: number, nextH: number, anchor: string): { dx: number; dy: number } {
  const horizontal = anchor.includes("e") ? nextW - width : anchor.includes("w") ? 0 : Math.floor((nextW - width) / 2);
  const vertical = anchor.includes("s") ? nextH - height : anchor.includes("n") ? 0 : Math.floor((nextH - height) / 2);
  return { dx: horizontal, dy: vertical };
}
