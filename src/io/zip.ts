import { concatBytes, crc32 } from "./bytes";

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function zipStored(entries: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    locals.push(local);
    const directory = new Uint8Array(46 + name.length);
    const centralView = new DataView(directory.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory);
    offset += local.length;
  }
  const directory = concatBytes(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...locals, directory, end]);
}

function dosTime(date: Date): number {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function dosDate(date: Date): number {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}
