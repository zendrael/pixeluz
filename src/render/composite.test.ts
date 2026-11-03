import { describe, expect, it } from "vitest";
import { createImage, setPixel } from "../domain/image-buffer";
import { createSprite } from "../domain/factory";
import { findCel } from "../domain/sprite";
import type { BlendMode, Rgba } from "../domain/types";
import { compositeFrame, readPixel } from "./composite";

/** Blue over red, both opaque. Literals from the channel/HSL formulas, not from blendRgb. */
const BLEND_CASES: Array<{ mode: BlendMode; rgb: Rgba }> = [
  { mode: "normal", rgb: { r: 0, g: 0, b: 255, a: 255 } },
  { mode: "darken", rgb: { r: 0, g: 0, b: 0, a: 255 } },
  { mode: "multiply", rgb: { r: 0, g: 0, b: 0, a: 255 } },
  { mode: "color-burn", rgb: { r: 0, g: 0, b: 0, a: 255 } },
  { mode: "lighten", rgb: { r: 255, g: 0, b: 255, a: 255 } },
  { mode: "screen", rgb: { r: 255, g: 0, b: 255, a: 255 } },
  { mode: "color-dodge", rgb: { r: 255, g: 0, b: 255, a: 255 } },
  { mode: "addition", rgb: { r: 255, g: 0, b: 255, a: 255 } },
  { mode: "overlay", rgb: { r: 255, g: 0, b: 0, a: 255 } },
  { mode: "soft-light", rgb: { r: 255, g: 0, b: 0, a: 255 } },
  { mode: "hard-light", rgb: { r: 0, g: 0, b: 255, a: 255 } },
  { mode: "difference", rgb: { r: 255, g: 0, b: 255, a: 255 } },
  { mode: "exclusion", rgb: { r: 255, g: 0, b: 255, a: 255 } },
  { mode: "subtract", rgb: { r: 255, g: 0, b: 0, a: 255 } },
  { mode: "divide", rgb: { r: 255, g: 255, b: 0, a: 255 } },
  { mode: "hue", rgb: { r: 0, g: 0, b: 255, a: 255 } },
  { mode: "saturation", rgb: { r: 255, g: 0, b: 0, a: 255 } },
  { mode: "color", rgb: { r: 0, g: 0, b: 255, a: 255 } },
  { mode: "luminosity", rgb: { r: 255, g: 0, b: 0, a: 255 } },
];

function blendDoc(mode: BlendMode) {
  const doc = createSprite(1, 1, "blend");
  const frameId = doc.frames[0]!;
  const bottom = findCel(doc, doc.layers[0]!.id, frameId.id);
  if (!bottom) throw new Error("cel ausente");
  setPixel(bottom.image, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
  doc.layers.push({
    id: "top",
    name: "Topo",
    kind: "image",
    opacity: 255,
    blendMode: mode,
    visible: true,
    locked: false,
    parentId: null,
  });
  const top = createImage(1, 1);
  setPixel(top, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
  doc.cels.push({ layerId: "top", frameId: frameId.id, image: top, x: 0, y: 0, opacity: 255 });
  return { doc, frameId: frameId.id };
}

describe("composite", () => {
  it.each(BLEND_CASES)("aplica $mode sobre vermelho opaco", ({ mode, rgb }) => {
    const { doc, frameId } = blendDoc(mode);
    expect(readPixel(compositeFrame(doc, frameId), 0, 0)).toEqual(rgb);
  });

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
