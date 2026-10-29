import { describe, expect, it } from "vitest";
import { ReverseFramesCommand } from "../commands/animation-commands";
import { createSprite } from "../domain/factory";
import { createImage, setPixel } from "../domain/image-buffer";
import { stepPlayback } from "../domain/playback";
import { findCel } from "../domain/sprite";
import { compositeFrame, readPixel } from "./composite";

describe("phase 3", () => {
  it("multiplies opaque blue over red into black", () => {
    const doc = createSprite(1, 1, "blend");
    const frameId = doc.frames[0]!.id;
    const bottom = findCel(doc, doc.layers[0]!.id, frameId);
    expect(bottom).toBeDefined();
    if (!bottom) return;
    setPixel(bottom.image, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    const topId = "top";
    doc.layers.push({
      id: topId,
      name: "Topo",
      kind: "image",
      opacity: 255,
      blendMode: "multiply",
      visible: true,
      locked: false,
      parentId: null,
    });
    const top = createImage(1, 1);
    setPixel(top, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
    doc.cels.push({ layerId: topId, frameId, image: top, x: 0, y: 0, opacity: 255 });
    expect(readPixel(compositeFrame(doc, frameId), 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });

  it("skips a child of a hidden group and shows a reference only when asked", () => {
    const doc = createSprite(1, 1, "group");
    const frameId = doc.frames[0]!.id;
    const groupId = "group";
    doc.layers.unshift({
      id: groupId,
      name: "Grupo",
      kind: "group",
      opacity: 255,
      blendMode: "normal",
      visible: false,
      locked: false,
      parentId: null,
    });
    const child = doc.layers[1]!;
    child.parentId = groupId;
    const cel = findCel(doc, child.id, frameId);
    expect(cel).toBeDefined();
    if (!cel) return;
    setPixel(cel.image, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    doc.layers.push({
      id: "ref",
      name: "Ref",
      kind: "reference",
      opacity: 255,
      blendMode: "normal",
      visible: true,
      locked: false,
      parentId: null,
    });
    const reference = createImage(1, 1);
    setPixel(reference, 0, 0, { r: 0, g: 255, b: 0, a: 255 });
    doc.cels.push({ layerId: "ref", frameId, image: reference, x: 0, y: 0, opacity: 255 });
    expect(readPixel(compositeFrame(doc, frameId), 0, 0)?.a).toBe(0);
    expect(readPixel(compositeFrame(doc, frameId, { references: true }), 0, 0)).toEqual({
      r: 0,
      g: 255,
      b: 0,
      a: 255,
    });
  });

  it("reverses a frame range and restores it", () => {
    const doc = createSprite(1, 1, "frames");
    doc.frames.push({ id: "b", durationMs: 100 }, { id: "c", durationMs: 100 });
    const ids = doc.frames.map((frame) => frame.id);
    const command = new ReverseFramesCommand(0, 2);
    command.execute(doc);
    expect(doc.frames.map((frame) => frame.id)).toEqual([ids[2], ids[1], ids[0]]);
    command.undo(doc);
    expect(doc.frames.map((frame) => frame.id)).toEqual(ids);
  });

  it("ping-pongs inside the tag range", () => {
    expect(stepPlayback(2, 0, 2, "ping-pong", 1)).toEqual({ index: 1, ping: -1 });
    expect(stepPlayback(0, 0, 2, "ping-pong", -1)).toEqual({ index: 1, ping: 1 });
  });
});
