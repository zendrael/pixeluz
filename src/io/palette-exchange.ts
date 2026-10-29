import type { Rgba } from "../domain/types";

export interface PaletteFile {
  colors: Rgba[];
  name: string;
  author: string;
}

const HEX_LINE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const GPL_LINE = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+.*)?$/;
const NAME_LINE = /^(?:#\s*)?(?:palette name|name)\s*:\s*(.+)$/i;

export function lospecSlug(input: string): string | null {
  const trimmed = input.trim().replace(/\.(?:hex|gpl|json|txt)$/i, "");
  if (!trimmed) return null;
  const fromUrl = /lospec\.com\/palette-list\/([a-z0-9_-]+)/i.exec(trimmed);
  const slug = fromUrl?.[1] ?? (/^[a-z0-9_-]+$/i.test(trimmed) ? trimmed : "");
  return slug ? slug.toLowerCase() : null;
}

export function lospecPaletteUrl(slug: string): string {
  return `https://lospec.com/palette-list/${encodeURIComponent(slug)}.json`;
}

export function parsePaletteFile(source: string): PaletteFile | null {
  const text = source.replace(/^\uFEFF/, "").trim();
  if (!text) return null;
  if (text.startsWith("{")) return parseJsonPalette(text);
  return parseTextPalette(text);
}

export function paletteToHex(colors: Rgba[]): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  const lines = colors.map((color) => {
    const rgb = `${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
    return color.a === 255 ? rgb : `${rgb}${channel(color.a)}`;
  });
  return `${lines.join("\n")}\n`;
}

export async function fetchLospecPalette(slug: string, fetchImpl: typeof fetch = fetch): Promise<PaletteFile> {
  const response = await fetchImpl(lospecPaletteUrl(slug));
  if (!response.ok) throw new Error("not-found");
  const parsed = parsePaletteFile(await response.text());
  if (!parsed) throw new Error("invalid");
  return parsed;
}

function parseJsonPalette(source: string): PaletteFile | null {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as { name?: unknown; author?: unknown; colors?: unknown };
  if (!Array.isArray(record.colors)) return null;
  const colors: Rgba[] = [];
  for (const entry of record.colors) {
    if (typeof entry !== "string") return null;
    const color = hexColor(entry.trim());
    if (!color) return null;
    colors.push(color);
  }
  if (colors.length === 0) return null;
  return {
    colors,
    name: typeof record.name === "string" ? record.name.trim() : "",
    author: typeof record.author === "string" ? record.author.trim() : "",
  };
}

function parseTextPalette(source: string): PaletteFile | null {
  const colors: Rgba[] = [];
  let name = "";
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const named = NAME_LINE.exec(line);
    if (named?.[1]) {
      name = named[1].trim();
      continue;
    }
    const hex = HEX_LINE.exec(line);
    if (hex?.[1]) {
      const color = hexColor(hex[1]);
      if (color) colors.push(color);
      continue;
    }
    const gpl = GPL_LINE.exec(line);
    if (!gpl?.[1] || !gpl[2] || !gpl[3]) continue;
    const channels = [Number(gpl[1]), Number(gpl[2]), Number(gpl[3])];
    if (channels.some((channel) => channel > 255)) continue;
    colors.push({ r: channels[0] ?? 0, g: channels[1] ?? 0, b: channels[2] ?? 0, a: 255 });
  }
  if (colors.length === 0) return null;
  return { colors, name, author: "" };
}

function hexColor(value: string): Rgba | null {
  const match = HEX_LINE.exec(value.trim());
  const hex = match?.[1];
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
  };
}
