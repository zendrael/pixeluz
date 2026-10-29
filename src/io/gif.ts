import { concatBytes } from "./bytes";
import { createImage } from "../domain/image-buffer";
import { quantizePalette, nearestOpaque } from "../domain/quantize";
import type { ImageBuffer, Rgba } from "../domain/types";

export interface GifSource {
  image: ImageBuffer;
  durationMs: number;
}

export function writeGif(frames: GifSource[]): Uint8Array {
  if (frames.length === 0 || !frames[0]) throw new Error("GIF sem quadros");
  const width = frames[0].image.width;
  const height = frames[0].image.height;
  const colors = quantizePalette(frames.map((frame) => frame.image), 255);
  const table = padPalette([{ r: 0, g: 0, b: 0, a: 0 }, ...colors]);
  const parts: Uint8Array[] = [header(width, height, table), netscape()];
  for (const frame of frames) {
    const indices = mapFrame(frame.image, table);
    const delay = Math.max(2, Math.min(65535, Math.round(frame.durationMs / 10)));
    parts.push(graphicControl(delay), imageDescriptor(width, height), lzwImage(indices));
  }
  parts.push(Uint8Array.of(0x3b));
  return concatBytes(parts);
}

export function readGif(bytes: Uint8Array): ImageBuffer[] {
  if (bytes.length < 13 || String.fromCharCode(...bytes.subarray(0, 6)) !== "GIF89a") throw new Error("GIF inválido");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const packed = bytes[10] ?? 0;
  const tableSize = 1 << ((packed & 7) + 1);
  let offset = 13;
  const palette: Rgba[] = [];
  if (packed & 0x80) {
    for (let index = 0; index < tableSize; index += 1) {
      palette.push({ r: bytes[offset] ?? 0, g: bytes[offset + 1] ?? 0, b: bytes[offset + 2] ?? 0, a: 255 });
      offset += 3;
    }
  }
  const frames: ImageBuffer[] = [];
  let transparent = -1;
  while (offset < bytes.length) {
    const marker = bytes[offset];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset + 1];
      if (label === 0xf9 && (bytes[offset + 3] ?? 0) >= 4) {
        const control = bytes[offset + 3] ?? 0;
        transparent = control & 1 ? (bytes[offset + 6] ?? -1) : -1;
      }
      offset += 2;
      while (offset < bytes.length) {
        const size = bytes[offset] ?? 0;
        offset += 1 + size;
        if (size === 0) break;
      }
      continue;
    }
    if (marker !== 0x2c) throw new Error("GIF inválido");
    const frameWidth = view.getUint16(offset + 5, true);
    const frameHeight = view.getUint16(offset + 7, true);
    offset += 10;
    const minCodeSize = bytes[offset] ?? 8;
    offset += 1;
    const compressed: number[] = [];
    while (offset < bytes.length) {
      const size = bytes[offset] ?? 0;
      offset += 1;
      if (size === 0) break;
      compressed.push(...bytes.subarray(offset, offset + size));
      offset += size;
    }
    const indices = lzwDecode(Uint8Array.from(compressed), minCodeSize, frameWidth * frameHeight);
    const image = createImage(width, height);
    for (let index = 0; index < indices.length; index += 1) {
      const colorIndex = indices[index] ?? 0;
      const color = palette[colorIndex] ?? { r: 0, g: 0, b: 0, a: 255 };
      const pixel = index * 4;
      if (colorIndex === transparent) {
        image.data[pixel + 3] = 0;
        continue;
      }
      image.data[pixel] = color.r;
      image.data[pixel + 1] = color.g;
      image.data[pixel + 2] = color.b;
      image.data[pixel + 3] = 255;
    }
    frames.push(image);
  }
  return frames;
}

