import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type { UIMessage } from "@shared/chat";
import type { GroupChatGreeting, StoredGroupChat } from "@shared/schemas";

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
