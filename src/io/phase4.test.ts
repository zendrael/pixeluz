import { describe, expect, it } from "vitest";
import { FilterCelCommand, SetColorModeCommand } from "../commands/color-commands";
import { SetPaletteColorCommand } from "../commands/document-commands";
import { filterPixels } from "../domain/filters";
import { createSprite } from "../domain/factory";
import { createImage, getPixel, setPixel } from "../domain/image-buffer";
import { convertColors, fitColor } from "../domain/quantize";
import { findCel } from "../domain/sprite";
import { readAse, writeAse } from "./ase";
import { readGif, writeGif } from "./gif";
import { decodePng, encodePng } from "./png";
import { atlasJson, buildSpriteSheet } from "./sheet";
import { zipStored } from "./zip";
import { deserializeProject, serializeProject } from "./project-json";
import { BLACK, WHITE } from "../domain/color";

const red = { r: 255, g: 0, b: 0, a: 255 };
const blue = { r: 0, g: 0, b: 255, a: 255 };

describe("phase 4", () => {
  it("quantizes to the palette and converts gray", () => {
    const image = createImage(2, 1);
    setPixel(image, 0, 0, red);
    setPixel(image, 1, 0, blue);
    const indexed = convertColors([image], "indexed", []);
    expect(indexed.palette).toEqual(expect.arrayContaining([red, blue]));
    expect(indexed.pixels[0]?.[0]).toBe(255);
    const gray = convertColors([image], "grayscale", []);
    expect(gray.pixels[0]?.[0]).toBe(gray.pixels[0]?.[1]);
    expect(fitColor(red, "indexed", [blue])).toEqual({ ...blue, a: 255 });
  });

  it("inverts inside the selection and restores the color mode", () => {
    const doc = createSprite(2, 1, "filtro");
    const cel = findCel(doc, doc.layers[0]!.id, doc.frames[0]!.id);
    expect(cel).toBeDefined();
    if (!cel) return;
    setPixel(cel.image, 0, 0, red);
    setPixel(cel.image, 1, 0, blue);
    const mask = new Uint8Array([1, 0]);
    const next = filterPixels(cel.image, mask, "invert", emptyFilter());
    const command = new FilterCelCommand(cel.layerId, cel.frameId, next);
    command.execute(doc);
    expect(getPixel(cel.image, 0, 0)).toEqual({ r: 0, g: 255, b: 255, a: 255 });
    expect(getPixel(cel.image, 1, 0)).toEqual(blue);
    command.undo(doc);
    expect(getPixel(cel.image, 0, 0)).toEqual(red);

    const mode = new SetColorModeCommand("grayscale");
    mode.execute(doc);
    expect(doc.colorMode).toBe("grayscale");
    const gray = getPixel(cel.image, 0, 0);
    expect(gray?.r).toBe(gray?.g);
    mode.undo(doc);
    expect(doc.colorMode).toBe("rgba");
    expect(getPixel(cel.image, 0, 0)).toEqual(red);
  });

  it("recolors indexed pixels when the palette entry changes", () => {
    const doc = createSprite(1, 1, "indice");
    doc.colorMode = "indexed";
    doc.palette = [{ ...red }];
    const cel = doc.cels[0];
    expect(cel).toBeDefined();
    if (!cel) return;
    setPixel(cel.image, 0, 0, red);
    const command = new SetPaletteColorCommand(0, red, blue);
    command.execute(doc);
    expect(getPixel(cel.image, 0, 0)).toEqual(blue);
    command.undo(doc);
    expect(getPixel(cel.image, 0, 0)).toEqual(red);
  });

  it("roundtrips png, gif, sheet and zip", async () => {
    const image = createImage(2, 1);
    setPixel(image, 0, 0, red);
    const png = await decodePng(encodePng(image));
    expect(getPixel(png, 0, 0)).toEqual(red);
    const gif = readGif(writeGif([{ image, durationMs: 100 }, { image, durationMs: 200 }]));
    expect(gif).toHaveLength(2);
    expect(getPixel(gif[0]!, 0, 0)).toEqual(red);
    expect(getPixel(gif[0]!, 1, 0)?.a).toBe(0);
    const sheet = buildSpriteSheet([
      { image, durationMs: 100 },
      { image, durationMs: 80 },
    ]);
    expect(sheet.image.width).toBe(4);
    expect(sheet.frames).toHaveLength(2);
    const atlas = atlasJson("heroi.png", sheet);
    expect(JSON.parse(atlas).frames[1].durationMs).toBe(80);
    const zip = zipStored([{ name: "heroi.png", data: encodePng(image) }]);
    expect(String.fromCharCode(zip[0] ?? 0, zip[1] ?? 0)).toBe("PK");
    expect(new TextDecoder().decode(zip)).toContain("heroi.png");
  });

  it("roundtrips an aseprite file with a group and a tag", async () => {
    const doc = createSprite(2, 2, "Herói");
    const image = doc.layers[0]!;
    const groupId = "grupo";
    doc.layers = [
      {
        id: groupId,
        name: "Grupo",
        kind: "group",
        opacity: 255,
        blendMode: "multiply",
        visible: true,
        locked: false,
        parentId: null,
      },
      { ...image, parentId: groupId },
    ];
    doc.frames.push({ id: "frame-2", durationMs: 200 });
    doc.tags.push({ id: "tag", name: "Correr", from: 0, to: 1, direction: "ping-pong" });
    const cel = findCel(doc, image.id, doc.frames[0]!.id);
    expect(cel).toBeDefined();
    if (!cel) return;
    setPixel(cel.image, 1, 1, red);
    const loaded = await readAse(writeAse(doc));
    expect(loaded.colorMode).toBe("rgba");
    expect(loaded.frames.map((frame) => frame.durationMs)).toEqual([100, 200]);
    expect(loaded.tags[0]).toMatchObject({ name: "Correr", from: 0, to: 1, direction: "ping-pong" });
    expect(loaded.layers.map((layer) => layer.name)).toEqual(["Grupo", "Camada 1"]);
    expect(loaded.layers[1]?.parentId).toBe(loaded.layers[0]?.id);
    expect(loaded.layers[0]?.blendMode).toBe("multiply");
    const loadedCel = loaded.cels.find((item) => item.layerId === loaded.layers[1]?.id && item.frameId === loaded.frames[0]?.id);
    expect(loadedCel && getPixel(loadedCel.image, 1, 1)).toEqual(red);
  });

  it("keeps indexed and grayscale pixels in ase and json", async () => {
    const doc = createSprite(1, 1, "modo");
    doc.colorMode = "indexed";
    doc.palette = [red];
    setPixel(doc.cels[0]!.image, 0, 0, red);
    const indexed = await readAse(writeAse(doc));
    expect(indexed.colorMode).toBe("indexed");
    expect(getPixel(indexed.cels[0]!.image, 0, 0)?.r).toBe(255);
    doc.colorMode = "grayscale";
    setPixel(doc.cels[0]!.image, 0, 0, { r: 40, g: 40, b: 40, a: 255 });
    const gray = await readAse(writeAse(doc));
    expect(gray.colorMode).toBe("grayscale");
    expect(getPixel(gray.cels[0]!.image, 0, 0)).toEqual({ r: 40, g: 40, b: 40, a: 255 });
    const raw = serializeProject({ sprite: doc, foreground: BLACK, background: WHITE });
    expect(deserializeProject(raw).sprite.colorMode).toBe("grayscale");
  });
});

function emptyFilter() {
  return {
    brightness: 0,
    contrast: 0,
    hue: 0,
    saturation: 0,
    outline: red,
    from: red,
    to: blue,
    tolerance: 0,
  };
}
