export const MIN_SPRITE_SIZE = 1;
export const MAX_SPRITE_SIZE = 256;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;
export const MIN_FRAME_MS = 20;
export const MAX_FRAME_MS = 5000;
export const DEFAULT_FRAME_MS = 100;
export const HISTORY_LIMIT = 200;
export const MAX_BRUSH_SIZE = 32;
export const MAX_LAYERS = 32;

export function gridCell(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const cell = Math.floor(value);
  if (cell < 1) return 1;
  if (cell > MAX_SPRITE_SIZE) return MAX_SPRITE_SIZE;
  return cell;
}

export function gridLines(length: number, cell: number, offset: number): number[] {
  const step = gridCell(cell);
  const start = ((Math.floor(offset) % step) + step) % step;
  const lines: number[] = [];
  for (let pos = start; pos <= length; pos += step) lines.push(pos);
  return lines;
}
