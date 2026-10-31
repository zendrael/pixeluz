import { MIN_ZOOM, gridCell, gridLines } from "../domain/limits";
import { palmBlocksTouch, pointerSamples } from "./pen";
import { consumeWheelPinch, wheelDeltaPixels, zoomFromPinch } from "./zoom-gesture";
import { sliceKeyAt } from "../domain/slices";
import { placePixel } from "../domain/symmetry";
import type { ImageBuffer } from "../domain/types";
import type { EditorSession } from "../app/session";
import type { Tool, ToolContext } from "../tools/tool";

export interface SpritePoint {
  x: number;
  y: number;
}

type Gesture =
  | { kind: "none" }
  | { kind: "tool"; pointerId: number }
  | { kind: "pan"; pointerId: number; lastX: number; lastY: number }
  | { kind: "pinch"; dist: number; zoom: number; spriteX: number; spriteY: number };

export class Viewport {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly spriteCanvas = document.createElement("canvas");
  private readonly previewCanvas = document.createElement("canvas");
  private readonly onionCanvas = document.createElement("canvas");
  private readonly checker = document.createElement("canvas");
  private readonly observer: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private penSeenAt: number | null = null;
  private gesture: Gesture = { kind: "none" };
  private spaceHeld = false;
  private fittedId: string | null = null;
  private cssWidth = 1;
  private cssHeight = 1;
  private wheelPinch = 0;
  private zoomSlack = 0;

  constructor(
    host: HTMLElement,
    private readonly sessionOf: () => EditorSession,
    private readonly tools: () => Tool,
    private readonly onHover: (point: SpritePoint | null) => void,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "sprite-canvas";
    this.canvas.setAttribute("aria-label", "Editor de sprite");
    host.append(this.canvas);
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D indisponível");
    this.ctx = context;
    this.observer = new ResizeObserver(() => this.onResize());
    this.observer.observe(host);
    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    this.canvas.addEventListener("pointerleave", () => this.onHover(null));
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
  }

  dispose(): void {
    this.observer.disconnect();
  }

  private get session(): EditorSession {
    return this.sessionOf();
  }

