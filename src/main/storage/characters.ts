import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { nanoid } from "nanoid";
import type { PortableCharacter } from "@shared/character-port";
import type { StoredCharacter } from "@shared/schemas";

function storagePath(): string {
  return join(app.getPath("userData"), "characters.json");
}

async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
}

async function readAll(): Promise<StoredCharacter[]> {
  const path = storagePath();
  try {
    const raw = await fs.readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as StoredCharacter[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeAll(characters: StoredCharacter[]): Promise<void> {
  const path = storagePath();
  const tmpPath = `${path}.tmp`;
  await ensureDir(path);
  await fs.writeFile(tmpPath, JSON.stringify(characters, null, 2), "utf-8");
  await fs.rename(tmpPath, path);
}

export async function listCharacters(): Promise<StoredCharacter[]> {
  const all = await readAll();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCharacter(id: string): Promise<StoredCharacter | null> {
  const all = await readAll();
  return all.find((c) => c.id === id) ?? null;
}

export async function saveCharacter(character: StoredCharacter): Promise<void> {
  const all = await readAll();
  const existingIndex = all.findIndex((c) => c.id === character.id);
  if (existingIndex >= 0) {
    all[existingIndex] = character;
  } else {
    all.push(character);
  }
  await writeAll(all);
}

export async function deleteCharacter(id: string): Promise<void> {
  const all = await readAll();
  const next = all.filter((c) => c.id !== id);
  await writeAll(next);
}

export async function updateCharacterScenes(
  id: string,
  scenes: StoredCharacter["scenes"]
): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) {
    throw new Error(`Character ${id} not found`);
  }
  const existing = all[index];
  if (!existing) {
    throw new Error(`Character ${id} not found`);
  }
  all[index] = { ...existing, scenes };
  await writeAll(all);
}

export async function appendSceneToCharacter(
  id: string,
  scene: StoredCharacter["scenes"][number]
): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) {
    throw new Error(`Character ${id} not found`);
  }
  const existing = all[index];
  if (!existing) {
    throw new Error(`Character ${id} not found`);
  }
  all[index] = { ...existing, scenes: [...existing.scenes, scene] };
  await writeAll(all);
}

export async function replaceSceneInCharacter(
  id: string,
  sceneIndex: number,
  scene: StoredCharacter["scenes"][number]
): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) {
    throw new Error(`Character ${id} not found`);
  }
  const existing = all[index];
  if (!existing) {
    throw new Error(`Character ${id} not found`);
  }
  if (sceneIndex < 0 || sceneIndex >= existing.scenes.length) {
    throw new Error(`Scene index ${sceneIndex} out of range for character ${id}`);
  }
  const nextScenes = [...existing.scenes];
  nextScenes[sceneIndex] = scene;
  all[index] = { ...existing, scenes: nextScenes };
  await writeAll(all);
}

export function toPortableCharacter(stored: StoredCharacter): PortableCharacter {
  return {
    character: stored.character,
    scenes: stored.scenes,
    difficulty: stored.difficulty,
    messageLength: stored.messageLength,
    imageModel: stored.imageModel,
    ourdreamUrl: stored.ourdreamUrl,
    profileImageUrl: stored.profileImageUrl,
    gatheringSummary: stored.gatheringSummary,
    confirmedProfile: stored.confirmedProfile,
    origin: { id: stored.id, createdAt: stored.createdAt },
  };
}

export async function importPortableCharacters(
  portables: PortableCharacter[]
): Promise<StoredCharacter[]> {
  const all = await readAll();
  const now = Date.now();
  const imported: StoredCharacter[] = portables.map((p, i) => ({
    // Stagger createdAt by 1ms per character so the gallery sort stays stable
    // and matches the bundle order.
    id: nanoid(),
    createdAt: new Date(now - i).toISOString(),
    character: p.character,
    scenes: p.scenes ?? [],
    difficulty: p.difficulty,
    messageLength: p.messageLength,
    imageModel: p.imageModel,
    ourdreamUrl: p.ourdreamUrl,
    profileImageUrl: p.profileImageUrl,
    gatheringSummary: p.gatheringSummary,
    confirmedProfile: p.confirmedProfile,
  }));
  await writeAll([...all, ...imported]);
  return imported;
}

export async function updateCharacter(
  id: string,
  patch: Partial<Omit<StoredCharacter, "id" | "createdAt">>
): Promise<StoredCharacter> {
  const all = await readAll();
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) {
    throw new Error(`Character ${id} not found`);
  }
  const existing = all[index];
  if (!existing) {
    throw new Error(`Character ${id} not found`);
  }
  const next: StoredCharacter = { ...existing, ...patch };
  all[index] = next;
  await writeAll(all);
  return next;
}
