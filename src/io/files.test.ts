import { describe, expect, it } from "vitest";
import { fileInputAccept, PALETTE_FILE_TYPES } from "./files";

describe("aceitação de arquivo de paleta", () => {
  it("inclui octet-stream para .hex baixado no Android", () => {
    const accept = fileInputAccept(PALETTE_FILE_TYPES);
    expect(accept).toContain(".hex");
    expect(accept).toContain("application/octet-stream");
    expect(accept).toContain("text/plain");
    expect(accept).toContain("application/json");
  });

  it("lista cada MIME e extensão uma vez", () => {
    expect(
      fileInputAccept([
        {
          description: "Exemplo",
          accept: { "text/plain": [".hex", ".txt"], "application/octet-stream": [".hex"] },
        },
      ]),
    ).toBe("text/plain,.hex,.txt,application/octet-stream");
  });
});
