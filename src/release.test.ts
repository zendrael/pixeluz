import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paletteCredit } from "./ui/panels";

const root = new URL("../", import.meta.url);

describe("arquivos da 1.0", () => {
  it("publica a licença MIT e a versão 1.0.0", () => {
    const license = readFileSync(new URL("LICENSE", root), "utf8");
    const version = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as { version: string };
    expect(license).toContain("Permission is hereby granted");
    expect(license).toContain("Pixeluz contributors");
    expect(version.version).toBe("1.0.0");
  });

  it("atribui Sweetie 16, DB32 e Endesga sem inventar a licença da Sweetie 16", () => {
    const notice = readFileSync(new URL("NOTICE", root), "utf8");
    const sweetie = notice.slice(notice.indexOf("Sweetie 16"), notice.indexOf("DB32"));
    expect(sweetie).toContain("GrafxKid");
    expect(sweetie).not.toMatch(/CC0|CC-BY|domínio público/i);
    expect(notice).toContain("DawnBringer");
    expect(notice).toContain("Domínio público");
    expect(notice).toContain("Endesga");
    expect(notice).toContain("CC0");
    expect(paletteCredit("sweetie16")).toContain("GrafxKid");
    expect(paletteCredit("db32")).toContain("DawnBringer");
    expect(paletteCredit("endesga32")).toContain("Endesga");
  });

  it("descreve a paleta inicial, o Lospec e a grade no README", () => {
    const readme = readFileSync(new URL("README.md", root), "utf8");
    expect(readme).toContain("Sweetie 16");
    expect(readme).toContain("GrafxKid");
    expect(readme).toContain("Lospec");
    expect(readme).toContain(".hex");
    expect(readme).toContain("Configurações");
    expect(readme).toMatch(/inicial[\s\S]{0,80}Sweetie 16|Sweetie 16[\s\S]{0,40}inicial/);
    expect(readme).not.toMatch(/Paletas DB32 \(DawnBringer, domínio público\) e Endesga 32/);
  });

  it("diz que o composite aplica os blend modes", () => {
    const roadmap = readFileSync(new URL("ROADMAP.md", root), "utf8");
    expect(roadmap).toContain("são aplicados no composite");
    expect(roadmap).not.toContain("o composite hoje só aplica `normal`");
  });
});
