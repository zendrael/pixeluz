import { describe, expect, it } from "vitest";
import { consumeWheelPinch, zoomFromPinch } from "./zoom-gesture";

describe("zoom por gesto", () => {
  it("sobe um nível a cada 64 px de pinça", () => {
    expect(Math.round(zoomFromPinch(8, 100, 163))).toBe(9);
    expect(Math.round(zoomFromPinch(8, 100, 120))).toBe(8);
    expect(Math.round(zoomFromPinch(16, 200, 70))).toBe(14);
  });

  it("acumula a pinça do trackpad antes de mudar o zoom", () => {
    const first = consumeWheelPinch(0, -30);
    expect(first.levels).toBe(0);
    const second = consumeWheelPinch(first.rest, -30);
    expect(second.levels).toBe(-1);
    expect(second.rest).toBe(-12);
  });

  it("guarda o gesto que passa do zoom máximo", () => {
    const blocked = consumeWheelPinch(0, -48, 64, 0);
    expect(blocked.levels).toBe(0);
    expect(blocked.slack).toBe(-48);
    const unwind = consumeWheelPinch(blocked.rest, 48, 64, blocked.slack);
    expect(unwind.levels).toBe(0);
    expect(unwind.slack).toBe(0);
  });
});
