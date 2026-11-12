import { describe, expect, it } from "vitest";
import { createImage, getPixel, setPixel } from "./image-buffer";
import { rotateSelectionNearest, scaleSelectionNearest } from "./free-transform";

describe("scaleSelectionNearest", () => {
  it("scales a selected block by 200%", () => {
    const image = createImage(4, 4);
    setPixel(image, 1, 1, { r: 10, g: 20, b: 30, a: 255 });
    setPixel(image, 2, 1, { r: 10, g: 20, b: 30, a: 255 });
    setPixel(image, 1, 2, { r: 10, g: 20, b: 30, a: 255 });
    setPixel(image, 2, 2, { r: 10, g: 20, b: 30, a: 255 });
    const mask = new Uint8Array(16);
    mask[1 * 4 + 1] = 1;
    mask[1 * 4 + 2] = 1;
    mask[2 * 4 + 1] = 1;
    mask[2 * 4 + 2] = 1;
    const next = scaleSelectionNearest(image, mask, 2);
    expect(next?.image.width).toBe(4);
    expect(next?.image.height).toBe(4);
    expect(getPixel(next!.image, 0, 0)?.r).toBe(10);
  });
});

describe("rotateSelectionNearest", () => {
  it("rotates a one-pixel selection by 90 degrees", () => {
    const image = createImage(3, 3);
    setPixel(image, 1, 0, { r: 255, g: 0, b: 0, a: 255 });
    const mask = new Uint8Array(9);
    mask[1] = 1;
    const next = rotateSelectionNearest(image, mask, 90);
    expect(next).not.toBeNull();
    expect(next!.mask.some((bit) => bit === 1)).toBe(true);
  });
});
