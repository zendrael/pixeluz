import { describe, expect, it } from "vitest";
import { createImage, getPixel, setPixel } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import { readImageSprite } from "./image-file";
import { encodePng } from "./png";

const red = { r: 255, g: 0, b: 0, a: 255 };
const green = { r: 0, g: 255, b: 0, a: 255 };
const blue = { r: 0, g: 0, b: 255, a: 255 };
const white = { r: 255, g: 255, b: 255, a: 255 };

describe("image file", () => {
  it("opens a png as a sprite the size of the image", async () => {
    const image = createImage(2, 1);
    setPixel(image, 0, 0, red);
    setPixel(image, 1, 0, blue);
    const sprite = await readImageSprite(encodePng(image), "gato.png");
    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(1);
    expect(sprite.name).toBe("gato");
    expect(sprite.frames).toHaveLength(1);
    const cel = findCel(sprite, sprite.layers[0]!.id, sprite.frames[0]!.id);
    expect(cel && getPixel(cel.image, 0, 0)).toEqual(red);
    expect(cel && getPixel(cel.image, 1, 0)).toEqual(blue);
  });

  it("opens an rgb png that uses scanline filters", async () => {
    const png = hex(
      "89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a73000000017352474200aece1ce900000044655849664d4d002a00000008000187690004000000010000001a000000000003a00100030000000100010000a00200040000000100000002a0030004000000010000000200000000ed18bcaa0000001549444154081d63f8cfc0c0f09f811148fcffcf00001ef604fda0065a060000000049454e44ae426082",
    );
    const sprite = await readImageSprite(png, "quadrado.png");
    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(2);
    const cel = findCel(sprite, sprite.layers[0]!.id, sprite.frames[0]!.id);
    expect(cel && getPixel(cel.image, 0, 0)).toEqual(red);
    expect(cel && getPixel(cel.image, 1, 0)).toEqual(green);
    expect(cel && getPixel(cel.image, 0, 1)).toEqual(blue);
    expect(cel && getPixel(cel.image, 1, 1)).toEqual(white);
  });

  it("opens a gif as frames the size of the image", async () => {
    const gif = hex(
      "47494638396102000100f00000ff00000000ff21ff0b4e45545343415045322e30030100000021f904000a0000002c0000000002000100000202440a0021f90400140000002c00000000020001008000ff00ffffff0202440a003b",
    );
    const sprite = await readImageSprite(gif, "pula.gif");
    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(1);
    expect(sprite.name).toBe("pula");
    expect(sprite.frames.map((frame) => frame.durationMs)).toEqual([100, 200]);
    const layerId = sprite.layers[0]!.id;
    const first = findCel(sprite, layerId, sprite.frames[0]!.id);
    const second = findCel(sprite, layerId, sprite.frames[1]!.id);
    expect(first && getPixel(first.image, 0, 0)).toEqual(red);
    expect(first && getPixel(first.image, 1, 0)).toEqual(blue);
    expect(second && getPixel(second.image, 0, 0)).toEqual(green);
    expect(second && getPixel(second.image, 1, 0)).toEqual(white);
  });

  it("opens a jpeg as a sprite the size of the image", async () => {
    const jpeg = hex(
      "ffd8ffe000104a46494600010100004800480000ffe1004c4578696600004d4d002a00000008000187690004000000010000001a000000000003a00100030000000100010000a00200040000000100000002a0030004000000010000000200000000ffed003850686f746f73686f7020332e30003842494d04040000000000003842494d0425000000000010d41d8cd98f00b204e9800998ecf8427effc00011080002000203011100021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffdb00430001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffdb00430101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffdd00040001ffda000c03010002110311003f00feb03fe09c1f023e07f897fe09e3fb06788bc45f06be14ebfe20d7ff00630fd9735ad775dd6be1df84355d675ad6755f81fe06bed4f56d5b53bed1ee2fb52d4f52bd9e7bcbfbfbc9e7babcba9a5b8b89649a4776fa0fa50fd1efc04cabe931f489cb32bf043c20cbb2dcbbc74f16f019765d80f0d382f0781c060707c7fc4187c260b0584c3e4d4f0f85c26170f4e9d0c3e1e853a746851a70a54e11846318fe3f8ff05fc1de3dc76378eb8ebc27f0d38d38db8d31789e2ce31e31e2ce04e17e23e2ae2ce2ae23ad3ce388789b89b88738caf199b67bc419ee6f8cc5e699ce739a6331798e6998e2b138ec7626be26bd4ab3ffd9",
    );
    const sprite = await readImageSprite(jpeg, "foto.jpg");
    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(2);
    expect(sprite.name).toBe("foto");
    const cel = findCel(sprite, sprite.layers[0]!.id, sprite.frames[0]!.id);
    expectClose(cel && getPixel(cel.image, 0, 0), red);
    expectClose(cel && getPixel(cel.image, 1, 0), green);
    expectClose(cel && getPixel(cel.image, 0, 1), blue);
    expectClose(cel && getPixel(cel.image, 1, 1), white);
  });

  it("opens a subsampled jpeg without shifting the colors", async () => {
    const jpeg = hex(
      "ffd8ffe000104a46494600010100000100010000ffdb00430006040506050406060506070706080a100a0a09090a140e0f0c1017141818171416161a1d251f1a1b231c1616202c20232627292a29191f2d302d283025282928ffdb0043010707070a080a130a0a13281a161a2828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828282828ffc00011080008001003012200021101031101ffc400160001010100000000000000000000000000000607ffc40014100100000000000000000000000000000000ffc40014010100000000000000000000000000000006ffc40019110002030100000000000000000000000000074482c283ffda000c03010002110311003f00ce900060a797cf63d6645be0ffd9",
    );
    const sprite = await readImageSprite(jpeg, "faixa.jpeg");
    expect(sprite.width).toBe(16);
    expect(sprite.height).toBe(8);
    expect(sprite.name).toBe("faixa");
    const cel = findCel(sprite, sprite.layers[0]!.id, sprite.frames[0]!.id);
    expectClose(cel && getPixel(cel.image, 0, 0), red, 8);
    expectClose(cel && getPixel(cel.image, 15, 7), blue, 8);
  });

  it("rejects an image larger than the sprite", async () => {
    const image = createImage(257, 1);
    await expect(readImageSprite(encodePng(image), "grande.png")).rejects.toThrow("A imagem precisa ter de 1 a 256 pixels de lado");
  });

  it("opens an interlaced indexed png", async () => {
    const png = hex(
      "89504e470d0a1a0a0000000d494844520000000200000002020300000178dfd521000000206348524d00007a26000080840000fa00000080e8000075300000ea6000003a98000017709cba513c0000000c504c5445ff000000ff000000fffffffffb0060f600000001624b474403110c4cf20000000774494d4507ea0a1e0a1d2fd8577eda0000002574455874646174653a63726561746500323032362d31302d33305431303a32343a31322b30303a3030df2db5ca0000002574455874646174653a6d6f6469667900323032362d31302d33305431303a32343a31322b30303a3030ae700d760000002874455874646174653a74696d657374616d7000323032362d31302d33305431303a32393a34372b30303a3030164386da0000000e4944415408d76360607060d80000017600f12c03ba380000000049454e44ae426082",
    );
    const sprite = await readImageSprite(png, "entrelaçado.png");
    expect(sprite.width).toBe(2);
    expect(sprite.height).toBe(2);
    expect(sprite.name).toBe("entrelaçado");
    const cel = findCel(sprite, sprite.layers[0]!.id, sprite.frames[0]!.id);
    expect(cel && getPixel(cel.image, 0, 0)).toEqual(red);
    expect(cel && getPixel(cel.image, 1, 0)).toEqual(green);
    expect(cel && getPixel(cel.image, 0, 1)).toEqual(blue);
    expect(cel && getPixel(cel.image, 1, 1)).toEqual(white);
  });
});

function expectClose(
  actual: { r: number; g: number; b: number; a: number } | null | undefined | false,
  expected: { r: number; g: number; b: number; a: number },
  tolerance = 2,
): void {
  if (!actual) {
    expect(actual).toEqual(expected);
    return;
  }
  expect(actual.a).toBe(expected.a);
  expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(tolerance);
}

function hex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}
