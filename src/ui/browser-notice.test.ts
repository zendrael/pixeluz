import { describe, expect, it } from "vitest";
import { spriteStaysInBrowser } from "./browser-notice";

describe("aviso de cópia no navegador", () => {
  it("permanece visível até o projeto atual ser baixado", () => {
    expect(spriteStaysInBrowser(false, false)).toBe(true);
    expect(spriteStaysInBrowser(false, true)).toBe(true);
    expect(spriteStaysInBrowser(true, false)).toBe(false);
    expect(spriteStaysInBrowser(true, true)).toBe(true);
  });
});
