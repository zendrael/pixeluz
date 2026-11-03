import { describe, expect, it } from "vitest";
import { EditorSession } from "../app/session";
import { BLACK } from "../domain/color";
import { createSprite } from "../domain/factory";
import { paintSettings } from "../tools/paint-settings";
import { palmBlocksTouch, pointerSamples } from "./pen";

describe("caneta", () => {
  it("ignora o toque enquanto a caneta está perto", () => {
    expect(palmBlocksTouch("touch", true, null, 1000)).toBe(true);
    expect(palmBlocksTouch("touch", false, 900, 1000)).toBe(true);
    expect(palmBlocksTouch("touch", false, 900, 3000)).toBe(false);
    expect(palmBlocksTouch("pen", true, 900, 1000)).toBe(false);
    expect(palmBlocksTouch("mouse", false, 900, 1000)).toBe(false);
  });

  it("mantém a opacidade do pincel quando a caneta informa pressão baixa", () => {
    const session = new EditorSession(createSprite(1, 1));
    expect(paintSettings(session, BLACK, 0, 0.5, "pen", false).opacity).toBe(255);
    expect(paintSettings(session, BLACK, 0, 0.05, "pen", false).opacity).toBe(255);
    session.brushOpacity = 128;
    expect(paintSettings(session, BLACK, 0, 0.05, "pen", false).opacity).toBe(128);
  });

  it("reduz o tamanho do pincel com pressão baixa e mantém com mouse", () => {
    const session = new EditorSession(createSprite(1, 1));
    session.brushSize = 10;
    expect(paintSettings(session, BLACK, 0, 0.5, "pen", false).brushSize).toBe(5);
    expect(paintSettings(session, BLACK, 0, 1, "pen", false).brushSize).toBe(10);
    expect(paintSettings(session, BLACK, 0, 0.5, "mouse", false).brushSize).toBe(10);
  });

  it("percorre cada amostra do traço e cai no evento atual se não houver nenhuma", () => {
    expect(pointerSamples([{ x: 1 }, { x: 4 }, { x: 9 }], { x: 9 })).toEqual([{ x: 1 }, { x: 4 }, { x: 9 }]);
    expect(pointerSamples([], { x: 2 })).toEqual([{ x: 2 }]);
  });
});
