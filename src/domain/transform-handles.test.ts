import { describe, expect, it } from "vitest";
import { hitTransformHandle, hitTransformHandleAt, transformHandlePoints } from "./transform-handles";

describe("hitTransformHandleAt", () => {
  it("hits corner and rotate grips in canvas space even at low zoom", () => {
    const bounds = { minX: 1, minY: 1, maxX: 2, maxY: 2 };
    const panX = 40;
    const panY = 40;
    const zoom = 4;
    const points = transformHandlePoints(bounds, panX, panY, zoom);
    const se = points.find((point) => point.id === "se");
    const rotate = points.find((point) => point.id === "rotate");
    if (!se || !rotate) throw new Error("handles missing");

    // Click on/near the drawn SE handle (outside the inner dead zone).
    expect(hitTransformHandleAt(bounds, se.x - 1, se.y - 1, panX, panY, zoom)).toBe("se");
    expect(hitTransformHandleAt(bounds, se.x + 4, se.y + 4, panX, panY, zoom)).toBe("se");
    expect(hitTransformHandleAt(bounds, rotate.x + 2, rotate.y - 1, panX, panY, zoom)).toBe("rotate");
    // Center of the selection box should not steal the handles.
    const midX = (points.find((point) => point.id === "nw")!.x + se.x) / 2;
    const midY = (points.find((point) => point.id === "nw")!.y + se.y) / 2;
    expect(hitTransformHandleAt(bounds, midX, midY, panX, panY, zoom)).toBeNull();
  });

  it("hits through the mask helper with canvas coordinates", () => {
    const mask = new Uint8Array(16);
    for (let y = 1; y <= 2; y += 1) for (let x = 1; x <= 2; x += 1) mask[y * 4 + x] = 1;
    // SE is at pan + (max+1)*zoom = 40 + 3*4 = 52
    expect(hitTransformHandle(mask, 4, 4, 52 + 3, 52 + 3, 40, 40, 4)).toBe("se");
    expect(hitTransformHandle(mask, 4, 4, 40 + 1 * 4 + 4, 40 + 1 * 4 - 18, 40, 40, 4)).toBe("rotate");
  });
});
