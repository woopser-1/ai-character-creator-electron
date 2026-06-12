import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { nanoid } from "nanoid";
import type { UserPersona, UserPersonaInput } from "@shared/runtime-chat";
import { userPersonaSchema } from "@shared/runtime-chat";

function storagePath(): string {
	return join(app.getPath("userData"), "user-personas.json");
}

async function ensureDir(path: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true });
}

async function readAll(): Promise<UserPersona[]> {
	const path = storagePath();
	try {
		const raw = await fs.readFile(path, "utf-8");
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map((item) => userPersonaSchema.safeParse(item))
			.filter((item) => item.success)
			.map((item) => item.data);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

async function writeAll(personas: UserPersona[]): Promise<void> {
	const path = storagePath();
	const tmpPath = `${path}.tmp`;
	await ensureDir(path);
	await fs.writeFile(tmpPath, JSON.stringify(personas, null, 2), "utf-8");
	await fs.rename(tmpPath, path);
}

export async function listUserPersonas(): Promise<UserPersona[]> {
	const all = await readAll();
	return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveUserPersona(
	input: UserPersonaInput,
	id?: string,
): Promise<UserPersona> {
	const all = await readAll();
	const now = new Date().toISOString();
	const index = id ? all.findIndex((persona) => persona.id === id) : -1;
	const existing = index >= 0 ? all[index] : undefined;
	const persona: UserPersona = {
		id: existing?.id ?? nanoid(),
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
		name: input.name?.trim() || undefined,
		gender: input.gender ?? "unspecified",
		age: input.age,
		description: input.description?.trim() ?? "",
	};

	if (index >= 0) {
		all[index] = persona;
	} else {
		all.push(persona);
	}

	await writeAll(all);
	return persona;
}

export async function deleteUserPersona(id: string): Promise<void> {
	const all = await readAll();
	await writeAll(all.filter((persona) => persona.id !== id));
}
