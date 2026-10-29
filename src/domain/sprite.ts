import { createImage } from "./image-buffer";
import type { Cel, Layer, SpriteDocument } from "./types";

export function findCel(doc: SpriteDocument, layerId: string, frameId: string): Cel | undefined {
  return doc.cels.find((cel) => cel.layerId === layerId && cel.frameId === frameId);
}

export function imageLayers(doc: SpriteDocument): Layer[] {
  return doc.layers.filter((layer) => layer.kind === "image");
}

export function contentLayers(doc: SpriteDocument): Layer[] {
  return doc.layers.filter((layer) => layer.kind !== "group");
}

export function paintableLayers(doc: SpriteDocument): Layer[] {
  return doc.layers.filter((layer) => layer.kind === "image" || layer.kind === "reference");
}

export function isPaintable(doc: SpriteDocument, layerId: string): boolean {
  const layer = findLayer(doc, layerId);
  if (!layer || layer.locked || (layer.kind !== "image" && layer.kind !== "reference")) return false;
  let current: Layer | undefined = layer;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current.id) || !current.visible) return false;
    seen.add(current.id);
    current = current.parentId ? findLayer(doc, current.parentId) : undefined;
  }
  return true;
}

export function createCel(layerId: string, frameId: string, width: number, height: number): Cel {
  return {
    layerId,
    frameId,
    image: createImage(width, height),
    x: 0,
    y: 0,
    opacity: 255,
  };
}

export function findLayer(doc: SpriteDocument, layerId: string): Layer | undefined {
  return doc.layers.find((layer) => layer.id === layerId);
}
