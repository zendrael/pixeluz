import { describe, expect, it } from "vitest";
import { pasteOrigin } from "./selection";

describe("pasteOrigin", () => {
  it("keeps the origin when the clip already intersects the canvas", () => {
    expect(pasteOrigin(1, 2, 2, 2, 4, 4)).toEqual({ x: 1, y: 2 });
  });

  it("clamps the origin when the clip misses the canvas", () => {
    expect(pasteOrigin(10, 10, 2, 2, 4, 4)).toEqual({ x: 2, y: 2 });
  });

  it("places an oversized clip at the canvas origin", () => {
    expect(pasteOrigin(5, 5, 10, 10, 4, 4)).toEqual({ x: 0, y: 0 });
  });
});
