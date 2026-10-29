import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { deserializeProject, serializeProject, type LoadedProject } from "../io/project-json";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

interface ProjectRow {
  id: string;
  name: string;
  updatedAt: number;
  json: string;
}

interface RecoveryRow {
  updatedAt: number;
  activeIndex: number;
  projects: string[];
}

interface PixeluzDb extends DBSchema {
  projects: {
    key: string;
    value: ProjectRow;
  };
  recovery: {
    key: string;
    value: RecoveryRow;
  };
}

let databasePromise: Promise<IDBPDatabase<PixeluzDb>> | null = null;

function database(): Promise<IDBPDatabase<PixeluzDb>> {
  if (!databasePromise) {
    databasePromise = openDB<PixeluzDb>("pixeluz", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("recovery")) db.createObjectStore("recovery");
      },
    }).catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function saveProject(project: LoadedProject): Promise<void> {
  const db = await database();
  await db.put("projects", {
    id: project.sprite.id,
    name: project.sprite.name,
    updatedAt: Date.now(),
    json: serializeProject(project),
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await database();
  const rows = await db.getAll("projects");
  return rows
    .map((row) => ({ id: row.id, name: row.name, updatedAt: row.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<LoadedProject> {
  const db = await database();
  const row = await db.get("projects", id);
  if (!row) throw new Error("Projeto não encontrado");
  return deserializeProject(row.json);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await database();
  await db.delete("projects", id);
}

export async function saveRecovery(projects: LoadedProject[], activeIndex: number): Promise<void> {
  const db = await database();
  const row: RecoveryRow = {
    updatedAt: Date.now(),
    activeIndex,
    projects: projects.map((project) => serializeProject(project)),
  };
  await db.put("recovery", row, "workspace");
}

export async function loadRecovery(): Promise<{ projects: LoadedProject[]; activeIndex: number } | null> {
  const db = await database();
  const row = await db.get("recovery", "workspace");
  if (!row || row.projects.length === 0) return null;
  return {
    activeIndex: Math.max(0, Math.min(row.activeIndex, row.projects.length - 1)),
    projects: row.projects.map((json) => deserializeProject(json)),
  };
}
