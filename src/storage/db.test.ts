import "fake-indexeddb/auto";
import { openDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, createSprite } from "../domain/factory";
import { getPixel, setPixel } from "../domain/image-buffer";
import { findCel } from "../domain/sprite";
import type { LoadedProject } from "../io/project-json";
import { deleteProject, listProjects, loadProject, loadRecovery, resetDatabaseForTests, saveProject, saveRecovery } from "./db";

const red = { r: 255, g: 0, b: 0, a: 255 };

function project(name: string, paint = false): LoadedProject {
  const sprite = createSprite(2, 2, name);
  if (paint) {
    const cel = findCel(sprite, sprite.layers[0]!.id, sprite.frames[0]!.id);
    if (cel) setPixel(cel.image, 0, 0, red);
  }
  return { sprite, foreground: { ...DEFAULT_FOREGROUND }, background: { ...DEFAULT_BACKGROUND } };
}

afterEach(async () => {
  await resetDatabaseForTests();
});

describe("armazenamento", () => {
  it("grava e reabre o mesmo sprite", async () => {
    const saved = project("Persistido", true);
    await saveProject(saved);
    const loaded = await loadProject(saved.sprite.id);
    expect(loaded.sprite.name).toBe("Persistido");
    const cel = findCel(loaded.sprite, loaded.sprite.layers[0]!.id, loaded.sprite.frames[0]!.id);
    expect(cel && getPixel(cel.image, 0, 0)).toEqual(red);
    const listed = await listProjects();
    expect(listed.map((row) => row.id)).toEqual([saved.sprite.id]);
    await deleteProject(saved.sprite.id);
    await expect(loadProject(saved.sprite.id)).rejects.toThrow("Projeto não encontrado");
  });

  it("recupera várias abas e o índice ativo", async () => {
    const first = project("Um");
    const second = project("Dois", true);
    await saveRecovery([first, second], 1);
    const recovery = await loadRecovery();
    expect(recovery?.activeIndex).toBe(1);
    expect(recovery?.projects.map((item) => item.sprite.name)).toEqual(["Um", "Dois"]);
    const cel = findCel(recovery!.projects[1]!.sprite, recovery!.projects[1]!.sprite.layers[0]!.id, recovery!.projects[1]!.sprite.frames[0]!.id);
    expect(cel && getPixel(cel.image, 0, 0)).toEqual(red);
  });

  it("mantém projects ao subir o schema que adiciona recovery", async () => {
    await resetDatabaseForTests();
    const legacy = await openDB("pixeluz", 1, {
      upgrade(db) {
        db.createObjectStore("projects", { keyPath: "id" });
      },
    });
    const saved = project("Legado", true);
    const { serializeProject } = await import("../io/project-json");
    await legacy.put("projects", {
      id: saved.sprite.id,
      name: saved.sprite.name,
      updatedAt: 1,
      json: serializeProject(saved),
    });
    legacy.close();

    const loaded = await loadProject(saved.sprite.id);
    expect(loaded.sprite.name).toBe("Legado");
    await saveRecovery([loaded], 0);
    const recovery = await loadRecovery();
    expect(recovery?.projects[0]?.sprite.name).toBe("Legado");
  });
});
