import { describe, expect, it } from "vitest";
import { createImage, setPixel } from "../domain/image-buffer";
import { createSprite } from "../domain/factory";
import { findCel } from "../domain/sprite";
import { compositeFrame, readPixel } from "./composite";

describe("composite", () => {
  it("stacks image layers and skips reference and hidden layers", () => {
    const doc = createSprite(3, 2, "composite");
    const bottom = doc.layers[0]!;
    const frameId = doc.frames[0]!.id;
    const bottomCel = findCel(doc, bottom.id, frameId);
    expect(bottomCel).toBeDefined();
    if (!bottomCel) return;
    setPixel(bottomCel.image, 0, 0, { r: 255, g: 0, b: 0, a: 255 });

    const topId = "top";
    doc.layers.push({
      id: topId,
      name: "Topo",
      kind: "image",
      opacity: 255,
      blendMode: "normal",
      visible: true,
      locked: false,
      parentId: null,
    });
    const topImage = createImage(3, 2);
    setPixel(topImage, 0, 0, { r: 0, g: 0, b: 255, a: 128 });
    setPixel(topImage, 1, 0, { r: 0, g: 255, b: 0, a: 255 });
    doc.cels.push({ layerId: topId, frameId, image: topImage, x: 0, y: 0, opacity: 255 });

    const reference = createImage(3, 2);
    setPixel(reference, 2, 0, { r: 255, g: 255, b: 0, a: 255 });
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
    doc.cels.push({ layerId: "ref", frameId, image: reference, x: 0, y: 0, opacity: 255 });

    const hidden = createImage(3, 2);
    setPixel(hidden, 0, 1, { r: 255, g: 0, b: 255, a: 255 });
    doc.layers.push({
      id: "hidden",
      name: "Oculta",
      kind: "image",
      opacity: 255,
      blendMode: "normal",
      visible: false,
      locked: false,
      parentId: null,
    });
    doc.cels.push({ layerId: "hidden", frameId, image: hidden, x: 0, y: 0, opacity: 255 });

    const offsetImage = createImage(1, 1);
    setPixel(offsetImage, 0, 0, { r: 0, g: 0, b: 0, a: 255 });
    doc.layers.push({
      id: "offset",
      name: "Offset",
      kind: "image",
      opacity: 255,
      blendMode: "normal",
      visible: true,
      locked: false,
      parentId: null,
    });
    doc.cels.push({ layerId: "offset", frameId, image: offsetImage, x: 2, y: 1, opacity: 255 });

    const out = compositeFrame(doc, frameId);
    expect(readPixel(out, 0, 0)).toEqual({ r: 127, g: 0, b: 128, a: 255 });
    expect(readPixel(out, 1, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
    expect(readPixel(out, 2, 0)?.a).toBe(0);
    expect(readPixel(out, 0, 1)?.a).toBe(0);
    expect(readPixel(out, 2, 1)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
});
