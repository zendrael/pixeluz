import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { setPixel, getPixel } from "../domain/image-buffer";
import { createSprite } from "../domain/factory";
import { BLACK, WHITE } from "../domain/color";
import { deserializeProject, serializeProject } from "./project-json";

describe("project json", () => {
  it("roundtrips pixels, palette and frame duration", () => {
    const sprite = createSprite(4, 3, "Herói");
    const cel = sprite.cels[0];
    expect(cel).toBeDefined();
    if (!cel) return;
    setPixel(cel.image, 2, 1, { r: 1, g: 2, b: 3, a: 255 });
    sprite.frames[0]!.durationMs = 240;
    const raw = serializeProject({ sprite, foreground: BLACK, background: WHITE });
    const loaded = deserializeProject(raw);
    const loadedCel = loaded.sprite.cels[0];
    expect(loaded.sprite.name).toBe("Herói");
    expect(loaded.sprite.id).toBe(sprite.id);
    expect(loaded.sprite.frames[0]?.durationMs).toBe(240);
    expect(loadedCel && getPixel(loadedCel.image, 2, 1)).toEqual({ r: 1, g: 2, b: 3, a: 255 });
    expect(loaded.foreground).toEqual(BLACK);
  });

  it("shares one buffer across linked cels", () => {
    const sprite = createSprite(2, 2, "ligado");
    const first = sprite.cels[0];
    expect(first).toBeDefined();
    if (!first) return;
    const frameId = "frame-2";
    sprite.frames.push({ id: frameId, durationMs: 100 });
    first.linkId = "link-1";
    setPixel(first.image, 0, 0, { r: 9, g: 8, b: 7, a: 255 });
    sprite.cels.push({
      layerId: first.layerId,
      frameId,
      image: first.image,
      x: 1,
      y: 0,
      opacity: 200,
      linkId: "link-1",
    });
    const raw = serializeProject({ sprite, foreground: BLACK, background: WHITE });
    const stored = JSON.parse(raw) as { sprite: { cels: Array<{ image?: unknown }> } };
    expect(stored.sprite.cels[1]?.image).toBeUndefined();
    const loaded = deserializeProject(raw);
    const [a, b] = loaded.sprite.cels;
    expect(a?.image).toBe(b?.image);
    if (!a) return;
    setPixel(a.image, 1, 1, { r: 4, g: 5, b: 6, a: 255 });
    expect(b && getPixel(b.image, 1, 1)).toEqual({ r: 4, g: 5, b: 6, a: 255 });
  });

  it("opens a project saved before this release", () => {
    const raw = readFileSync(new URL("./fixtures/project-v1.json", import.meta.url), "utf8");
    const loaded = deserializeProject(raw);
    expect(loaded.sprite.width).toBe(2);
    expect(loaded.sprite.height).toBe(2);
    expect(loaded.sprite.colorMode).toBe("rgba");
    expect(loaded.sprite.name).toBe("Compat");
    expect(loaded.sprite.palette[0]).toEqual({ r: 255, g: 0, b: 128, a: 255 });
    expect(loaded.sprite.frames.map((frame) => frame.durationMs)).toEqual([120, 80]);
    expect(loaded.sprite.layers[0]?.name).toBe("Camada 1");
    expect(loaded.sprite.grid).toEqual({ width: 8, height: 12, x: 1, y: 2 });
    expect(loaded.sprite.cels).toHaveLength(2);
    const cel = loaded.sprite.cels[0];
    expect(cel && getPixel(cel.image, 1, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
    expect(loaded.foreground).toEqual({ r: 1, g: 2, b: 3, a: 255 });
    expect(loaded.background).toEqual({ r: 4, g: 5, b: 6, a: 255 });
  });

  it("rejects an unsupported version", () => {
    expect(() => deserializeProject('{"version":2}')).toThrow(/não suportada/);
  });
});
