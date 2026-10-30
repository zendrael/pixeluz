import { describe, expect, it } from "vitest";
import { EditorSession } from "../app/session";
import { textDots } from "./bitmap-font";
import { createSprite } from "./factory";
import { createImage, getPixel, setPixel } from "./image-buffer";
import { rotsprite, scale2x } from "./rotsprite";
import { deserializeProject, serializeProject } from "../io/project-json";
import { compositeFrame } from "../render/composite";
import { gridLines } from "./limits";
import { findCel } from "./sprite";
import { makeTileset, paintTilePoints } from "./tiles";

const red = { r: 255, g: 0, b: 0, a: 255 };
const green = { r: 0, g: 255, b: 0, a: 255 };
const opaque = { r: 0, g: 0, b: 0, a: 255 };
const clear = { r: 0, g: 0, b: 0, a: 0 };

describe("fase 5", () => {
  it("muda o tamanho da grade e desfaz", () => {
    const session = new EditorSession(createSprite(32, 32));
    expect(gridLines(32, 8, 0)).toEqual([0, 8, 16, 24, 32]);
    expect(gridLines(32, 8, 3)).toEqual([3, 11, 19, 27]);
    session.setGrid(8, 4);
    expect(session.doc.grid).toMatchObject({ width: 8, height: 4 });
    session.undo();
    expect(session.doc.grid).toMatchObject({ width: 16, height: 16 });
  });

  it("desenha o tile 1 no composto", () => {
    const doc = createSprite(16, 16);
    const tileset = makeTileset(doc, "tiles");
    const tile = tileset.tiles[1];
    if (!tile) throw new Error("tile ausente");
    for (let index = 0; index < tile.data.length; index += 4) {
      tile.data[index] = red.r;
      tile.data[index + 1] = red.g;
      tile.data[index + 2] = red.b;
      tile.data[index + 3] = red.a;
    }
    doc.tilesets.push(tileset);
    const layer = doc.layers[0];
    const frame = doc.frames[0];
    if (!layer || !frame) throw new Error("documento vazio");
    layer.kind = "tilemap";
    layer.tilesetId = tileset.id;
    const cel = findCel(doc, layer.id, frame.id);
    if (!cel) throw new Error("cel ausente");
    cel.tiles = [1];
    expect(getPixel(compositeFrame(doc, frame.id), 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it("separa tiles no modo automático e compartilha no manual", () => {
    const session = new EditorSession(createSprite(32, 16));
    session.addLayer("tilemap");
    const layer = session.doc.layers.find((item) => item.kind === "tilemap");
    const frame = session.doc.frames[0];
    const tileset = session.doc.tilesets[0];
    if (!layer || !frame || !tileset) throw new Error("tilemap ausente");
    const cel = findCel(session.doc, layer.id, frame.id);
    if (!cel?.tiles) throw new Error("grade ausente");
    paintTilePoints(session.doc, tileset, cel, [[0, 0], [16, 0]], opaque, "tiles", "auto", 1, null);
    session.tilePixelMode = "auto";
    paintTilePoints(session.doc, tileset, cel, [[1, 0]], green, "pixels", "auto", 1, null);
    expect(cel.tiles[0]).not.toBe(1);
    expect(cel.tiles[1]).toBe(1);
    expect(getPixel(tileset.tiles[1] ?? createImage(1, 1), 1, 0)).toEqual(session.doc.palette[0]);
    const shared = cel.tiles[0] ?? 0;
    paintTilePoints(session.doc, tileset, cel, [[0, 0], [16, 0]], opaque, "tiles", "manual", 1, null);
    paintTilePoints(session.doc, tileset, cel, [[2, 0]], green, "pixels", "manual", 1, null);
    expect(cel.tiles[0]).toBe(1);
    expect(cel.tiles[1]).toBe(1);
    expect(getPixel(tileset.tiles[1] ?? createImage(1, 1), 2, 0)).toEqual(green);
    expect(shared).not.toBe(1);
  });

  it("empilha mesmo quando o tile é único", () => {
    const session = new EditorSession(createSprite(16, 16));
    session.addLayer("tilemap");
    const layer = session.doc.layers.find((item) => item.kind === "tilemap");
    const frame = session.doc.frames[0];
    const tileset = session.doc.tilesets[0];
    if (!layer || !frame || !tileset || !tileset.tiles[1]) throw new Error("tilemap ausente");
    const cel = findCel(session.doc, layer.id, frame.id);
    if (!cel) throw new Error("cel ausente");
    paintTilePoints(session.doc, tileset, cel, [[0, 0]], opaque, "tiles", "stack", 1, null);
    const before = tileset.tiles[1].data[0];
    paintTilePoints(session.doc, tileset, cel, [[0, 0]], green, "pixels", "stack", 1, null);
    expect(cel.tiles?.[0]).toBeGreaterThan(1);
    expect(tileset.tiles[1].data[0]).toBe(before);
  });

  it("redimensiona, recorta e gira", () => {
    const session = new EditorSession(createSprite(2, 1));
    const frame = session.doc.frames[0];
    const layer = session.doc.layers[0];
    if (!frame || !layer) throw new Error("documento vazio");
    const cel = findCel(session.doc, layer.id, frame.id);
    if (!cel) throw new Error("cel ausente");
    setPixel(cel.image, 0, 0, red);
    session.resizeCanvas(3, 1, "ne");
    expect(getPixel(cel.image, 1, 0)).toEqual(red);
    expect(getPixel(cel.image, 0, 0)?.a).toBe(0);

    const wide = new EditorSession(createSprite(3, 1));
    const wideCel = findCel(wide.doc, wide.activeLayerId, wide.activeFrameId);
    if (!wideCel) throw new Error("cel ausente");
    setPixel(wideCel.image, 1, 0, red);
    wide.autocrop();
    expect(wide.doc.width).toBe(1);
    expect(wide.doc.height).toBe(1);
    expect(getPixel(wideCel.image, 0, 0)).toEqual(red);

    const dot = createImage(2, 1);
    expect(scale2x(dot).width).toBe(4);
    const line = createImage(7, 1);
    setPixel(line, 3, 0, red);
    const still = rotsprite(line, 0);
    expect(still.width).toBe(7);
    expect(getPixel(still, 3, 0)).toEqual(red);
    const turned = rotsprite(line, 90);
    expect(turned.height).toBeGreaterThan(turned.width);
  });

  it("grava texto e o projeto com tiles", () => {
    expect(textDots("A").length).toBeGreaterThan(0);
    const session = new EditorSession(createSprite(16, 16));
    session.insertText("A");
    const cel = findCel(session.doc, session.activeLayerId, session.activeFrameId);
    const opaquePixel = cel ? getPixel(cel.image, textDots("A")[0]?.[0] ?? 0, textDots("A")[0]?.[1] ?? 0) : null;
    expect(opaquePixel?.a).toBe(255);
    session.addLayer("tilemap");
    const raw = serializeProject({ sprite: session.doc, foreground: session.foreground, background: session.background });
    const loaded = deserializeProject(raw);
    const tileLayer = loaded.sprite.layers.find((item) => item.kind === "tilemap");
    expect(tileLayer?.tilesetId).toBe(loaded.sprite.tilesets[0]?.id);
    const tileCel = loaded.sprite.cels.find((item) => item.layerId === tileLayer?.id);
    expect(tileCel?.tiles?.length).toBeGreaterThan(0);
  });

  it("copia a seleção sem pintar e cola na camada ativa", () => {
    const session = new EditorSession(createSprite(4, 4));
    const source = findCel(session.doc, session.activeLayerId, session.activeFrameId);
    if (!source) throw new Error("cel ausente");
    setPixel(source.image, 1, 1, red);
    const mask = new Uint8Array(16);
    mask[1 * 4 + 1] = 1;
    session.setSelection(mask);
    expect(session.copySelection()).toBe(true);
    expect(getPixel(source.image, 1, 1)).toEqual(red);
    expect(getPixel(source.image, 2, 2)).toEqual(clear);

    expect(session.addLayer()).toBe(true);
    const targetId = session.activeLayerId;
    expect(session.pasteClipboard()).toBe(true);
    const target = findCel(session.doc, targetId, session.activeFrameId);
    expect(target && getPixel(target.image, 1, 1)).toEqual(red);
    expect(getPixel(source.image, 1, 1)).toEqual(red);
    session.undo();
    expect(target && getPixel(target.image, 1, 1)).toEqual(clear);
  });
});