  draw(): void {
    this.resizeBackingStore();
    const doc = this.session.doc;
    const zoom = this.session.zoom;
    const panX = this.session.panX;
    const panY = this.session.panY;
    this.ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = this.themeColor("--pixeluz-letterbox", "#212529");
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    this.paintBuffer(this.spriteCanvas, this.session.composite());
    if (this.session.preview) this.paintBuffer(this.previewCanvas, this.session.preview);
    this.ensureChecker(doc.width, doc.height);
    const destW = doc.width * zoom;
    const destH = doc.height * zoom;
    const span = this.tileSpan(destW, destH);
    this.ctx.imageSmoothingEnabled = false;
    for (let tileY = span.y0; tileY <= span.y1; tileY++) {
      for (let tileX = span.x0; tileX <= span.x1; tileX++) {
        const x = panX + tileX * destW;
        const y = panY + tileY * destH;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.checker, x, y, destW, destH);
        this.drawOnion(x, y, destW, destH);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.spriteCanvas, x, y, destW, destH);
        if (this.session.preview) {
          this.ctx.imageSmoothingEnabled = false;
          this.ctx.drawImage(this.previewCanvas, x, y, destW, destH);
        }
      }
    }
    if (this.session.showPixelGrid) this.drawGrid(panX, panY, zoom);
    this.drawSelection(panX, panY, zoom);
    this.drawSlices(panX, panY, zoom);
  }

  fit(): void {
    this.resizeBackingStore();
    if (this.cssWidth < 2 || this.cssHeight < 2) return;
    this.fittedId = this.session.doc.id;
    const { width, height } = this.session.doc;
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(32, Math.floor(Math.min(this.cssWidth / width, this.cssHeight / height) * 0.85)),
    );
    this.session.setView(zoom, (this.cssWidth - width * zoom) / 2, (this.cssHeight - height * zoom) / 2);
    this.draw();
  }

  syncCursor(): void {
    if (this.gesture.kind === "pan" || this.gesture.kind === "pinch") {
      this.canvas.style.cursor = "grabbing";
      return;
    }
    this.canvas.style.cursor = this.spaceHeld ? "grab" : this.tools().cursor;
  }

  setSpaceHeld(held: boolean): void {
    this.spaceHeld = held;
    if (!held && this.gesture.kind === "pan" && this.tools().id !== "hand") this.gesture = { kind: "none" };
    this.syncCursor();
  }

  private onResize(): void {
    this.resizeBackingStore();
    if (this.cssWidth < 2 || this.cssHeight < 2) return;
    if (this.fittedId !== this.session.doc.id) this.fit();
    else this.draw();
  }

  private resizeBackingStore(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = width;
    this.cssHeight = height;
    const bufferW = Math.max(1, Math.floor(width * dpr));
    const bufferH = Math.max(1, Math.floor(height * dpr));
    if (this.canvas.width !== bufferW || this.canvas.height !== bufferH) {
      this.canvas.width = bufferW;
      this.canvas.height = bufferH;
    }
  }

  private themeColor(name: string, fallback: string): string {
    const value = getComputedStyle(this.canvas).getPropertyValue(name).trim();
    return value || fallback;
  }

  private ensureChecker(width: number, height: number): void {
    if (this.checker.width === width && this.checker.height === height) return;
    this.checker.width = width;
    this.checker.height = height;
    const context = this.checker.getContext("2d");
    if (!context) return;
    const light = this.themeColor("--pixeluz-checker-a", "#ffffff");
    const dark = this.themeColor("--pixeluz-checker-b", "#cfd4da");
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        context.fillStyle = (x + y) % 2 === 0 ? light : dark;
        context.fillRect(x, y, 1, 1);
      }
    }
  }

  private paintBuffer(target: HTMLCanvasElement, image: ImageBuffer): void {
    if (target.width !== image.width || target.height !== image.height) {
      target.width = image.width;
      target.height = image.height;
    }
    const context = target.getContext("2d");
    if (!context) return;
    context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  }

  private drawGrid(panX: number, panY: number, zoom: number): void {
    const doc = this.session.doc;
    const cellW = gridCell(doc.grid.width);
    const cellH = gridCell(doc.grid.height);
    const drawX = cellW * zoom >= 4;
    const drawY = cellH * zoom >= 4;
    if (!drawX && !drawY) return;
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.themeColor("--pixeluz-grid", "rgba(0, 0, 0, 0.35)");
    this.ctx.lineWidth = 1;
    if (drawX) {
      for (const x of gridLines(doc.width, cellW, doc.grid.x)) {
        const px = Math.round(panX + x * zoom) + 0.5;
        this.ctx.moveTo(px, panY);
        this.ctx.lineTo(px, panY + doc.height * zoom);
      }
    }
    if (drawY) {
      for (const y of gridLines(doc.height, cellH, doc.grid.y)) {
        const py = Math.round(panY + y * zoom) + 0.5;
        this.ctx.moveTo(panX, py);
        this.ctx.lineTo(panX + doc.width * zoom, py);
      }
    }
    this.ctx.stroke();
  }

  private drawOnion(x: number, y: number, destW: number, destH: number): void {
    for (const layer of this.session.onionLayers()) {
      this.paintBuffer(this.onionCanvas, layer.image);
      this.ctx.save();
      this.ctx.globalAlpha = layer.alpha;
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.onionCanvas, x, y, destW, destH);
      this.ctx.restore();
    }
  }

  private tileSpan(destW: number, destH: number): { x0: number; x1: number; y0: number; y1: number } {
    const tile = this.session.tile;
    const tileX = tile === "x" || tile === "both";
    const tileY = tile === "y" || tile === "both";
    if (!tileX && !tileY) return { x0: 0, x1: 0, y0: 0, y1: 0 };
    const left = Math.floor((0 - this.session.panX) / Math.max(1, destW));
    const right = Math.floor((this.cssWidth - this.session.panX) / Math.max(1, destW));
    const top = Math.floor((0 - this.session.panY) / Math.max(1, destH));
    const bottom = Math.floor((this.cssHeight - this.session.panY) / Math.max(1, destH));
    return {
      x0: tileX ? Math.max(-8, left) : 0,
      x1: tileX ? Math.min(8, right) : 0,
      y0: tileY ? Math.max(-8, top) : 0,
      y1: tileY ? Math.min(8, bottom) : 0,
    };
  }

  private drawSelection(panX: number, panY: number, zoom: number): void {
    const mask = this.session.selection;
    const doc = this.session.doc;
    if (!mask || mask.length !== doc.width * doc.height) return;
    const band = Math.max(2, Math.min(4, Math.round(zoom / 4) || 2));
    for (let y = 0; y < doc.height; y += 1) {
      for (let x = 0; x < doc.width; x += 1) {
        if (mask[y * doc.width + x] !== 1) continue;
        const px = Math.round(panX + x * zoom);
        const py = Math.round(panY + y * zoom);
        this.ctx.fillStyle = "rgba(110, 168, 254, 0.45)";
        this.ctx.fillRect(px, py, zoom, zoom);
        const top = y === 0 || mask[(y - 1) * doc.width + x] !== 1;
        const bottom = y === doc.height - 1 || mask[(y + 1) * doc.width + x] !== 1;
        const left = x === 0 || mask[y * doc.width + x - 1] !== 1;
        const right = x === doc.width - 1 || mask[y * doc.width + x + 1] !== 1;
        if (!top && !bottom && !left && !right) continue;
        this.ctx.fillStyle = (x + y) % 2 === 0 ? "#ffffff" : "#111111";
        if (top) this.ctx.fillRect(px, py, zoom, Math.min(band, zoom));
        if (bottom) this.ctx.fillRect(px, py + Math.max(0, zoom - band), zoom, Math.min(band, zoom));
        if (left) this.ctx.fillRect(px, py, Math.min(band, zoom), zoom);
        if (right) this.ctx.fillRect(px + Math.max(0, zoom - band), py, Math.min(band, zoom), zoom);
      }
    }
  }

  private drawSlices(panX: number, panY: number, zoom: number): void {
    const doc = this.session.doc;
    this.ctx.strokeStyle = "#ffc107";
    this.ctx.lineWidth = 1;
    for (const slice of doc.slices) {
      const key = sliceKeyAt(slice, this.session.activeFrameIndex);
      if (!key) continue;
      this.ctx.strokeRect(Math.round(panX + key.x * zoom) + 0.5, Math.round(panY + key.y * zoom) + 0.5, Math.max(1, key.width * zoom), Math.max(1, key.height * zoom));
    }
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const point = this.canvasPoint(event.clientX, event.clientY);
    if (event.ctrlKey) {
      const consumed = consumeWheelPinch(
        this.wheelPinch,
        wheelDeltaPixels(event.deltaY, event.deltaMode),
        this.session.zoom,
        this.zoomSlack,
      );
      this.wheelPinch = consumed.rest;
      this.zoomSlack = consumed.slack;
      if (consumed.levels !== 0) this.session.zoomBy(point.x, point.y, -consumed.levels);
      return;
    }
    this.zoomSlack = 0;
    this.session.zoomAt(point.x, point.y, event.deltaY < 0 ? 1 : -1);
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button > 2) return;
    this.rememberPen(event);
    if (event.pointerType === "pen") this.releaseTouch();
    if (palmBlocksTouch(event.pointerType, this.penDown(), this.penSeenAt, event.timeStamp)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.canvasPoint(event.clientX, event.clientY);
    this.pointers.set(event.pointerId, { ...point, type: event.pointerType });
    if (this.pointers.size >= 2) {
      this.cancelTool();
      this.startPinch();
      return;
    }
    if (this.spaceHeld || event.button === 1 || this.tools().id === "hand") {
      this.gesture = { kind: "pan", pointerId: event.pointerId, lastX: point.x, lastY: point.y };
      this.syncCursor();
      return;
    }
    this.gesture = { kind: "tool", pointerId: event.pointerId };
    this.tools().onDown(this.toolContext(event, point));
  }

  private onPointerMove(event: PointerEvent): void {
    this.rememberPen(event);
    if (!this.pointers.has(event.pointerId) && palmBlocksTouch(event.pointerType, this.penDown(), this.penSeenAt, event.timeStamp)) return;
    const point = this.canvasPoint(event.clientX, event.clientY);
    const tracked = this.pointers.get(event.pointerId);
    if (tracked) this.pointers.set(event.pointerId, { ...point, type: tracked.type });
    this.publishHover(point);
    if (this.gesture.kind === "pinch") {
      this.updatePinch();
      return;
    }
    if (this.gesture.kind === "pan" && this.gesture.pointerId === event.pointerId) {
      this.session.panBy(point.x - this.gesture.lastX, point.y - this.gesture.lastY);
      this.gesture.lastX = point.x;
      this.gesture.lastY = point.y;
      return;
    }
    if (this.gesture.kind === "tool" && this.gesture.pointerId === event.pointerId) {
      for (const sample of this.strokeSamples(event)) {
        this.tools().onMove(this.toolContext(sample, this.canvasPoint(sample.clientX, sample.clientY)));
      }
    }
  }

  private onPointerUp(event: PointerEvent): void {
    this.rememberPen(event);
    const point = this.canvasPoint(event.clientX, event.clientY);
    this.pointers.delete(event.pointerId);
    if (this.gesture.kind === "tool" && this.gesture.pointerId === event.pointerId) {
      try {
        this.tools().onUp(this.toolContext(event, point));
      } finally {
        this.session.endStroke();
        this.gesture = { kind: "none" };
      }
    } else if (this.gesture.kind === "pan" && this.gesture.pointerId === event.pointerId) {
      this.gesture = { kind: "none" };
    } else if (this.gesture.kind === "pinch" && this.pointers.size < 2) {
      this.gesture = { kind: "none" };
    }
    this.syncCursor();
  }

  private cancelTool(): void {
    if (this.gesture.kind !== "tool") {
      this.gesture = { kind: "none" };
      return;
    }
    try {
      this.tools().onCancel();
    } finally {
      this.session.endStroke();
      this.gesture = { kind: "none" };
    }
  }

  private startPinch(): void {
    const points = [...this.pointers.values()];
    const first = points[0];
    const second = points[1];
    if (!first || !second) return;
    const midX = (first.x + second.x) / 2;
    const midY = (first.y + second.y) / 2;
    this.gesture = {
      kind: "pinch",
      dist: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
      zoom: this.session.zoom,
      spriteX: (midX - this.session.panX) / this.session.zoom,
      spriteY: (midY - this.session.panY) / this.session.zoom,
    };
    this.syncCursor();
  }

  private updatePinch(): void {
    if (this.gesture.kind !== "pinch") return;
    const points = [...this.pointers.values()];
    const first = points[0];
    const second = points[1];
    if (!first || !second) return;
    const midX = (first.x + second.x) / 2;
    const midY = (first.y + second.y) / 2;
    const dist = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
    const next = zoomFromPinch(this.gesture.zoom, this.gesture.dist, dist);
    this.session.setView(next, midX - this.gesture.spriteX * next, midY - this.gesture.spriteY * next);
  }

  private publishHover(point: { x: number; y: number }): void {
    const zoom = this.session.zoom;
    const rawX = Math.floor((point.x - this.session.panX) / zoom);
    const rawY = Math.floor((point.y - this.session.panY) / zoom);
    const placed = placePixel(rawX, rawY, this.session.doc.width, this.session.doc.height, this.session.tile);
    if (!placed) this.onHover(null);
    else this.onHover({ x: placed[0], y: placed[1] });
  }

  private toolContext(event: PointerEvent, point: { x: number; y: number }): ToolContext {
    const zoom = this.session.zoom || 1;
    return {
      session: this.session,
      canvasX: point.x,
      canvasY: point.y,
      spriteX: Math.floor((point.x - this.session.panX) / zoom),
      spriteY: Math.floor((point.y - this.session.panY) / zoom),
      button: event.button,
      shift: event.shiftKey,
      alt: event.altKey,
      pressure: event.pressure,
      pointerType: event.pointerType,
      clicks: event.detail,
    };
  }

  private canvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private rememberPen(event: PointerEvent): void {
    if (event.pointerType === "pen") this.penSeenAt = event.timeStamp;
  }

  private penDown(): boolean {
    for (const pointer of this.pointers.values()) if (pointer.type === "pen") return true;
    return false;
  }

  private releaseTouch(): void {
    for (const [id, pointer] of this.pointers) {
      if (pointer.type === "touch") this.pointers.delete(id);
    }
    if (this.gesture.kind === "none") return;
    if (this.gesture.kind === "pinch" || !this.pointers.has(this.gesture.pointerId)) this.cancelTool();
  }

  private strokeSamples(event: PointerEvent): readonly PointerEvent[] {
    const coalesced = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    return pointerSamples(coalesced, event);
  }
}