function header(width: number, height: number, table: Rgba[]): Uint8Array {
  const out = new Uint8Array(13 + table.length * 3);
  out.set(new TextEncoder().encode("GIF89a"));
  const view = new DataView(out.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  out[10] = 0xf7;
  for (let index = 0; index < table.length; index += 1) {
    const color = table[index];
    out[13 + index * 3] = color?.r ?? 0;
    out[14 + index * 3] = color?.g ?? 0;
    out[15 + index * 3] = color?.b ?? 0;
  }
  return out;
}

function netscape(): Uint8Array {
  return Uint8Array.of(0x21, 0xff, 0x0b, ...new TextEncoder().encode("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00);
}

function graphicControl(delay: number): Uint8Array {
  return Uint8Array.of(0x21, 0xf9, 0x04, 0x09, delay & 255, delay >> 8, 0x00, 0x00);
}

function imageDescriptor(width: number, height: number): Uint8Array {
  const out = new Uint8Array(10);
  out[0] = 0x2c;
  const view = new DataView(out.buffer);
  view.setUint16(5, width, true);
  view.setUint16(7, height, true);
  return out;
}

function lzwImage(indices: Uint8Array): Uint8Array {
  const coded = lzwEncode(indices, 8);
  const parts: number[] = [8];
  for (let offset = 0; offset < coded.length; offset += 255) {
    const slice = coded.subarray(offset, offset + 255);
    parts.push(slice.length, ...slice);
  }
  parts.push(0);
  return Uint8Array.from(parts);
}

function mapFrame(image: ImageBuffer, table: Rgba[]): Uint8Array {
  const indices = new Uint8Array(image.width * image.height);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const index = pixel * 4;
    const alpha = image.data[index + 3] ?? 0;
    if (alpha === 0) {
      indices[pixel] = 0;
      continue;
    }
    const color = { r: image.data[index] ?? 0, g: image.data[index + 1] ?? 0, b: image.data[index + 2] ?? 0, a: alpha };
    indices[pixel] = nearestIndex(color, table);
  }
  return indices;
}

function nearestIndex(color: Rgba, table: Rgba[]): number {
  const nearest = nearestOpaque(color, table);
  if (!nearest) return 1;
  const index = table.findIndex((entry, entryIndex) => entryIndex > 0 && entry.r === nearest.r && entry.g === nearest.g && entry.b === nearest.b);
  return index < 0 ? 1 : index;
}

function padPalette(colors: Rgba[]): Rgba[] {
  const table = colors.slice(0, 256);
  while (table.length < 256) table.push({ r: 0, g: 0, b: 0, a: 255 });
  return table;
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  const dict = new Map<string, number>();
  const reset = (): void => {
    dict.clear();
    codeSize = minCodeSize + 1;
    next = eoi + 1;
  };
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  const write = (code: number): void => {
    acc |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(acc & 255);
      acc >>= 8;
      bits -= 8;
    }
  };
  reset();
  write(clear);
  if (indices.length === 0) {
    write(eoi);
    if (bits > 0) out.push(acc & 255);
    return Uint8Array.from(out);
  }
  let prefix = indices[0] ?? 0;
  for (let index = 1; index < indices.length; index += 1) {
    const byte = indices[index] ?? 0;
    const combined = `${prefix},${byte}`;
    const found = dict.get(combined);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    write(prefix);
    if (next < 4096) {
      dict.set(combined, next);
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    } else {
      write(clear);
      reset();
    }
    prefix = byte;
  }
  write(prefix);
  write(eoi);
  if (bits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

function lzwDecode(bytes: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let dict: Uint8Array[] = [];
  const reset = (): void => {
    dict = [];
    for (let index = 0; index < clear; index += 1) dict.push(Uint8Array.of(index));
    codeSize = minCodeSize + 1;
    next = eoi + 1;
  };
  reset();
  let acc = 0;
  let bits = 0;
  let pos = 0;
  const read = (): number => {
    while (bits < codeSize) {
      acc |= (bytes[pos] ?? 0) << bits;
      pos += 1;
      bits += 8;
    }
    const code = acc & ((1 << codeSize) - 1);
    acc >>= codeSize;
    bits -= codeSize;
    return code;
  };
  const output = new Uint8Array(pixelCount);
  let written = 0;
  let prev: Uint8Array | null = null;
  while (written < pixelCount) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: Uint8Array | undefined;
    if (code < clear) entry = dict[code];
    else if (code > eoi && code < next) entry = dict[code];
    else if (prev && code === next) entry = appendByte(prev, prev[0] ?? 0);
    if (!entry) break;
    for (const value of entry) {
      if (written < pixelCount) output[written] = value;
      written += 1;
    }
    if (prev && next < 4096) {
      dict[next] = appendByte(prev, entry[0] ?? 0);
      next += 1;
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
    }
    prev = entry;
  }
  return output;
}

function appendByte(prefix: Uint8Array, byte: number): Uint8Array {
  const next = new Uint8Array(prefix.length + 1);
  next.set(prefix);
  next[prefix.length] = byte;
  return next;
}
