import { describe, expect, it } from "vitest";
import { brushStamps } from "../domain/brush";
import { createSprite } from "../domain/factory";
import { createImage, getPixel, setPixel } from "../domain/image-buffer";
import { resolveInk } from "../domain/ink";
import { combineMasks } from "../domain/selection";
import { editSelection } from "../domain/selection-edit";
import { placePixel, symmetricPoints } from "../domain/symmetry";
import { AddLayerCommand } from "../commands/layer-commands";
import { createCel } from "../domain/sprite";
import { paintGradient, paintStroke, type PaintSettings } from "./paint";
import { pixelPerfectPoints } from "./pixel-perfect";
import { curvePixels, fillPolygon } from "./raster";

const red = { r: 255, g: 0, b: 0, a: 255 };
const blue = { r: 0, g: 0, b: 255, a: 255 };
const black = { r: 0, g: 0, b: 0, a: 255 };
const white = { r: 255, g: 255, b: 255, a: 255 };

function settings(image: ReturnType<typeof createImage>, color = red): PaintSettings {
  return {
    width: image.width,
    height: image.height,
    brushSize: 1,
    brushShape: "square",
    brushAngle: 0,
    customBrush: null,
    symmetry: "off",
    tile: "off",
    selection: null,
    color,
    opacity: 255,
    ink: "simple",
    palette: [black, red, white],
    button: 0,
    pixelPerfect: false,
  };
}

describe("fase 2", () => {
  it("removes the corner that would thicken a freehand stroke", () => {
    expect(pixelPerfectPoints([[0, 0], [1, 0], [1, 1]])).toEqual([[0, 0], [1, 1]]);
  });

  it("stamps square and circle brushes", () => {
    expect(brushStamps("square", 1, 0, null)).toHaveLength(1);
    expect(brushStamps("square", 3, 0, null)).toHaveLength(9);
    expect(brushStamps("circle", 3, 0, null)).toHaveLength(5);
  });

  it("locks alpha and shades along the palette", () => {
    expect(resolveInk({ r: 0, g: 0, b: 0, a: 0 }, red, "lock-alpha", [], 0)).toBeNull();
    const locked = resolveInk({ r: 0, g: 0, b: 0, a: 128 }, red, "lock-alpha", [], 0);
    expect(locked?.a).toBe(128);
    expect(locked?.r).toBeGreaterThan(0);
    expect(resolveInk(red, black, "shading", [black, red, white], 0)).toEqual(white);
    expect(resolveInk(red, black, "shading", [black, red, white], 2)).toEqual(black);
  });

  it("mirrors and wraps pixels", () => {
    expect(symmetricPoints(0, 1, 4, 4, "both")).toEqual(expect.arrayContaining([[0, 1], [3, 1], [0, 2], [3, 2]]));
    expect(placePixel(-1, 2, 4, 4, "x")).toEqual([3, 2]);
    expect(placePixel(-1, 2, 4, 4, "off")).toBeNull();
  });

  it("paints a symmetric pixel-perfect stroke inside the selection", () => {
    const image = createImage(4, 1);
    const selection = new Uint8Array(4);
    selection[0] = 1;
    selection[3] = 1;
    const changes = new Map();
    paintStroke(image, [[0, 0], [1, 0], [1, 0]], { ...settings(image), symmetry: "horizontal", selection, pixelPerfect: true }, changes);
    expect(getPixel(image, 0, 0)).toEqual(red);
    expect(getPixel(image, 3, 0)).toEqual(red);
    expect(getPixel(image, 1, 0)?.a).toBe(0);
  });

  it("dithers a linear gradient from background to foreground", () => {
    const image = createImage(4, 1);
    const snapshot = image.data.slice();
    paintGradient(image, snapshot, 0, 0, 3, 0, red, blue, "linear", 2, null);
    expect(getPixel(image, 0, 0)).toEqual(blue);
    expect(getPixel(image, 3, 0)).toEqual(red);
  });

  it("draws a curve and fills a polygon", () => {
    const curve = curvePixels([[0, 0], [0, 4], [4, 4]]);
    expect(curve.length).toBeGreaterThan(3);
    const filled = fillPolygon([[0, 0], [2, 0], [2, 2], [0, 2]]);
    expect(filled).toEqual(expect.arrayContaining([[1, 1]]));
  });

  it("combines masks and flips the selected pixels", () => {
    const image = createImage(3, 1);
    setPixel(image, 0, 0, red);
    setPixel(image, 2, 0, blue);
    const mask = new Uint8Array([1, 0, 1]);
    const added = combineMasks(mask, new Uint8Array([0, 1, 0]), "add");
    expect(added).toEqual(new Uint8Array([1, 1, 1]));
    const next = editSelection(image, mask, "flip-h");
    expect(getPixel(image, 0, 0)).toEqual(blue);
    expect(getPixel(image, 2, 0)).toEqual(red);
    expect(next?.[0]).toBe(1);
    expect(next?.[2]).toBe(1);
  });

  it("adds a layer above the current one and undoes it", () => {
    const doc = createSprite(2, 2);
    const layer = {
      id: "layer-2",
      name: "Camada 2",
      kind: "image" as const,
      opacity: 255,
      blendMode: "normal" as const,
      visible: true,
      locked: false,
      parentId: null,
    };
    const command = new AddLayerCommand(1, layer, [createCel(layer.id, doc.frames[0]!.id, 2, 2)]);
    command.execute(doc);
    expect(doc.layers).toHaveLength(2);
    expect(doc.cels).toHaveLength(2);
    command.undo(doc);
    expect(doc.layers).toHaveLength(1);
    expect(doc.cels).toHaveLength(1);
  });
});
