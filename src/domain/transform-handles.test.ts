import { describe, expect, it } from "vitest";
import { hitTransformHandle } from "./transform-handles";

describe("hitTransformHandle", () => {
  it("detects corner and rotate grips", () => {
    const mask = new Uint8Array(16);
    for (let y = 1; y <= 2; y += 1) for (let x = 1; x <= 2; x += 1) mask[y * 4 + x] = 1;
    expect(hitTransformHandle(mask, 4, 4, 1, 1, 16)).toBe("nw");
    expect(hitTransformHandle(mask, 4, 4, 3, 3, 16)).toBe("se");
    expect(hitTransformHandle(mask, 4, 4, 2, 1 - 18 / 16, 16)).toBe("rotate");
    expect(hitTransformHandle(mask, 4, 4, 2, 2, 16)).toBeNull();
  });
});
