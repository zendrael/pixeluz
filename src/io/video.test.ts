import { describe, expect, it } from "vitest";
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
});
