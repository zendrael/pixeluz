import { findLayer } from "../domain/sprite";
import { rasterizeTiles } from "../domain/tiles";
import type { BlendMode, ImageBuffer, Layer, Rgba, SpriteDocument } from "../domain/types";
import { createImage } from "../domain/image-buffer";
import { blendRgb } from "./blend";

export interface CompositeOptions {
  references?: boolean;
}

function blendPixel(
  dst: Uint8ClampedArray,
  dstIndex: number,
  sr: number,
  sg: number,
  sb: number,
  sa: number,
  opacity: number,
  mode: BlendMode,
): void {
  const srcA = (sa / 255) * (opacity / 255);
  if (srcA <= 0) return;
  const dr = dst[dstIndex] ?? 0;
  const dg = dst[dstIndex + 1] ?? 0;
  const db = dst[dstIndex + 2] ?? 0;
  const da = dst[dstIndex + 3] ?? 0;
  const [mr, mg, mb] = mode === "normal" ? [sr, sg, sb] : blendRgb(mode, sr, sg, sb, dr, dg, db);
  const dstA = da / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0.0001) {
    dst[dstIndex] = 0;
    dst[dstIndex + 1] = 0;
    dst[dstIndex + 2] = 0;
    dst[dstIndex + 3] = 0;
    return;
  }
  const inv = (1 - srcA) * dstA;
  dst[dstIndex] = Math.round((mr * srcA + dr * inv) / outA);
  dst[dstIndex + 1] = Math.round((mg * srcA + dg * inv) / outA);
  dst[dstIndex + 2] = Math.round((mb * srcA + db * inv) / outA);
  dst[dstIndex + 3] = Math.round(outA * 255);
}

function blit(dst: ImageBuffer, src: ImageBuffer, ox: number, oy: number, opacity: number, mode: BlendMode): void {
  for (let y = 0; y < src.height; y++) {
    const dy = y + oy;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = x + ox;
      if (dx < 0 || dx >= dst.width) continue;
      const srcIndex = (y * src.width + x) * 4;
      const alpha = src.data[srcIndex + 3] ?? 0;
      if (alpha === 0) continue;
      blendPixel(
        dst.data,
        (dy * dst.width + dx) * 4,
        src.data[srcIndex] ?? 0,
        src.data[srcIndex + 1] ?? 0,
        src.data[srcIndex + 2] ?? 0,
        alpha,
        opacity,
        mode,
      );
    }
  }
}

export function compositeFrame(doc: SpriteDocument, frameId: string, options: CompositeOptions = {}): ImageBuffer {
  const out = createImage(doc.width, doc.height);
  for (const layer of doc.layers) {
    if (!layerContributes(doc, layer, options.references === true)) continue;
    const cel = doc.cels.find((item) => item.layerId === layer.id && item.frameId === frameId);
    if (!cel || cel.opacity <= 0) continue;
    const opacity = Math.round((stackOpacity(doc, layer) * cel.opacity) / 255);
    if (layer.kind === "tilemap") {
      const tileset = doc.tilesets.find((item) => item.id === layer.tilesetId);
      if (!tileset || !cel.tiles) continue;
      blit(out, rasterizeTiles(doc, tileset, cel.tiles), cel.x, cel.y, opacity, layer.blendMode);
      continue;
    }
    blit(out, cel.image, cel.x, cel.y, opacity, layer.blendMode);
  }
  return out;
}

function layerContributes(doc: SpriteDocument, layer: Layer, references: boolean): boolean {
  if (layer.kind === "group") return false;
  if (layer.kind === "tilemap" && !layer.tilesetId) return false;
  if (layer.kind === "reference" && !references) return false;
  let current: Layer | undefined = layer;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id) || !current.visible || current.opacity <= 0) return false;
    seen.add(current.id);
    current = current.parentId ? findLayer(doc, current.parentId) : undefined;
  }
  return true;
}

function stackOpacity(doc: SpriteDocument, layer: Layer): number {
  let value = 255;
  let current: Layer | undefined = layer;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    value = Math.round((value * current.opacity) / 255);
    current = current.parentId ? findLayer(doc, current.parentId) : undefined;
  }
  return value;
}

export function readPixel(image: ImageBuffer, x: number, y: number): Rgba | null {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const index = (y * image.width + x) * 4;
  return {
    r: image.data[index] ?? 0,
    g: image.data[index + 1] ?? 0,
    b: image.data[index + 2] ?? 0,
    a: image.data[index + 3] ?? 0,
  };
}
