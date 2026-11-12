import { describe, expect, it } from "vitest";
import { createSprite } from "./factory";
import { celGridModel } from "./sprite";

describe("celGridModel", () => {
  it("lists content layers top-first and all frames", () => {
    const doc = createSprite(2, 2);
    doc.layers.push({
      id: "layer-b",
      name: "B",
      kind: "image",
      visible: true,
      locked: false,
      opacity: 255,
      blendMode: "normal",
      parentId: null,
      tilesetId: null,
    });
    doc.frames.push({ id: "frame-2", durationMs: 100 });
    const grid = celGridModel(doc);
    expect(grid.layerIds[0]).toBe("layer-b");
    expect(grid.layerIds.at(-1)).toBe(doc.layers[0]?.id);
    expect(grid.frameIds).toHaveLength(2);
  });
});
