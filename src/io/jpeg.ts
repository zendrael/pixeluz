import { createImage } from "../domain/image-buffer";
import type { ImageBuffer } from "../domain/types";

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29,
  22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

interface HuffTable {
  lookup: Map<string, number>;
}

interface Component {
  id: number;
  h: number;
  v: number;
  quantId: number;
  dcId: number;
  acId: number;
  predictor: number;
}

interface Plane {
  width: number;
  height: number;
  data: Float64Array;
}

class Bitstream {
  private acc = 0;
  private bits = 0;

  constructor(
    private readonly data: Uint8Array,
    public pos: number,
  ) {}

  align(): void {
    this.acc = 0;
    this.bits = 0;
  }

  readBit(): number {
    if (this.bits === 0) {
      const byte = this.data[this.pos] ?? 0;
      this.pos += 1;
      if (byte === 0xff) {
        const next = this.data[this.pos] ?? 0;
        this.pos += 1;
        if (next !== 0) throw new Error("JPEG inválido");
      }
      this.acc = byte;
      this.bits = 8;
    }
    this.bits -= 1;
    return (this.acc >> this.bits) & 1;
  }
}

export function decodeJpeg(bytes: Uint8Array): ImageBuffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("JPEG inválido");
  let pos = 2;
  const quant: number[][] = [];
  const dcTables: HuffTable[] = [];
  const acTables: HuffTable[] = [];
  let width = 0;
  let height = 0;
  let components: Component[] = [];
  let restart = 0;

  while (pos + 1 < bytes.length) {
    if (bytes[pos] !== 0xff) throw new Error("JPEG inválido");
    while (bytes[pos] === 0xff) pos += 1;
    const marker = bytes[pos] ?? 0;
    pos += 1;
    if (marker === 0xd9) throw new Error("JPEG inválido");
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (pos + 2 > bytes.length) throw new Error("JPEG inválido");
    const length = ((bytes[pos] ?? 0) << 8) | (bytes[pos + 1] ?? 0);
    if (length < 2 || pos + length > bytes.length) throw new Error("JPEG inválido");
    const segment = bytes.subarray(pos + 2, pos + length);
    pos += length;
    if (marker === 0xc0) {
      const frame = readFrame(segment);
      width = frame.width;
      height = frame.height;
      components = frame.components;
    } else if (marker === 0xc1 || marker === 0xc2) throw new Error("JPEG inválido");
    else if (marker === 0xc4) readHuffman(segment, dcTables, acTables);
    else if (marker === 0xdb) readQuant(segment, quant);
    else if (marker === 0xdd && segment.length >= 2) restart = (segment[0] ?? 0) << 8 | (segment[1] ?? 0);
    else if (marker === 0xda) {
      if (width < 1 || height < 1 || components.length === 0) throw new Error("JPEG inválido");
      const order = readScan(segment, components);
      return decodeScan(bytes, pos, width, height, components, order, quant, dcTables, acTables, restart);
    }
  }
  throw new Error("JPEG inválido");
}

function readFrame(segment: Uint8Array): { width: number; height: number; components: Component[] } {
  const height = ((segment[1] ?? 0) << 8) | (segment[2] ?? 0);
  const width = ((segment[3] ?? 0) << 8) | (segment[4] ?? 0);
  const count = segment[5] ?? 0;
  const components: Component[] = [];
  let offset = 6;
  for (let index = 0; index < count; index += 1) {
    const factor = segment[offset + 1] ?? 0;
    components.push({
      id: segment[offset] ?? 0,
      h: factor >> 4,
      v: factor & 15,
      quantId: segment[offset + 2] ?? 0,
      dcId: 0,
      acId: 0,
      predictor: 0,
    });
    offset += 3;
  }
  if (width < 1 || height < 1 || (count !== 1 && count !== 3) || components.some((item) => item.h < 1 || item.v < 1)) {
    throw new Error("JPEG inválido");
  }
  return { width, height, components };
}

