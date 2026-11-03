import { describe, expect, it } from "vitest";
import { EditorSession } from "../app/session";
import { createSprite } from "../domain/factory";
import { createImage, getPixel, setPixel } from "../domain/image-buffer";
import { prepareVideoFrames } from "./video";

const red = { r: 255, g: 0, b: 0, a: 255 };
const black = { r: 0, g: 0, b: 0, a: 255 };

describe("vídeo", () => {
  it("amplia um pixel vermelho para um bloco 2×2", () => {
    const image = createImage(1, 1);
    setPixel(image, 0, 0, red);
    const [frame] = prepareVideoFrames([{ image, durationMs: 100 }], { scale: 2, background: black });
    expect(frame?.image.width).toBe(2);
    expect(frame?.image.height).toBe(2);
    expect(getPixel(frame!.image, 0, 0)).toEqual(red);
    expect(getPixel(frame!.image, 1, 0)).toEqual(red);
    expect(getPixel(frame!.image, 0, 1)).toEqual(red);
    expect(getPixel(frame!.image, 1, 1)).toEqual(red);
    expect(frame?.durationMs).toBe(100);
  });

  it("pinta a transparência com a cor de fundo e completa o tamanho ímpar", () => {
    const image = createImage(1, 1);
    const blue = { r: 0, g: 0, b: 255, a: 255 };
    const [frame] = prepareVideoFrames([{ image, durationMs: 80 }], { scale: 1, background: blue });
    expect(frame?.image.width).toBe(2);
    expect(frame?.image.height).toBe(2);
    expect(getPixel(frame!.image, 0, 0)).toEqual(blue);
    expect(getPixel(frame!.image, 1, 0)).toEqual(blue);
    expect(getPixel(frame!.image, 0, 1)).toEqual(blue);
    expect(frame?.durationMs).toBe(80);
  });

  it("compõe um pixel semitransparente sobre o fundo", () => {
    const image = createImage(1, 1);
    setPixel(image, 0, 0, { r: 255, g: 0, b: 0, a: 128 });
    const [frame] = prepareVideoFrames([{ image, durationMs: 40 }], { scale: 2, background: black });
    expect(getPixel(frame!.image, 0, 0)).toEqual({ r: 128, g: 0, b: 0, a: 255 });
    expect(getPixel(frame!.image, 1, 1)).toEqual({ r: 128, g: 0, b: 0, a: 255 });
  });

  it("prepara só a faixa da tag ativa e inverte se a tag for reverse", () => {
    const session = new EditorSession(createSprite(1, 1));
    session.addFrame(true);
    session.addFrame(true);
    session.doc.frames[0]!.durationMs = 40;
    session.doc.frames[1]!.durationMs = 80;
    session.doc.frames[2]!.durationMs = 120;
    session.doc.tags.push({ id: "walk", name: "Walk", from: 1, to: 2, direction: "forward" });
    session.activeFrameIndex = 1;
    const forward = prepareVideoFrames(session.exportAnimation({ tagRange: true }), { scale: 1, background: black });
    expect(forward.map((frame) => frame.durationMs)).toEqual([80, 120]);

    session.doc.tags[0]!.direction = "reverse";
    const reverse = prepareVideoFrames(session.exportAnimation({ tagRange: true }), { scale: 1, background: black });
    expect(reverse.map((frame) => frame.durationMs)).toEqual([120, 80]);

    session.activeFrameIndex = 0;
    const all = prepareVideoFrames(session.exportAnimation({ tagRange: true }), { scale: 1, background: black });
    expect(all.map((frame) => frame.durationMs)).toEqual([40, 80, 120]);
  });
});
