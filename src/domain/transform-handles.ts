import { maskBounds, type MaskBounds } from "./selection";

export type TransformHandle = "nw" | "ne" | "sw" | "se" | "rotate";

export interface HandlePoint {
  id: TransformHandle;
  x: number;
  y: number;
}

/** Screen-space handle centers — must match viewport drawing. */
export function transformHandlePoints(
  bounds: MaskBounds,
  panX: number,
  panY: number,
  zoom: number,
): HandlePoint[] {
  const x = panX + bounds.minX * zoom;
  const y = panY + bounds.minY * zoom;
  const w = Math.max(1, (bounds.maxX - bounds.minX + 1) * zoom);
  const h = Math.max(1, (bounds.maxY - bounds.minY + 1) * zoom);
  return [
    { id: "nw", x, y },
    { id: "ne", x: x + w, y },
    { id: "sw", x, y: y + h },
    { id: "se", x: x + w, y: y + h },
    { id: "rotate", x: x + w / 2, y: y - 18 },
  ];
}

export function hitTransformHandleAt(
  bounds: MaskBounds,
  canvasX: number,
  canvasY: number,
  panX: number,
  panY: number,
  zoom: number,
  hitRadius = 18,
): TransformHandle | null {
  const handles = transformHandlePoints(bounds, panX, panY, zoom);
  const nw = handles.find((handle) => handle.id === "nw");
  const se = handles.find((handle) => handle.id === "se");
  if (!nw || !se) return null;
  const boxW = Math.max(1, se.x - nw.x);
  const boxH = Math.max(1, se.y - nw.y);
  const insetX = Math.min(boxW * 0.35, Math.max(4, hitRadius * 0.6));
  const insetY = Math.min(boxH * 0.35, Math.max(4, hitRadius * 0.6));
  const insideInner =
    canvasX > nw.x + insetX &&
    canvasX < se.x - insetX &&
    canvasY > nw.y + insetY &&
    canvasY < se.y - insetY;

  let best: TransformHandle | null = null;
  let bestDist = hitRadius;
  for (const handle of handles) {
    if (handle.id !== "rotate" && insideInner) continue;
    const dist = Math.hypot(canvasX - handle.x, canvasY - handle.y);
    if (dist <= bestDist) {
      best = handle.id;
      bestDist = dist;
    }
  }
  return best;
}

export function hitTransformHandle(
  mask: Uint8Array,
  width: number,
  height: number,
  canvasX: number,
  canvasY: number,
  panX: number,
  panY: number,
  zoom: number,
  hitRadius = 18,
): TransformHandle | null {
  const bounds = maskBounds(mask, width, height);
  if (!bounds) return null;
  return hitTransformHandleAt(bounds, canvasX, canvasY, panX, panY, zoom, hitRadius);
}
