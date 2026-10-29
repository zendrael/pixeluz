import type { SymmetryMode, TileMode } from "./draw-options";

export function symmetricPoints(x: number, y: number, width: number, height: number, mode: SymmetryMode): Array<[number, number]> {
  const points: Array<[number, number]> = [[x, y]];
  if (mode === "off") return points;
  const mx = width - 1 - x;
  const my = height - 1 - y;
  if (mode === "horizontal" || mode === "both") points.push([mx, y]);
  if (mode === "vertical" || mode === "both") points.push([x, my]);
  if (mode === "both") points.push([mx, my]);
  const unique = new Map<string, [number, number]>();
  for (const point of points) unique.set(`${point[0]},${point[1]}`, point);
  return [...unique.values()];
}

export function placePixel(x: number, y: number, width: number, height: number, tile: TileMode): [number, number] | null {
  const tileX = tile === "x" || tile === "both";
  const tileY = tile === "y" || tile === "both";
  let nx = x;
  let ny = y;
  if (tileX) nx = ((x % width) + width) % width;
  else if (x < 0 || x >= width) return null;
  if (tileY) ny = ((y % height) + height) % height;
  else if (y < 0 || y >= height) return null;
  return [nx, ny];
}
