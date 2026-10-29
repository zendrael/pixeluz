import { describe, expect, it } from "vitest";
import { panelSnapTarget, rubberband, trackPanelSize } from "./motion";
import { optionGroupsFor } from "./option-groups";

describe("movimento dos painéis", () => {
  it("resiste depois do limite", () => {
    expect(trackPanelSize(500, 44, 480)).toBeGreaterThan(480);
    expect(trackPanelSize(500, 44, 480)).toBeLessThan(500);
    expect(trackPanelSize(300, 44, 480)).toBe(300);
  });

  it("recolhe quando o arraste passa do meio", () => {
    expect(panelSnapTarget(80, 0, 44, 220, 480).open).toBe(false);
    expect(panelSnapTarget(200, 0, 44, 220, 480)).toEqual({ open: true, size: 220 });
  });

  it("a resistência diminui quanto mais passa do limite", () => {
    const near = rubberband(40, 200);
    const far = rubberband(400, 200);
    expect(far).toBeGreaterThan(near);
    expect(far / 400).toBeLessThan(near / 40);
  });
});

describe("opções da ferramenta", () => {
  it("mostra só o que a ferramenta usa", () => {
    expect(optionGroupsFor("pencil", false)).toEqual(["size", "shape", "angle", "opacity", "symmetry", "ink", "perfect", "tile"]);
    expect(optionGroupsFor("eraser", false)).toEqual(["size", "shape", "angle", "opacity", "symmetry", "perfect", "tile"]);
    expect(optionGroupsFor("line", false)).not.toContain("perfect");
    expect(optionGroupsFor("gradient", false)).toEqual(["gradient", "bayer"]);
    expect(optionGroupsFor("select-wand", false)).toEqual(["tile", "select"]);
    expect(optionGroupsFor("bucket", false)).toEqual(["tile"]);
    expect(optionGroupsFor("move", false)).toEqual(["transform"]);
    expect(optionGroupsFor("pencil", true)).toContain("transform");
    expect(optionGroupsFor("hand", false)).toEqual([]);
  });
});
