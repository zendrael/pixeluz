import { describe, expect, it } from "vitest";
import { TRANSPARENT } from "./color";
import { createSprite } from "./factory";
import { cloneImage, createImage, getPixel, setPixel } from "./image-buffer";

describe("image buffer", () => {
  it("reads and writes pixels inside the sprite", () => {
    const image = createImage(2, 2);
    expect(getPixel(image, 0, 0)).toEqual(TRANSPARENT);
    setPixel(image, 1, 0, { r: 10, g: 20, b: 30, a: 255 });
    expect(getPixel(image, 1, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
    expect(getPixel(image, -1, 0)).toBeNull();
    setPixel(image, 8, 8, { r: 1, g: 1, b: 1, a: 255 });
    expect(getPixel(image, 0, 1)).toEqual(TRANSPARENT);
  });

  it("clones pixels without sharing the buffer", () => {
    const image = createImage(1, 1);
    setPixel(image, 0, 0, { r: 1, g: 2, b: 3, a: 255 });
    const copy = cloneImage(image);
    setPixel(copy, 0, 0, { r: 9, g: 9, b: 9, a: 255 });
    expect(getPixel(image, 0, 0)?.r).toBe(1);
  });

  it("starts from an empty 32×32 sprite", () => {
    const doc = createSprite();
    expect(doc.width).toBe(32);
    expect(doc.height).toBe(32);
    expect(doc.frames).toHaveLength(1);
    expect(doc.layers).toHaveLength(1);
    expect(doc.colorMode).toBe("rgba");
    expect(getPixel(doc.cels[0]!.image, 0, 0)?.a).toBe(0);
  });
});
