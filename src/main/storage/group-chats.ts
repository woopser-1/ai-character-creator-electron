import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { nanoid } from "nanoid";
import type { UIMessage } from "@shared/chat";
import type { PortableCharacter } from "@shared/character-port";
import type { PortableGroupChat } from "@shared/group-chat-port";
import type {
	GroupChatGreeting,
	StoredCharacter,
	StoredGroupChat,
} from "@shared/schemas";
import { importPortableCharacters } from "./characters";

function storagePath(): string {
	return join(app.getPath("userData"), "group-chats.json");
}

async function ensureDir(path: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true });
}

async function readAll(): Promise<StoredGroupChat[]> {
	const path = storagePath();
	try {
		const raw = await fs.readFile(path, "utf-8");
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed as StoredGroupChat[];
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

async function writeAll(groupChats: StoredGroupChat[]): Promise<void> {
	const path = storagePath();
	const tmpPath = `${path}.tmp`;
	await ensureDir(path);
	await fs.writeFile(tmpPath, JSON.stringify(groupChats, null, 2), "utf-8");
	await fs.rename(tmpPath, path);
}

export async function listGroupChats(): Promise<StoredGroupChat[]> {
	const all = await readAll();
	return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getGroupChat(
	id: string,
): Promise<StoredGroupChat | null> {
	const all = await readAll();
	return all.find((g) => g.id === id) ?? null;
}

export async function saveGroupChat(groupChat: StoredGroupChat): Promise<void> {
	const all = await readAll();
	const existingIndex = all.findIndex((g) => g.id === groupChat.id);
	if (existingIndex >= 0) {
		all[existingIndex] = groupChat;
	} else {
		all.push(groupChat);
	}
	await writeAll(all);
}

export async function deleteGroupChat(id: string): Promise<void> {
	const all = await readAll();
	const next = all.filter((g) => g.id !== id);
	await writeAll(next);
}

export async function updateGroupChatField(
	id: string,
	field: "title" | "publicDescription" | "scenario" | "privateDetails",
	value: string,
): Promise<StoredGroupChat> {
	const all = await readAll();
	const index = all.findIndex((g) => g.id === id);
	if (index < 0) {
		throw new Error(`Group chat ${id} not found`);
	}
	const existing = all[index];
	if (!existing) {
		throw new Error(`Group chat ${id} not found`);
	}
	const next: StoredGroupChat = {
		...existing,
		groupChat: { ...existing.groupChat, [field]: value },
	};
	all[index] = next;
	await writeAll(all);
	return next;
}

export async function updateGroupChatGreetingMessage(
	id: string,
	index: number,
	message: string,
): Promise<StoredGroupChat> {
	const all = await readAll();
	const idx = all.findIndex((g) => g.id === id);
	if (idx < 0) throw new Error(`Group chat ${id} not found`);
	const existing = all[idx];
	if (!existing) throw new Error(`Group chat ${id} not found`);
	const greetings = existing.groupChat.greetingMessages ?? [];
	if (index < 0 || index >= greetings.length) {
		throw new Error(`Greeting index ${index} out of range for group chat ${id}`);
	}
	const nextGreetings = greetings.map((g, i) =>
		i === index ? { ...g, message } : g,
	);
	const next: StoredGroupChat = {
		...existing,
		groupChat: { ...existing.groupChat, greetingMessages: nextGreetings },
	};
	all[idx] = next;
	await writeAll(all);
	return next;
}

export async function appendGroupChatGreeting(
	id: string,
	greeting: GroupChatGreeting,
): Promise<StoredGroupChat> {
	const all = await readAll();
	const idx = all.findIndex((g) => g.id === id);
	if (idx < 0) throw new Error(`Group chat ${id} not found`);
	const existing = all[idx];
	if (!existing) throw new Error(`Group chat ${id} not found`);
	const greetings = existing.groupChat.greetingMessages ?? [];
	const next: StoredGroupChat = {
		...existing,
		groupChat: {
			...existing.groupChat,
			greetingMessages: [...greetings, greeting],
		},
	};
	all[idx] = next;
	await writeAll(all);
	return next;
}

export async function deleteGroupChatGreeting(
	id: string,
	index: number,
): Promise<StoredGroupChat> {
	const all = await readAll();
	const idx = all.findIndex((g) => g.id === id);
	if (idx < 0) throw new Error(`Group chat ${id} not found`);
	const existing = all[idx];
	if (!existing) throw new Error(`Group chat ${id} not found`);
	const greetings = existing.groupChat.greetingMessages ?? [];
	if (index < 0 || index >= greetings.length) {
		throw new Error(`Greeting index ${index} out of range for group chat ${id}`);
	}
	const nextGreetings = greetings.filter((_, i) => i !== index);
	const next: StoredGroupChat = {
		...existing,
		groupChat: { ...existing.groupChat, greetingMessages: nextGreetings },
	};
	all[idx] = next;
	await writeAll(all);
	return next;
}

export async function updateGroupChatGatheringMessages(
	id: string,
	gatheringMessages: UIMessage[],
): Promise<StoredGroupChat | null> {
	const all = await readAll();
	const index = all.findIndex((g) => g.id === id);
	if (index < 0) return null;
	const existing = all[index];
	if (!existing) return null;
	const next: StoredGroupChat = { ...existing, gatheringMessages };
	all[index] = next;
	await writeAll(all);
	return next;
}

/**
 * Convert a stored group chat to its portable form, embedding the full
 * portable character snapshots in `characters` in the same order as
 * `characterIds`. Missing cast members are skipped — caller should pre-filter.
 */
export function toPortableGroupChat(
	stored: StoredGroupChat,
	characters: PortableCharacter[],
): PortableGroupChat {
	return {
		groupChat: stored.groupChat,
		messageLength: stored.messageLength,
		gatheringSummary: stored.gatheringSummary,
		characters,
		origin: { id: stored.id, createdAt: stored.createdAt },
	};
}

/**
 * Import portable group chats. For each, first mints fresh character IDs for
 * the embedded cast (via importPortableCharacters), then mints a fresh group
 * chat ID/createdAt pointing at those new character IDs. Returns the freshly
 * stored group chats in the same order.
 */
export async function importPortableGroupChats(
	portables: PortableGroupChat[],
): Promise<StoredGroupChat[]> {
	const all = await readAll();
	const now = Date.now();
	const imported: StoredGroupChat[] = [];

	for (let i = 0; i < portables.length; i++) {
		const p = portables[i];
		if (!p) continue;
		// Mint new character IDs for this group chat's embedded cast. Each call
		// gets its own freshly minted IDs; group chats with overlapping casts
		// will end up with duplicate characters rather than sharing — matches the
		// single-character import policy (always mint new, never dedupe).
		const newCharacters: StoredCharacter[] = await importPortableCharacters(
			p.characters,
		);
		const newGroupChat: StoredGroupChat = {
			id: nanoid(),
			// Stagger by 1ms per import so the gallery sort stays stable and
			// matches the bundle order.
			createdAt: new Date(now - i).toISOString(),
			groupChat: p.groupChat,
			characterIds: newCharacters.map((c) => c.id),
			messageLength: p.messageLength,
			gatheringSummary: p.gatheringSummary,
		};
		imported.push(newGroupChat);
	}

	await writeAll([...all, ...imported]);
	return imported;
}
