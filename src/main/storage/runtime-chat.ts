import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import type {
	RuntimeChatMessage,
	RuntimeChatState,
	RuntimeChatUserProfile,
	StoredChatConversation,
} from "@shared/runtime-chat";
import { storedChatConversationSchema } from "@shared/runtime-chat";

function storagePath(): string {
	return join(app.getPath("userData"), "chat-conversations.json");
}

async function ensureDir(path: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true });
}

async function readAll(): Promise<StoredChatConversation[]> {
	const path = storagePath();
	try {
		const raw = await fs.readFile(path, "utf-8");
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map((item) => storedChatConversationSchema.safeParse(item))
			.filter((item) => item.success)
			.map((item) => item.data);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

async function writeAll(conversations: StoredChatConversation[]): Promise<void> {
	const path = storagePath();
	const tmpPath = `${path}.tmp`;
	await ensureDir(path);
	await fs.writeFile(tmpPath, JSON.stringify(conversations, null, 2), "utf-8");
	await fs.rename(tmpPath, path);
}

export async function listRuntimeChatConversations(): Promise<
	StoredChatConversation[]
> {
	const all = await readAll();
	return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRuntimeChatConversation(
	id: string,
): Promise<StoredChatConversation | null> {
	const all = await readAll();
	return all.find((conversation) => conversation.id === id) ?? null;
}

export async function saveRuntimeChatConversation(
	conversation: StoredChatConversation,
): Promise<StoredChatConversation> {
	const all = await readAll();
	const index = all.findIndex((item) => item.id === conversation.id);
	const next = { ...conversation, updatedAt: new Date().toISOString() };

	if (index >= 0) {
		all[index] = next;
	} else {
		all.push(next);
	}

	await writeAll(all);
	return next;
}

export async function deleteRuntimeChatConversation(
	id: string,
): Promise<void> {
	const all = await readAll();
	await writeAll(all.filter((conversation) => conversation.id !== id));
}

export async function updateRuntimeChatUserProfile(
	id: string,
	userProfile: RuntimeChatUserProfile,
): Promise<StoredChatConversation> {
	const conversation = await getRuntimeChatConversation(id);
	if (!conversation) throw new Error(`Chat conversation ${id} not found`);

	return saveRuntimeChatConversation({ ...conversation, userProfile });
}

export async function updateRuntimeChatState(
	id: string,
	currentState: RuntimeChatState,
): Promise<StoredChatConversation> {
	const conversation = await getRuntimeChatConversation(id);
	if (!conversation) throw new Error(`Chat conversation ${id} not found`);

	return saveRuntimeChatConversation({ ...conversation, currentState });
}

export async function replaceRuntimeChatMessages(
	id: string,
	messages: RuntimeChatMessage[],
	currentState?: RuntimeChatState,
): Promise<StoredChatConversation> {
	const conversation = await getRuntimeChatConversation(id);
	if (!conversation) throw new Error(`Chat conversation ${id} not found`);

	return saveRuntimeChatConversation({
		...conversation,
		messages,
		currentState: currentState ?? conversation.currentState,
	});
}
