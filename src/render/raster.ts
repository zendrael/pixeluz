import { getPixel, setPixel } from "../domain/image-buffer";
import { rgbaEqual } from "../domain/color";
import type { ImageBuffer, PixelChange, Rgba } from "../domain/types";

export function linePixels(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let guard = 0; guard < 100000; guard++) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const doubled = 2 * err;
    if (doubled > -dy) {
      err -= dy;
      x += sx;
    }
    if (doubled < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

export function rectanglePixels(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const points: Array<[number, number]> = [];
  for (let x = minX; x <= maxX; x++) {
    points.push([x, minY]);
    if (maxY !== minY) points.push([x, maxY]);
  }
  for (let y = minY + 1; y <= maxY - 1; y++) {
    points.push([minX, y]);
    if (maxX !== minX) points.push([maxX, y]);
  }
  return points;
}

export function ellipsePixels(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  if (minX === maxX || minY === maxY) return linePixels(minX, minY, maxX, maxY);

  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const inside = (x: number, y: number) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1 + 1e-6;
  };

  const points: Array<[number, number]> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!inside(x, y)) continue;
      const edge =
        x === minX ||
        y === minY ||
        x === maxX ||
        y === maxY ||
        !inside(x - 1, y) ||
        !inside(x + 1, y) ||
        !inside(x, y - 1) ||
        !inside(x, y + 1);
      if (edge) points.push([x, y]);
    }
  }
  return points;
}

export function fillRectangle(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const points: Array<[number, number]> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) points.push([x, y]);
  }
  return points;
}

export function fillEllipse(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  if (minX === maxX || minY === maxY) return fillRectangle(minX, minY, maxX, maxY);
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const points: Array<[number, number]> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1 + 1e-6) points.push([x, y]);
    }
  }
  return points;
}

export function fillPolygon(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length < 3) return [];
  let minY = points[0]?.[1] ?? 0;
  let maxY = minY;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxY - minY > 4096) return [];
  const filled: Array<[number, number]> = [];
  for (let y = minY; y <= maxY; y++) {
    const hits: number[] = [];
    for (let index = 0; index < points.length; index++) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      if (!current || !next) continue;
      const [x0, y0] = current;
      const [x1, y1] = next;
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        hits.push(Math.round(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)));
      }
    }
    hits.sort((a, b) => a - b);
    for (let index = 0; index + 1 < hits.length; index += 2) {
      const start = hits[index];
      const end = hits[index + 1];
      if (start === undefined || end === undefined || end - start > 4096) continue;
      for (let x = start; x <= end; x++) filled.push([x, y]);
    }
  }
  return filled;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function curvePixels(knots: Array<[number, number]>): Array<[number, number]> {
  const first = knots[0];
  if (!first) return [];
  if (knots.length === 1) return [[first[0], first[1]]];
  const second = knots[1];
  if (knots.length === 2 && second) return linePixels(first[0], first[1], second[0], second[1]);
  const samples: Array<[number, number]> = [];
  const push = (x: number, y: number) => {
    const last = samples[samples.length - 1];
    if (!last) {
      samples.push([x, y]);
      return;
    }
    if (last[0] === x && last[1] === y) return;
    for (const point of linePixels(last[0], last[1], x, y).slice(1)) samples.push(point);
  };
  for (let index = 0; index < knots.length - 1; index++) {
    const p0 = knots[Math.max(0, index - 1)];
    const p1 = knots[index];
    const p2 = knots[index + 1];
    const p3 = knots[Math.min(knots.length - 1, index + 2)];
    if (!p0 || !p1 || !p2 || !p3) continue;
    const steps = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      push(Math.round(catmull(p0[0], p1[0], p2[0], p3[0], t)), Math.round(catmull(p0[1], p1[1], p2[1], p3[1], t)));
    }
  }
  return samples;
}

export function snapLineEnd(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return [x1, y1];
  const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const distance = Math.hypot(dx, dy);
  return [x0 + Math.round(Math.cos(snapped) * distance), y0 + Math.round(Math.sin(snapped) * distance)];
}

export function constrainSquare(x0: number, y0: number, x1: number, y1: number): [number, number] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return [x1, y1];
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = dx === 0 ? 1 : Math.sign(dx);
  const sy = dy === 0 ? 1 : Math.sign(dy);
  return [x0 + sx * side, y0 + sy * side];
}

export function floodMask(image: ImageBuffer, x: number, y: number): Uint8Array | null {
  const target = getPixel(image, x, y);
  if (!target) return null;
  const mask = new Uint8Array(image.width * image.height);
  const stack: Array<[number, number]> = [[x, y]];
  let any = false;
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [cx, cy] = next;
    if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) continue;
    const index = cy * image.width + cx;
    if (mask[index]) continue;
    const current = getPixel(image, cx, cy);
    if (!current || !rgbaEqual(current, target)) continue;
    mask[index] = 1;
    any = true;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return any ? mask : null;
}

export function floodFill(image: ImageBuffer, x: number, y: number, color: Rgba): PixelChange[] {
  const target = getPixel(image, x, y);
  if (!target || rgbaEqual(target, color)) return [];
  const seen = new Uint8Array(image.width * image.height);
  const changes: PixelChange[] = [];
  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [cx, cy] = next;
    if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) continue;
    const index = cy * image.width + cx;
    if (seen[index]) continue;
    seen[index] = 1;
    const current = getPixel(image, cx, cy);
    if (!current || !rgbaEqual(current, target)) continue;
    setPixel(image, cx, cy, color);
    changes.push({ x: cx, y: cy, before: { ...target }, after: { ...color } });
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return changes;
}
