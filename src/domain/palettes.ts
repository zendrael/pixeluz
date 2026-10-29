import { defaultPalette } from "./factory";
import type { Rgba } from "./types";

export interface PalettePreset {
  id: "sweetie16" | "db32" | "endesga32";
  colors: Rgba[];
}

const DB32 = [
  "000000", "222034", "45283c", "663931", "8f563b", "df7126", "d9a066", "eec39a",
  "fbf236", "99e550", "6abe30", "37946e", "4b692f", "524b24", "323c39", "3f3f74",
  "306082", "5b6ee1", "639bff", "5fcde4", "cbdbfc", "ffffff", "9badb7", "847e87",
  "696a6a", "595652", "76428a", "ac3232", "d95763", "d77bba", "8f974a", "8a6f30",
];

const ENDESGA32 = [
  "be4a2f", "d77643", "ead4aa", "e4a672", "b86f50", "733e39", "3e2731", "a22633",
  "e43b44", "f77622", "feae34", "fee761", "63c74d", "3e8948", "265c42", "193c3e",
  "124e89", "0099db", "2ce8f5", "ffffff", "c0cbdc", "8b9bb4", "5a6988", "3a4466",
  "262b44", "181425", "ff0044", "68386c", "b55088", "f6757a", "e8b796", "c28569",
];

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: "sweetie16", colors: defaultPalette() },
  { id: "db32", colors: DB32.map(hexColor) },
  { id: "endesga32", colors: ENDESGA32.map(hexColor) },
];

export function samePalette(left: Rgba[], right: Rgba[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((color, index) => {
    const other = right[index];
    return !!other && color.r === other.r && color.g === other.g && color.b === other.b && color.a === other.a;
  });
}

export function presetIdFor(colors: Rgba[]): PalettePreset["id"] | "" {
  return PALETTE_PRESETS.find((preset) => samePalette(preset.colors, colors))?.id ?? "";
}

function hexColor(value: string): Rgba {
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: 255,
  };
}