function readHuffman(segment: Uint8Array, dcTables: HuffTable[], acTables: HuffTable[]): void {
  let offset = 0;
  while (offset < segment.length) {
    const info = segment[offset] ?? 0;
    offset += 1;
    const counts: number[] = [];
    let total = 0;
    for (let length = 0; length < 16; length += 1) {
      const count = segment[offset + length] ?? 0;
      counts.push(count);
      total += count;
    }
    offset += 16;
    const symbols = Array.from(segment.subarray(offset, offset + total));
    offset += total;
    const table = buildHuffman(counts, symbols);
    const id = info & 15;
    if (info >> 4 === 0) dcTables[id] = table;
    else acTables[id] = table;
  }
}

function buildHuffman(counts: number[], symbols: number[]): HuffTable {
  const lookup = new Map<string, number>();
  let code = 0;
  let symbolIndex = 0;
  for (let length = 1; length <= 16; length += 1) {
    const count = counts[length - 1] ?? 0;
    for (let index = 0; index < count; index += 1) {
      lookup.set(`${length}:${code}`, symbols[symbolIndex] ?? 0);
      symbolIndex += 1;
      code += 1;
    }
    code <<= 1;
  }
  return { lookup };
}

function readQuant(segment: Uint8Array, quant: number[][]): void {
  let offset = 0;
  while (offset < segment.length) {
    const info = segment[offset] ?? 0;
    offset += 1;
    const table = new Array<number>(64).fill(1);
    const precision = info >> 4;
    if (precision === 0) {
      for (let index = 0; index < 64; index += 1) table[ZIGZAG[index] ?? 0] = segment[offset + index] ?? 1;
      offset += 64;
    } else {
      for (let index = 0; index < 64; index += 1) {
        table[ZIGZAG[index] ?? 0] = ((segment[offset] ?? 0) << 8) | (segment[offset + 1] ?? 0);
        offset += 2;
      }
    }
    quant[info & 15] = table;
  }
}

function readScan(segment: Uint8Array, components: Component[]): Component[] {
  const count = segment[0] ?? 0;
  const order: Component[] = [];
  let offset = 1;
  for (let index = 0; index < count; index += 1) {
    const id = segment[offset] ?? 0;
    const tables = segment[offset + 1] ?? 0;
    const component = components.find((item) => item.id === id);
    if (!component) throw new Error("JPEG inválido");
    component.dcId = tables >> 4;
    component.acId = tables & 15;
    order.push(component);
    offset += 2;
  }
  return order;
}

function decodeScan(
  bytes: Uint8Array,
  start: number,
  width: number,
  height: number,
  components: Component[],
  order: Component[],
  quant: number[][],
  dcTables: HuffTable[],
  acTables: HuffTable[],
  restart: number,
): ImageBuffer {
  const maxH = Math.max(...components.map((item) => item.h));
  const maxV = Math.max(...components.map((item) => item.v));
  const mcuCols = Math.ceil(width / (maxH * 8));
  const mcuRows = Math.ceil(height / (maxV * 8));
  const planes = new Map<number, Plane>();
  for (const component of components) {
    const planeWidth = mcuCols * component.h * 8;
    const planeHeight = mcuRows * component.v * 8;
    planes.set(component.id, { width: planeWidth, height: planeHeight, data: new Float64Array(planeWidth * planeHeight) });
  }
  const stream = new Bitstream(bytes, start);
  let mcuCount = 0;
  let restartIndex = 0;
  for (let mcuY = 0; mcuY < mcuRows; mcuY += 1) {
    for (let mcuX = 0; mcuX < mcuCols; mcuX += 1) {
      if (restart > 0 && mcuCount > 0 && mcuCount % restart === 0) {
        stream.align();
        if (stream.pos + 1 >= bytes.length || bytes[stream.pos] !== 0xff || bytes[stream.pos + 1] !== 0xd0 + restartIndex) throw new Error("JPEG inválido");
        stream.pos += 2;
        restartIndex = (restartIndex + 1) & 7;
        for (const component of components) component.predictor = 0;
      }
      for (const component of order) {
        const plane = planes.get(component.id);
        const table = quant[component.quantId];
        const dc = dcTables[component.dcId];
        const ac = acTables[component.acId];
        if (!plane || !table || !dc || !ac) throw new Error("JPEG inválido");
        for (let blockY = 0; blockY < component.v; blockY += 1) {
          for (let blockX = 0; blockX < component.h; blockX += 1) {
            const samples = decodeBlock(stream, component, table, dc, ac);
            const originX = (mcuX * component.h + blockX) * 8;
            const originY = (mcuY * component.v + blockY) * 8;
            for (let y = 0; y < 8; y += 1) {
              for (let x = 0; x < 8; x += 1) plane.data[(originY + y) * plane.width + originX + x] = samples[y * 8 + x] ?? 0;
            }
          }
        }
      }
      mcuCount += 1;
    }
  }
  return paintImage(width, height, components, planes, maxH, maxV);
}

