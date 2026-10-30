import { describe, expect, it } from "vitest";
import { EditorSession } from "../app/session";
import { PALETTE_PRESETS } from "../domain/palettes";
import { createSprite } from "../domain/factory";
import { getPixel, setPixel } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import { bindingOwner, defaultBindings, shortcutForChord } from "./shortcuts";

describe("atalhos", () => {
  it("mantém o lápis em B e aceita o alias da elipse", () => {
    const bindings = defaultBindings();
    expect(shortcutForChord("b", bindings)).toEqual({ type: "tool", tool: "pencil" });
    expect(shortcutForChord("shift+u", bindings)).toEqual({ type: "tool", tool: "ellipse" });
    expect(shortcutForChord("mod+z", bindings)).toEqual({ type: "undo" });
    expect(shortcutForChord("mod+c", bindings)).toEqual({ type: "copy" });
    expect(shortcutForChord("mod+v", bindings)).toEqual({ type: "paste" });
  });

  it("recusa um atalho que já pertence a outra ação", () => {
    const bindings = defaultBindings();
    expect(bindingOwner(bindings, "e", "pencil")).toBe("eraser");
    const custom = { ...bindings, pencil: "x" };
    expect(shortcutForChord("x", custom)).toEqual({ type: "tool", tool: "pencil" });
    expect(shortcutForChord("b", custom)).toBeNull();
  });
});

describe("paletas prontas", () => {
  it("substitui a paleta e desfaz, inclusive no modo indexado", () => {
    const session = new EditorSession(createSprite(2, 1));
    const before = session.doc.palette.length;
    const db32 = PALETTE_PRESETS.find((preset) => preset.id === "db32");
    if (!db32) throw new Error("DB32 ausente");
    session.loadPalette(db32.colors);
    expect(session.doc.palette).toHaveLength(32);
    session.undo();
    expect(session.doc.palette).toHaveLength(before);

    session.setColorMode("indexed");
    const indexed = session.doc.palette.length;
    const cel = findCel(session.doc, session.activeLayerId, session.activeFrameId);
    if (!cel) throw new Error("cel ausente");
    const red = { r: 255, g: 0, b: 0, a: 255 };
    setPixel(cel.image, 0, 0, red);
    session.loadPalette(db32.colors);
    expect(getPixel(cel.image, 0, 0)).not.toEqual(red);
    session.undo();
    expect(getPixel(cel.image, 0, 0)).toEqual(red);
    expect(session.doc.palette).toHaveLength(indexed);
  });
});
