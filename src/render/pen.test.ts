import { describe, expect, it } from "vitest";
import { palmBlocksTouch, pointerSamples } from "./pen";

describe("caneta", () => {
  it("ignora o toque enquanto a caneta está perto", () => {
    expect(palmBlocksTouch("touch", true, null, 1000)).toBe(true);
    expect(palmBlocksTouch("touch", false, 900, 1000)).toBe(true);
    expect(palmBlocksTouch("touch", false, 900, 3000)).toBe(false);
    expect(palmBlocksTouch("pen", true, 900, 1000)).toBe(false);
    expect(palmBlocksTouch("mouse", false, 900, 1000)).toBe(false);
  });

  it("percorre cada amostra do traço e cai no evento atual se não houver nenhuma", () => {
    expect(pointerSamples([{ x: 1 }, { x: 4 }, { x: 9 }], { x: 9 })).toEqual([{ x: 1 }, { x: 4 }, { x: 9 }]);
    expect(pointerSamples([], { x: 2 })).toEqual([{ x: 2 }]);
  });
});