function decodeBlock(stream: Bitstream, component: Component, quant: number[], dcTable: HuffTable, acTable: HuffTable): number[] {
  const coef = new Array<number>(64).fill(0);
  const category = readSymbol(stream, dcTable);
  const diff = category === 0 ? 0 : receive(stream, category);
  component.predictor += diff;
  coef[0] = component.predictor * (quant[0] ?? 1);
  let index = 1;
  while (index < 64) {
    const symbol = readSymbol(stream, acTable);
    if (symbol === 0) break;
    if (symbol === 0xf0) {
      index += 16;
      continue;
    }
    index += symbol >> 4;
    const size = symbol & 15;
    if (index >= 64 || size === 0) break;
    const place = ZIGZAG[index] ?? 0;
    coef[place] = receive(stream, size) * (quant[place] ?? 1);
    index += 1;
  }
  return idct(coef);
}

function readSymbol(stream: Bitstream, table: HuffTable): number {
  let code = 0;
  for (let length = 1; length <= 16; length += 1) {
    code = (code << 1) | stream.readBit();
    const symbol = table.lookup.get(`${length}:${code}`);
    if (symbol !== undefined) return symbol;
  }
  throw new Error("JPEG inválido");
}

function receive(stream: Bitstream, length: number): number {
  let value = 0;
  for (let index = 0; index < length; index += 1) value = (value << 1) | stream.readBit();
  const threshold = 1 << (length - 1);
  if (value < threshold) return value - ((1 << length) - 1);
  return value;
}

function idct(coef: number[]): number[] {
  const out = new Array<number>(64).fill(0);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      let sum = 0;
      for (let v = 0; v < 8; v += 1) {
        for (let u = 0; u < 8; u += 1) {
          const cu = u === 0 ? Math.SQRT1_2 : 1;
          const cv = v === 0 ? Math.SQRT1_2 : 1;
          const value = coef[v * 8 + u] ?? 0;
          sum += cu * cv * value * Math.cos(((2 * x + 1) * u * Math.PI) / 16) * Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      out[y * 8 + x] = clampByte(sum / 4 + 128);
    }
  }
  return out;
}

function paintImage(width: number, height: number, components: Component[], planes: Map<number, Plane>, maxH: number, maxV: number): ImageBuffer {
  const image = createImage(width, height);
  const yComp = components[0];
  const cbComp = components[1];
  const crComp = components[2];
  if (!yComp) throw new Error("JPEG inválido");
  const yPlane = planes.get(yComp.id);
  if (!yPlane) throw new Error("JPEG inválido");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const luma = take(yPlane, x, y, yComp, maxH, maxV);
      let r = luma;
      let g = luma;
      let b = luma;
      if (cbComp && crComp) {
        const cbPlane = planes.get(cbComp.id);
        const crPlane = planes.get(crComp.id);
        if (!cbPlane || !crPlane) throw new Error("JPEG inválido");
        const cb = take(cbPlane, x, y, cbComp, maxH, maxV) - 128;
        const cr = take(crPlane, x, y, crComp, maxH, maxV) - 128;
        r = luma + 1.402 * cr;
        g = luma - 0.344136 * cb - 0.714136 * cr;
        b = luma + 1.772 * cb;
      }
      const pixel = (y * width + x) * 4;
      image.data[pixel] = clampByte(r);
      image.data[pixel + 1] = clampByte(g);
      image.data[pixel + 2] = clampByte(b);
      image.data[pixel + 3] = 255;
    }
  }
  return image;
}

function take(plane: Plane, x: number, y: number, component: Component, maxH: number, maxV: number): number {
  const sx = Math.floor((x * component.h) / maxH);
  const sy = Math.floor((y * component.v) / maxV);
  return plane.data[sy * plane.width + sx] ?? 0;
}

function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}
