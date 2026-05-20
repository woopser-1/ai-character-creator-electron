import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { Draft } from "@shared/drafts";

function storagePath(): string {
	return join(app.getPath("userData"), "drafts.json");
}

async function ensureDir(path: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true });
}

async function readAll(): Promise<Draft[]> {
	const path = storagePath();
	try {
		const raw = await fs.readFile(path, "utf-8");
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed as Draft[];
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

async function writeAll(drafts: Draft[]): Promise<void> {
	const path = storagePath();
	const tmpPath = `${path}.tmp`;
	await ensureDir(path);
	await fs.writeFile(tmpPath, JSON.stringify(drafts, null, 2), "utf-8");
	await fs.rename(tmpPath, path);
}

export async function listDrafts(): Promise<Draft[]> {
	const all = await readAll();
	return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDraft(id: string): Promise<Draft | null> {
	const all = await readAll();
	return all.find((d) => d.id === id) ?? null;
}

export async function getLatestDraft(): Promise<Draft | null> {
	const all = await listDrafts();
	return all[0] ?? null;
}

export async function saveDraft(draft: Draft): Promise<Draft> {
	const all = await readAll();
	const next: Draft = { ...draft, updatedAt: new Date().toISOString() };
	const idx = all.findIndex((d) => d.id === next.id);
	if (idx >= 0) all[idx] = next;
	else all.push(next);
	await writeAll(all);
	return next;
}

export async function deleteDraft(id: string): Promise<void> {
	const all = await readAll();
	const next = all.filter((d) => d.id !== id);
	if (next.length !== all.length) await writeAll(next);
}
