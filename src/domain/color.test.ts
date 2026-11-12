import { describe, expect, it } from "vitest";
import { hsvToRgb, rgbToHsv } from "./color";

describe("hsv", () => {
  it("round-trips primary colors", () => {
    expect(rgbToHsv(255, 0, 0).map((value) => Math.round(value))).toEqual([0, 100, 100]);
    expect(hsvToRgb(0, 100, 100)).toEqual([255, 0, 0]);
    expect(hsvToRgb(120, 100, 100)).toEqual([0, 255, 0]);
    expect(hsvToRgb(240, 100, 100)).toEqual([0, 0, 255]);
  });
});
