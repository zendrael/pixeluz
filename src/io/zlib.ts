import { bytesToBlob, concatBytes } from "./bytes";

export function zlibStore(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(0x78, 0x01)];
  let offset = 0;
  do {
    const last = offset + 65535 >= data.length;
    const size = Math.min(65535, data.length - offset);
    const header = new Uint8Array(5 + size);
    header[0] = last ? 1 : 0;
    header[1] = size & 255;
    header[2] = size >> 8;
    const complement = size ^ 0xffff;
    header[3] = complement & 255;
    header[4] = complement >> 8;
    header.set(data.subarray(offset, offset + size), 5);
    parts.push(header);
    offset += size;
  } while (offset < data.length);
  const sum = adler32(data);
  parts.push(Uint8Array.of((sum >>> 24) & 255, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255));
  return concatBytes(parts);
}

export async function zlibInflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate");
  const buffer = await new Response(bytesToBlob(data).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buffer);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
