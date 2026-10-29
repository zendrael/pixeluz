import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

const palette = {
  ".": [13, 110, 253, 255],
  w: [248, 249, 250, 255],
  k: [33, 37, 41, 255],
  r: [220, 53, 69, 255],
  y: [255, 193, 7, 255],
  g: [25, 135, 84, 255],
  b: [13, 110, 253, 255],
  p: [111, 66, 193, 255],
  o: [253, 126, 20, 255],
};

const art = [
  "................",
  "................",
  "..wwwwwwwwwwww..",
  "..wrrwwyywwggw..",
  "..wrrwwyywwggw..",
  "..wwwwwwwwwwww..",
  "..wbbwwppwwoow..",
  "..wbbwwppwwoow..",
  "..wwwwwwwwwwww..",
  "..wkkkkkkkkkkww.",
  "..wkkkkkkkkkkww.",
  "..wwwwwwwwwwww..",
  "................",
  "................",
  "................",
  "................",
];

function sourcePixels() {
  const size = 16;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = palette[art[y][x]] ?? palette["."];
      const i = (y * size + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
  return data;
}

function scale(src, factor) {
  const sw = 16;
  const dw = sw * factor;
  const out = Buffer.alloc(dw * dw * 4);
  for (let y = 0; y < dw; y++) {
    for (let x = 0; x < dw; x++) {
      const si = (Math.floor(y / factor) * sw + Math.floor(x / factor)) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { width: dw, height: dw, data: out };
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function maskable(size, factor) {
  const art = scale(sourcePixels(), factor);
  const background = [33, 37, 41, 255];
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = background[0];
    data[i + 1] = background[1];
    data[i + 2] = background[2];
    data[i + 3] = background[3];
  }
  const ox = Math.floor((size - art.width) / 2);
  const oy = Math.floor((size - art.height) / 2);
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      const si = (y * art.width + x) * 4;
      const di = ((y + oy) * size + (x + ox)) * 4;
      data[di] = art.data[si];
      data[di + 1] = art.data[si + 1];
      data[di + 2] = art.data[si + 2];
      data[di + 3] = art.data[si + 3];
    }
  }
  return data;
}

mkdirSync(outDir, { recursive: true });
const src = sourcePixels();
for (const size of [192, 512]) {
  const image = scale(src, size / 16);
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(image.width, image.height, image.data));
}
writeFileSync(join(outDir, "icon-maskable-192.png"), encodePng(192, 192, maskable(192, 8)));
writeFileSync(join(outDir, "icon-maskable-512.png"), encodePng(512, 512, maskable(512, 20)));
