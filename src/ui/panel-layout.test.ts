import { describe, expect, it } from "vitest";
import { previewPixels } from "./panels";
import { clampPanelLayout, defaultPanelLayout, timelineLimit } from "./panel-layout";

describe("painéis", () => {
  it("limita largura e altura", () => {
    const layout = clampPanelLayout({ ...defaultPanelLayout(), sideWidth: 20, timelineHeight: 900 });
    expect(layout.sideWidth).toBe(220);
    expect(layout.timelineHeight).toBe(640);
    expect(timelineLimit(2000)).toBe(640);
    expect(timelineLimit(800)).toBe(520);
    expect(timelineLimit(360)).toBe(112);
  });

  it("mantém a proporção da prévia", () => {
    const wide = previewPixels(48, 16, 270, 144);
    expect(wide.width / wide.height).toBeCloseTo(3, 1);
    const square = previewPixels(32, 32, 270, 144);
    expect(square.width).toBe(square.height);
  });
});