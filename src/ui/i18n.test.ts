import { describe, expect, it } from "vitest";
import { preferredLocale } from "./i18n";

describe("preferred locale", () => {
  it("keeps a saved choice", () => {
    expect(preferredLocale("es", ["pt-BR"])).toBe("es");
    expect(preferredLocale("en", ["pt-BR", "es"])).toBe("en");
    expect(preferredLocale("pt-BR", ["en-US"])).toBe("pt-BR");
  });

  it("follows portuguese and spanish from the browser", () => {
    expect(preferredLocale(null, ["pt-BR", "en"])).toBe("pt-BR");
    expect(preferredLocale(null, ["pt-PT"])).toBe("pt-BR");
    expect(preferredLocale(null, ["es-MX", "en"])).toBe("es");
  });

  it("uses english for every other browser language", () => {
    expect(preferredLocale(null, ["en-US"])).toBe("en");
    expect(preferredLocale(null, ["fr-FR", "de"])).toBe("en");
    expect(preferredLocale(null, [])).toBe("en");
    expect(preferredLocale("nope", ["ja"])).toBe("en");
  });
});
