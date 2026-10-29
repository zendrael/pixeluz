import { MAX_ZOOM, MIN_ZOOM } from "../domain/limits";

export const PINCH_PIXELS_PER_LEVEL = 64;
export const WHEEL_PINCH_THRESHOLD = 48;

export function zoomFromPinch(startZoom: number, startDistance: number, distance: number): number {
  return startZoom + (distance - startDistance) / PINCH_PIXELS_PER_LEVEL;
}

export function consumeWheelPinch(
  accumulated: number,
  delta: number,
  zoom = 32,
  slack = 0,
): { rest: number; levels: number; slack: number } {
  let pending = delta;
  let nextSlack = slack;
  if (nextSlack !== 0 && pending !== 0 && Math.sign(pending) !== Math.sign(nextSlack)) {
    const used = Math.min(Math.abs(pending), Math.abs(nextSlack));
    pending -= Math.sign(pending) * used;
    nextSlack -= Math.sign(nextSlack) * used;
  }
  const total = accumulated + pending;
  const raw = Math.trunc(total / WHEEL_PINCH_THRESHOLD);
  const rawLevels = raw === 0 ? 0 : raw;
  const rest = total - rawLevels * WHEEL_PINCH_THRESHOLD;
  if (rawLevels === 0) return { rest, levels: 0, slack: nextSlack };

  const nextZoom = zoom - rawLevels;
  if (nextZoom > MAX_ZOOM) {
    const blocked = nextZoom - MAX_ZOOM;
    return { rest, levels: rawLevels + blocked, slack: nextSlack - blocked * WHEEL_PINCH_THRESHOLD };
  }
  if (nextZoom < MIN_ZOOM) {
    const blocked = MIN_ZOOM - nextZoom;
    return { rest, levels: rawLevels - blocked, slack: nextSlack + blocked * WHEEL_PINCH_THRESHOLD };
  }
  return { rest, levels: rawLevels, slack: nextSlack };
}

export function wheelDeltaPixels(delta: number, deltaMode: number): number {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * 400;
  return delta;
}
