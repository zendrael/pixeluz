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
  if (bytes.length < 8 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error("PNG inválido");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    if (offset + 12 + length > bytes.length) throw new Error("PNG inválido");
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR" && data.length >= 13) {
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = header.getUint32(0);
      height = header.getUint32(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
      if ((data[10] ?? 1) !== 0 || (data[11] ?? 1) !== 0) throw new Error("PNG inválido");
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") transparency = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (width < 1 || height < 1 || idat.length === 0 || interlace > 1) throw new Error("PNG inválido");
  const samples = samplesPerPixel(colorType);
  const raw = await zlibInflate(concatBytes(idat));
  if (interlace === 1) return decodeInterlaced(raw, width, height, bitDepth, colorType, palette, transparency);
  const channels = unfilter(raw, width, height, bitDepth, samples);
  return pixelsToImage(channels, width, height, bitDepth, colorType, palette, transparency);
}

const ADAM7: Array<[number, number, number, number]> = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

function decodeInterlaced(
  raw: Uint8Array,
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): ImageBuffer {
  const image = createImage(width, height);
  const samples = samplesPerPixel(colorType);
  let src = 0;
  for (const pass of ADAM7) {
    const x0 = pass[0];
    const y0 = pass[1];
    const dx = pass[2];
    const dy = pass[3];
    if (x0 >= width || y0 >= height) continue;
    const passWidth = Math.ceil((width - x0) / dx);
    const passHeight = Math.ceil((height - y0) / dy);
    const rowBytes = Math.ceil((passWidth * bitDepth * samples) / 8);
    const size = passHeight * (1 + rowBytes);
    if (src + size > raw.length) throw new Error("PNG inválido");
    const channels = unfilter(raw.subarray(src, src + size), passWidth, passHeight, bitDepth, samples);
    src += size;
    for (let y = 0; y < passHeight; y += 1) {
      const row = channels.subarray(y * rowBytes, (y + 1) * rowBytes);
      for (let x = 0; x < passWidth; x += 1) {
        const color = sampleColor(row, x, bitDepth, colorType, palette, transparency);
        const pixel = ((y0 + y * dy) * width + (x0 + x * dx)) * 4;
        image.data[pixel] = color[0];
        image.data[pixel + 1] = color[1];
        image.data[pixel + 2] = color[2];
        image.data[pixel + 3] = color[3];
      }
    }
  }
  return image;
}

function samplesPerPixel(colorType: number): number {
  if (colorType === 0 || colorType === 3) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error("PNG inválido");
}

function unfilter(raw: Uint8Array, width: number, height: number, bitDepth: number, samples: number): Uint8Array {
  const bpp = Math.max(1, Math.ceil((bitDepth * samples) / 8));
  const rowBytes = Math.ceil((width * bitDepth * samples) / 8);
  const expected = height * (1 + rowBytes);
  if (raw.length < expected) throw new Error("PNG inválido");
  const out = new Uint8Array(height * rowBytes);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src] ?? 0;
    src += 1;
    const row = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[src] ?? 0;
      src += 1;
      const left = x >= bpp ? (out[row + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (out[row - rowBytes + x] ?? 0) : 0;
      const upLeft = x >= bpp && y > 0 ? (out[row - rowBytes + x - bpp] ?? 0) : 0;
      let decoded = value;
      if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + Math.floor((left + up) / 2);
      else if (filter === 4) decoded = value + paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error("PNG inválido");
      out[row + x] = decoded & 255;
    }
  }
  return out;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distLeft = Math.abs(estimate - left);
  const distUp = Math.abs(estimate - up);
  const distUpLeft = Math.abs(estimate - upLeft);
  if (distLeft <= distUp && distLeft <= distUpLeft) return left;
  if (distUp <= distUpLeft) return up;
  return upLeft;
}

function pixelsToImage(
  channels: Uint8Array,
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): ImageBuffer {
  const image = createImage(width, height);
  const samples = samplesPerPixel(colorType);
  const rowBytes = Math.ceil((width * bitDepth * samples) / 8);
  for (let y = 0; y < height; y += 1) {
    const row = channels.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const color = sampleColor(row, x, bitDepth, colorType, palette, transparency);
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = color[3];
    }
  }
  return image;
}

function sampleColor(
  row: Uint8Array,
  x: number,
  bitDepth: number,
  colorType: number,
  palette: Uint8Array | null,
  transparency: Uint8Array | null,
): [number, number, number, number] {
  const sample = (index: number) => readSample(row, bitDepth, index);
  if (colorType === 0) {
    const gray = sample(x);
    const alpha = transparentGray(gray, bitDepth, transparency) ? 0 : 255;
    return [gray, gray, gray, alpha];
  }
  if (colorType === 2) {
    const base = x * 3;
    const r = sample(base);
    const g = sample(base + 1);
    const b = sample(base + 2);
    const alpha = transparentRgb(r, g, b, bitDepth, transparency) ? 0 : 255;
    return [r, g, b, alpha];
  }
  if (colorType === 3) {
    const index = readSample(row, bitDepth, x, false);
    const start = index * 3;
    const alpha = transparency && index < transparency.length ? (transparency[index] ?? 255) : 255;
    return [palette?.[start] ?? 0, palette?.[start + 1] ?? 0, palette?.[start + 2] ?? 0, alpha];
  }
  if (colorType === 4) {
    const gray = sample(x * 2);
    const alpha = sample(x * 2 + 1);
    return [gray, gray, gray, alpha];
  }
  const base = x * 4;
  return [sample(base), sample(base + 1), sample(base + 2), sample(base + 3)];
}

function readSample(row: Uint8Array, bitDepth: number, index: number, expand = true): number {
  if (bitDepth === 16) return row[index * 2] ?? 0;
  if (bitDepth === 8) return row[index] ?? 0;
  const bitIndex = index * bitDepth;
  const byte = row[bitIndex >> 3] ?? 0;
  const shift = 8 - bitDepth - (bitIndex & 7);
  const mask = (1 << bitDepth) - 1;
  const value = (byte >> shift) & mask;
  if (!expand) return value;
  return Math.round((value * 255) / mask);
}

function transparentGray(gray: number, bitDepth: number, transparency: Uint8Array | null): boolean {
  if (!transparency || transparency.length < 2) return false;
  return new DataView(transparency.buffer, transparency.byteOffset, transparency.byteLength).getUint16(0) === scaleSample(gray, bitDepth);
}

function transparentRgb(r: number, g: number, b: number, bitDepth: number, transparency: Uint8Array | null): boolean {
  if (!transparency || transparency.length < 6) return false;
  const view = new DataView(transparency.buffer, transparency.byteOffset, transparency.byteLength);
  return view.getUint16(0) === scaleSample(r, bitDepth) && view.getUint16(2) === scaleSample(g, bitDepth) && view.getUint16(4) === scaleSample(b, bitDepth);
}

function scaleSample(value: number, bitDepth: number): number {
  if (bitDepth === 16) return value * 257;
  if (bitDepth === 8) return value;
  const mask = (1 << bitDepth) - 1;
  return Math.round((value * mask) / 255);
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
