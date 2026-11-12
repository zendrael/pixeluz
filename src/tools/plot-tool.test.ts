import { describe, expect, it } from "vitest";
import { EditorSession } from "../app/session";
import { createSprite } from "../domain/factory";
import { getPixel } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import { PlotTool } from "./plot-tool";
import { SelectTool } from "./select-tool";
import type { ToolContext } from "./tool";

function ctx(session: EditorSession, x: number, y: number, clicks = 1): ToolContext {
  return {
    session,
    spriteX: x,
    spriteY: y,
    canvasX: x,
    canvasY: y,
    button: 0,
    shift: false,
    alt: false,
    pressure: 1,
    pointerType: "mouse",
    clicks,
  };
}

describe("plot and polygon tools", () => {
  it("undoStep removes the last polygon vertex before commit", () => {
    const session = new EditorSession(createSprite(8, 8));
    const tool = new PlotTool("polygon", "polygon");
    tool.onDown(ctx(session, 1, 1));
    tool.onUp(ctx(session, 1, 1));
    tool.onDown(ctx(session, 6, 1));
    tool.onUp(ctx(session, 6, 1));
    tool.onDown(ctx(session, 6, 6));
    tool.onUp(ctx(session, 6, 6));

    expect(tool.undoStep?.()).toBe(true);
    expect(tool.undoStep?.()).toBe(true);
    expect(tool.undoStep?.()).toBe(true);
    expect(tool.undoStep?.()).toBe(false);
    expect(session.canUndo).toBe(false);
  });

  it("still undoes a committed polygon through history", () => {
    const session = new EditorSession(createSprite(8, 8));
    const tool = new PlotTool("polygon", "polygon");
    tool.onDown(ctx(session, 1, 1));
    tool.onUp(ctx(session, 1, 1));
    tool.onDown(ctx(session, 6, 1));
    tool.onUp(ctx(session, 6, 1));
    tool.onDown(ctx(session, 6, 6, 2));

    const cel = findCel(session.doc, session.activeLayerId, session.activeFrameId);
    if (!cel) throw new Error("cel ausente");
    const image = cel.image;
    expect(getPixel(image, 1, 1)?.a ?? 0).toBeGreaterThan(0);
    expect(tool.undoStep?.()).toBe(false);
    session.undo();
    expect(getPixel(image, 1, 1)?.a ?? 0).toBe(0);
  });

  it("undoStep removes the last select-polygon vertex", () => {
    const session = new EditorSession(createSprite(8, 8));
    const tool = new SelectTool("select-polygon", "polygon");
    tool.onDown(ctx(session, 1, 1));
    tool.onDown(ctx(session, 6, 1));
    tool.onDown(ctx(session, 6, 6));
    expect(tool.undoStep?.()).toBe(true);
    expect(tool.undoStep?.()).toBe(true);
    expect(tool.undoStep?.()).toBe(true);
    expect(tool.undoStep?.()).toBe(false);
    expect(session.selection).toBeNull();
  });
});
