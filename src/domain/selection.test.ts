import { describe, expect, it } from "vitest";
import { morphSelection, nudgedPasteOrigin, pasteOrigin } from "./selection";

describe("pasteOrigin", () => {
  it("keeps the origin when the clip already intersects the canvas", () => {
    expect(pasteOrigin(1, 2, 2, 2, 4, 4)).toEqual({ x: 1, y: 2 });
  });

  it("centers the clip when it misses the canvas", () => {
    expect(pasteOrigin(10, 10, 2, 2, 4, 4)).toEqual({ x: 1, y: 1 });
  });

  it("places an oversized clip at the canvas origin", () => {
    expect(pasteOrigin(5, 5, 10, 10, 4, 4)).toEqual({ x: 0, y: 0 });
  });
});

describe("nudgedPasteOrigin", () => {
  it("offsets and keeps the clip inside the canvas", () => {
    expect(nudgedPasteOrigin({ x: 1, y: 1 }, 1, 2, 2, 4, 4)).toEqual({ x: 2, y: 2 });
    expect(nudgedPasteOrigin({ x: 2, y: 2 }, 2, 2, 2, 4, 4)).toEqual({ x: 2, y: 2 });
  });
});

describe("morphSelection", () => {
  it("expands, contracts, inverts and borders a mask", () => {
    const mask = new Uint8Array(9);
    mask[4] = 1;
    const expanded = morphSelection(mask, 3, 3, "expand");
    expect(expanded?.filter((bit) => bit === 1)).toHaveLength(9);
    const full = new Uint8Array(9).fill(1);
    expect(morphSelection(full, 3, 3, "contract")?.filter((bit) => bit === 1)).toHaveLength(1);
    expect(morphSelection(mask, 3, 3, "invert")?.[0]).toBe(1);
    expect(morphSelection(full, 3, 3, "border")?.filter((bit) => bit === 1)).toHaveLength(8);
  });
});
