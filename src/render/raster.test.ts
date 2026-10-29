import { describe, expect, it } from "vitest";
import { createImage, getPixel, setPixel } from "../domain/image-buffer";
import { constrainSquare, ellipsePixels, floodFill, linePixels, rectanglePixels, snapLineEnd } from "./raster";

const red = { r: 255, g: 0, b: 0, a: 255 };
const blue = { r: 0, g: 0, b: 255, a: 255 };

function connected(points: Array<[number, number]>): boolean {
  if (points.length <= 1) return true;
  const set = new Set(points.map(([x, y]) => `${x},${y}`));
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [points[0]!];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) break;
    const [x, y] = next;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (set.has(`${x + dx},${y + dy}`)) stack.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === points.length;
}

describe("raster", () => {
  it("draws straight lines, rectangles and snapped ends", () => {
    expect(linePixels(0, 0, 3, 0)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(rectanglePixels(0, 0, 2, 2)).toHaveLength(8);
    expect(snapLineEnd(0, 0, 5, 0)).toEqual([5, 0]);
    expect(constrainSquare(0, 0, 3, 1)).toEqual([3, 3]);
  });

  it("keeps ellipse outlines connected", () => {
    expect(ellipsePixels(0, 0, 2, 2).map(([x, y]) => `${x},${y}`).sort()).toEqual(["0,1", "1,0", "1,2", "2,1"]);
    const oval = ellipsePixels(0, 0, 10, 6);
    expect(oval.length).toBeGreaterThan(8);
    expect(connected(oval)).toBe(true);
  });

  it("flood fills exact colors with 4-connectivity", () => {
    const image = createImage(3, 3);
    setPixel(image, 0, 1, red);
    setPixel(image, 2, 1, red);
    setPixel(image, 1, 0, red);
    setPixel(image, 1, 2, red);
    expect(floodFill(image, 1, 1, blue)).toHaveLength(1);
    expect(getPixel(image, 0, 0)?.a).toBe(0);
    expect(getPixel(image, 1, 1)).toEqual(blue);

    const empty = createImage(4, 4);
    expect(floodFill(empty, 0, 0, red)).toHaveLength(16);
  });
});
