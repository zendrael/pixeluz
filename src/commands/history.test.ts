import { describe, expect, it } from "vitest";
import { createImage, getPixel, paintPixelsTracked } from "../domain/image-buffer";
import { createSprite } from "../domain/factory";
import { findCel } from "../domain/sprite";
import { AddFrameCommand } from "./frame-commands";
import { History } from "./history";
import { PaintStrokeCommand } from "./paint-stroke";

const red = { r: 255, g: 0, b: 0, a: 255 };

describe("paint command", () => {
  it("undoes and redoes a stroke that painted the same pixel twice", () => {
    const doc = createSprite(8, 8, "teste");
    const layerId = doc.layers[0]!.id;
    const frameId = doc.frames[0]!.id;
    const cel = findCel(doc, layerId, frameId);
    expect(cel).toBeDefined();
    if (!cel) return;

    const tracked = new Map();
    paintPixelsTracked(cel.image, [[1, 1], [1, 1], [2, 1]], red, tracked);
    const history = new History();
    history.pushApplied(new PaintStrokeCommand(layerId, frameId, [...tracked.values()]));

    expect(getPixel(cel.image, 1, 1)).toEqual(red);
    expect(history.undo(doc)).toBe(true);
    expect(getPixel(cel.image, 1, 1)?.a).toBe(0);
    expect(getPixel(cel.image, 2, 1)?.a).toBe(0);
    expect(history.redo(doc)).toBe(true);
    expect(getPixel(cel.image, 2, 1)).toEqual(red);
    expect(history.undo(doc)).toBe(true);
    expect(history.undo(doc)).toBe(false);
  });

  it("restores a frame removed by its command", () => {
    const doc = createSprite(4, 4, "quadros");
    const frame = { id: "frame-2", durationMs: 80 };
    const cel = {
      layerId: doc.layers[0]!.id,
      frameId: frame.id,
      image: createImage(4, 4),
      x: 0,
      y: 0,
      opacity: 255,
    };
    const command = new AddFrameCommand(1, frame, [cel]);
    command.execute(doc);
    expect(doc.frames).toHaveLength(2);
    command.undo(doc);
    expect(doc.frames).toHaveLength(1);
    expect(doc.cels.some((item) => item.frameId === "frame-2")).toBe(false);
  });
});
