import { describe, expect, it } from "vitest";
import { fetchLospecPalette, lospecSlug, paletteToHex, parsePaletteFile } from "./palette-exchange";

const ENDESGA = `{"name":"Endesga 32","author":"ENDESGA","colors":["be4a2f","d77643","ffffff"]}`;

describe("paleta do Lospec", () => {
  it("reconhece o link, o arquivo e o nome da paleta", () => {
    expect(lospecSlug("https://lospec.com/palette-list/endesga-32")).toBe("endesga-32");
    expect(lospecSlug("https://lospec.com/palette-list/endesga-32.hex")).toBe("endesga-32");
    expect(lospecSlug("ENDESGA-32")).toBe("endesga-32");
    expect(lospecSlug("https://example.com/endesga-32")).toBeNull();
  });

  it("lê o JSON, o hex e o GPL que o Lospec oferece", () => {
    expect(parsePaletteFile(ENDESGA)).toEqual({
      name: "Endesga 32",
      author: "ENDESGA",
      colors: [
        { r: 190, g: 74, b: 47, a: 255 },
        { r: 215, g: 118, b: 67, a: 255 },
        { r: 255, g: 255, b: 255, a: 255 },
      ],
    });
    expect(parsePaletteFile("# comentario\nbe4a2f\n#11223380\n")).toEqual({
      name: "",
      author: "",
      colors: [
        { r: 190, g: 74, b: 47, a: 255 },
        { r: 17, g: 34, b: 51, a: 128 },
      ],
    });
    expect(parsePaletteFile("GIMP Palette\n#Palette Name: Dawn\n190 74 47 be4a2f\n")).toMatchObject({
      name: "Dawn",
      colors: [{ r: 190, g: 74, b: 47, a: 255 }],
    });
    expect(parsePaletteFile("não é paleta")).toBeNull();
  });

  it("exporta hex e reabre a mesma paleta", () => {
    const colors = [
      { r: 190, g: 74, b: 47, a: 255 },
      { r: 17, g: 34, b: 51, a: 128 },
    ];
    const parsed = parsePaletteFile(paletteToHex(colors));
    expect(parsed?.colors).toEqual(colors);
  });

  it("baixa o JSON publicado pelo Lospec", async () => {
    const fetchImpl = async () => new Response(ENDESGA, { status: 200 });
    await expect(fetchLospecPalette("endesga-32", fetchImpl)).resolves.toMatchObject({ name: "Endesga 32" });
    const missing = async () => new Response("{}", { status: 404 });
    await expect(fetchLospecPalette("ausente", missing)).rejects.toThrow("not-found");
  });
});
