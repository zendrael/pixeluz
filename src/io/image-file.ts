import { createSprite } from "../domain/factory";
import { createId } from "../domain/ids";
import { DEFAULT_FRAME_MS, MAX_SPRITE_SIZE, MIN_SPRITE_SIZE } from "../domain/limits";
import { createCel } from "../domain/sprite";
import type { ImageBuffer, SpriteDocument } from "../domain/types";
import { bytesToBlob } from "./bytes";
import { readGifFrames } from "./gif";
import { decodeJpeg } from "./jpeg";
import { decodePng } from "./png";

export function isImageFile(bytes: Uint8Array): boolean {
  return isPng(bytes) || isGif(bytes) || isJpeg(bytes);
}

export async function readImageSprite(bytes: Uint8Array, filename = ""): Promise<SpriteDocument> {
  if (isPng(bytes)) return spriteFromFrames([{ image: await decodeOrBrowser(() => decodePng(bytes), bytes, "image/png"), durationMs: DEFAULT_FRAME_MS }], filename);
  if (isGif(bytes)) return spriteFromFrames(readGifFrames(bytes), filename);
  if (isJpeg(bytes)) return spriteFromFrames([{ image: await decodeOrBrowser(() => decodeJpeg(bytes), bytes, "image/jpeg"), durationMs: DEFAULT_FRAME_MS }], filename);
  throw new Error("Imagem inválida");
}

async function decodeOrBrowser(decode: () => Promise<ImageBuffer> | ImageBuffer, bytes: Uint8Array, type: string): Promise<ImageBuffer> {
  try {
    return await decode();
  } catch (error) {
    try {
      return await decodeWithBrowser(bytes, type);
    } catch {
      throw error;
    }
  }
}

async function decodeWithBrowser(bytes: Uint8Array, type: string): Promise<ImageBuffer> {
  if (typeof createImageBitmap !== "function") throw new Error("Imagem inválida");
  const bitmap = await createImageBitmap(bytesToBlob(bytes, type));
  try {
    const canvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Imagem inválida");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, data: new Uint8ClampedArray(pixels.data) };
  } finally {
    bitmap.close();
  }
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
}

function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function spriteFromFrames(frames: Array<{ image: ImageBuffer; durationMs: number }>, filename: string): SpriteDocument {
  const first = frames[0];
  if (!first) throw new Error("Imagem inválida");
  if (
    first.image.width < MIN_SPRITE_SIZE ||
    first.image.height < MIN_SPRITE_SIZE ||
    first.image.width > MAX_SPRITE_SIZE ||
    first.image.height > MAX_SPRITE_SIZE
  ) {
    throw new Error("A imagem precisa ter de 1 a 256 pixels de lado");
  }
  const sprite = createSprite(first.image.width, first.image.height, spriteName(filename));
  const layerId = sprite.layers[0]?.id;
  const frameId = sprite.frames[0]?.id;
  if (!layerId || !frameId || !sprite.cels[0] || !sprite.frames[0]) throw new Error("Imagem inválida");
  sprite.frames[0].durationMs = first.durationMs;
  sprite.cels[0].image = first.image;
  for (let index = 1; index < frames.length; index += 1) {
    const frame = frames[index];
    if (!frame || frame.image.width !== sprite.width || frame.image.height !== sprite.height) throw new Error("Imagem inválida");
    const id = createId();
    sprite.frames.push({ id, durationMs: frame.durationMs });
    sprite.cels.push(createCel(layerId, id, sprite.width, sprite.height));
    const cel = sprite.cels[sprite.cels.length - 1];
    if (cel) cel.image = frame.image;
  }
  return sprite;
}

function spriteName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  return base.replace(/\.(png|gif|jpe?g)$/i, "").trim();
}
