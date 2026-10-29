import type { ImageBuffer } from "../domain/types";

export function downloadDataUrl(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export function pngDataUrl(image: ImageBuffer): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D indisponível");
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

export const PROJECT_FILE_TYPES: FilePickerType[] = [
  { description: "Projeto Pixeluz", accept: { "application/json": [".pixeluz.json", ".json"] } },
];

export const OPEN_FILE_TYPES: FilePickerType[] = [
  { description: "Pixeluz ou Aseprite", accept: { "application/octet-stream": [".pixeluz.json", ".json", ".ase", ".aseprite"] } },
];

export const PALETTE_FILE_TYPES: FilePickerType[] = [
  { description: "Paleta", accept: { "text/plain": [".hex", ".gpl", ".txt"], "application/json": [".json"] } },
];

interface PickerWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface SaveFileHandle {
  createWritable(): Promise<PickerWritable>;
}

interface OpenFileHandle {
  getFile(): Promise<File>;
}

type PickerHost = Window & {
  showOpenFilePicker?: (options: { multiple?: boolean; types?: FilePickerType[] }) => Promise<OpenFileHandle[]>;
  showSaveFilePicker?: (options: { suggestedName?: string; types?: FilePickerType[] }) => Promise<SaveFileHandle>;
};

export function filePickerAvailable(): boolean {
  const host = window as PickerHost;
  return typeof host.showOpenFilePicker === "function" && typeof host.showSaveFilePicker === "function";
}

export async function pickAndSave(blob: Blob, filename: string, types: FilePickerType[]): Promise<"saved" | "cancelled" | "unavailable"> {
  const host = window as PickerHost;
  if (typeof host.showSaveFilePicker !== "function") return "unavailable";
  try {
    const handle = await host.showSaveFilePicker({ suggestedName: filename, types });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export async function pickFile(types: FilePickerType[]): Promise<File | null> {
  const host = window as PickerHost;
  if (typeof host.showOpenFilePicker !== "function") return null;
  try {
    const [handle] = await host.showOpenFilePicker({ multiple: false, types });
    return handle ? handle.getFile() : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export function safeFilename(name: string): string {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\-_]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "pixeluz";
}
