import { concatBytes, crc32 } from "./bytes";
import { zlibInflate, zlibStore } from "./zlib";
import type { ImageBuffer } from "../domain/types";
import { createImage } from "../domain/image-buffer";

export function encodePng(image: ImageBuffer): Uint8Array {
  const scanlines = new Uint8Array(image.height * (1 + image.width * 4));
  for (let y = 0; y < image.height; y += 1) {
    const row = y * (1 + image.width * 4);
    scanlines[row] = 0;
    scanlines.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), row + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return concatBytes([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibStore(scanlines)),
    chunk("IEND", new Uint8Array()),
  ]);
}

export async function decodePng(bytes: Uint8Array): Promise<ImageBuffer> {
  if (bytes.length < 8 || bytes[0] !== 137 || bytes[1] !== 80) throw new Error("PNG inválido");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR" && data.length >= 8) {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const raw = await zlibInflate(concatBytes(idat));
  const image = createImage(width, height);
  const stride = 1 + width * 4;
  for (let y = 0; y < height; y += 1) {
    image.data.set(raw.subarray(y * stride + 1, (y + 1) * stride), y * width * 4);
  }
  return image;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
