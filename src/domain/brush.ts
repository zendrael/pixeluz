import { getPixel } from "./image-buffer";
import type { BrushShape, Stamp } from "./draw-options";
import type { ImageBuffer } from "./types";

export function penFactor(pressure: number, pointerType: string): number {
  if (pointerType !== "pen") return 1;
  if (pressure <= 0) return 1;
  return Math.min(1, pressure);
}

export function brushStamps(shape: BrushShape, size: number, angle: number, custom: ImageBuffer | null): Stamp[] {
  const raw = shape === "custom" && custom ? customStamps(custom) : geometricStamps(shape === "circle" ? "circle" : "square", size);
  return rotateStamps(raw.length > 0 ? raw : [{ x: 0, y: 0, alpha: 255 }], angle);
}

function geometricStamps(shape: "square" | "circle", size: number): Stamp[] {
  const stamps: Stamp[] = [];
  const half = Math.floor(size / 2);
  const radius = (size - 1) / 2;
  for (let y = -half; y < size - half; y++) {
    for (let x = -half; x < size - half; x++) {
      if (shape === "circle" && x * x + y * y > radius * radius + 1e-6) continue;
      stamps.push({ x, y, alpha: 255 });
    }
  }
  return stamps;
}

function customStamps(image: ImageBuffer): Stamp[] {
  const stamps: Stamp[] = [];
  const cx = Math.floor((image.width - 1) / 2);
  const cy = Math.floor((image.height - 1) / 2);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const pixel = getPixel(image, x, y);
      if (!pixel || pixel.a === 0) continue;
      stamps.push({ x: x - cx, y: y - cy, alpha: pixel.a });
    }
  }
  return stamps;
}

function rotateStamps(stamps: Stamp[], angle: number): Stamp[] {
  const turns = ((Math.round(angle) % 360) + 360) % 360;
  if (turns === 0) return stamps;
  const rad = (turns * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const map = new Map<string, Stamp>();
  for (const stamp of stamps) {
    const x = Math.round(stamp.x * cos - stamp.y * sin);
    const y = Math.round(stamp.x * sin + stamp.y * cos);
    const key = `${x},${y}`;
    const previous = map.get(key);
    if (!previous || previous.alpha < stamp.alpha) map.set(key, { x, y, alpha: stamp.alpha });
  }
  return [...map.values()];
}
