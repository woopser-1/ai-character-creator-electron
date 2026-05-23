import { promises as fs } from "node:fs";
import { basename } from "node:path";
import { dialog, ipcMain } from "electron";
import { nanoid } from "nanoid";
import type { PortableCharacter } from "@shared/character-port";
import type { UIMessage } from "@shared/chat";
import type { GenerateGroupChatResponse } from "@shared/generate";
import {
	anyGroupChatPortFileSchema,
	GROUP_CHAT_BUNDLE_KIND,
	GROUP_CHAT_PORT_KIND,
	GROUP_CHAT_PORT_VERSION,
	type GroupChatImportResponse,
	type PortableGroupChat,
} from "@shared/group-chat-port";
import type {
	ExportResponse,
	ImportFileOutcome,
} from "@shared/port-shared";
import type { GroupChatResult } from "@shared/result";
import type {
	Character,
	GroupChat,
	MessageLength,
	StoredGroupChat,
} from "@shared/schemas";
import {
	generateGroupChat,
	generateSingleGroupChatGreeting,
} from "../agent/generate-group-chat";
import {
	listCharacters,
	toPortableCharacter,
} from "../storage/characters";
import {
	appendGroupChatGreeting,
	deleteGroupChat,
	deleteGroupChatGreeting,
	getGroupChat,
	importPortableGroupChats,
	listGroupChats,
	saveGroupChat,
	toPortableGroupChat,
	updateGroupChatField,
	updateGroupChatGatheringMessages,
	updateGroupChatGreetingMessage,
} from "../storage/group-chats";
import { getSettings } from "../storage/settings";
import { APP_TAG, groupChatFilename, type IpcCtx } from "./helpers";

async function readGroupChatPortablesFromPaths(paths: string[]): Promise<{
	portables: PortableGroupChat[];
	fileOutcomes: ImportFileOutcome[];
}> {
	const portables: PortableGroupChat[] = [];
	const fileOutcomes: ImportFileOutcome[] = [];

	for (const filePath of paths) {
		const fileName = basename(filePath);
		try {
			const raw = await fs.readFile(filePath, "utf-8");
			const json = JSON.parse(raw);
			const parsed = anyGroupChatPortFileSchema.safeParse(json);
			if (!parsed.success) {
				fileOutcomes.push({
					fileName,
					ok: false,
					error: parsed.error.issues[0]?.message ?? "Invalid group chat file",
				});
				continue;
			}
			const fileGroupChats =
				parsed.data.kind === GROUP_CHAT_PORT_KIND
					? [parsed.data.groupChat]
					: parsed.data.groupChats;
			portables.push(...fileGroupChats);
			fileOutcomes.push({
				fileName,
				ok: true,
				count: fileGroupChats.length,
			});
		} catch (error) {
			fileOutcomes.push({
				fileName,
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { portables, fileOutcomes };
}

async function runGroupChatImport(
	paths: string[],
): Promise<GroupChatImportResponse> {
	const { portables, fileOutcomes } =
		await readGroupChatPortablesFromPaths(paths);

	if (portables.length === 0) {
		return {
			success: false,
			error:
				fileOutcomes.find((o) => !o.ok)?.error ??
				"No group chats found in the selected files",
			fileOutcomes,
		};
	}

	const imported = await importPortableGroupChats(portables);
	return { success: true, imported, fileOutcomes };
}

export function registerGroupChatsIpc({ window, emitProgress }: IpcCtx): void {
	ipcMain.handle("group-chats:list", async () => {
		return listGroupChats();
	});

	ipcMain.handle("group-chats:get", async (_event, id: string) => {
		return getGroupChat(id);
	});

	ipcMain.handle("group-chats:delete", async (_event, id: string) => {
		await deleteGroupChat(id);
	});

	ipcMain.handle(
		"group-chats:export",
		async (
			_event,
			payload: { ids: string[] },
		): Promise<ExportResponse> => {
			if (!payload.ids || payload.ids.length === 0) {
				return { success: false, error: "No group chats selected for export" };
			}

			const [allGroupChats, allCharacters] = await Promise.all([
				listGroupChats(),
				listCharacters(),
			]);
			const gcById = new Map(allGroupChats.map((g) => [g.id, g]));
			const charById = new Map(allCharacters.map((c) => [c.id, c]));

			const selected = payload.ids
				.map((id) => gcById.get(id))
				.filter((g): g is NonNullable<typeof g> => Boolean(g));

			if (selected.length === 0) {
				return { success: false, error: "Selected group chats not found" };
			}

			// Build portable group chats with embedded cast snapshots. If any cast
			// character is missing locally, bail with a precise error.
			const portables: PortableGroupChat[] = [];
			for (const gc of selected) {
				const castPortables: PortableCharacter[] = [];
				for (const cid of gc.characterIds) {
					const c = charById.get(cid);
					if (!c) {
						return {
							success: false,
							error: `Group chat "${gc.groupChat.title}" references a missing character (${cid}). Restore the character before exporting.`,
						};
					}
					castPortables.push(toPortableCharacter(c));
				}
				portables.push(toPortableGroupChat(gc, castPortables));
			}

			const isSingle = portables.length === 1;
			const stamp = new Date().toISOString().slice(0, 10);
			const defaultName =
				isSingle && portables[0]
					? groupChatFilename(portables[0])
					: `group-chats-${stamp}.bundle.json`;

			const result = await dialog.showSaveDialog(window, {
				title: isSingle
					? "Export group chat"
					: `Export ${portables.length} group chats`,
				defaultPath: defaultName,
				filters: [{ name: "Group Chat JSON", extensions: ["json"] }],
			});

			if (result.canceled || !result.filePath) {
				return { success: false, canceled: true };
			}

			const exportedAt = new Date().toISOString();
			const file =
				isSingle && portables[0]
					? {
							kind: GROUP_CHAT_PORT_KIND,
							version: GROUP_CHAT_PORT_VERSION,
							exportedAt,
							app: APP_TAG,
							groupChat: portables[0],
						}
					: {
							kind: GROUP_CHAT_BUNDLE_KIND,
							version: GROUP_CHAT_PORT_VERSION,
							exportedAt,
							app: APP_TAG,
							groupChats: portables,
						};

			try {
				await fs.writeFile(
					result.filePath,
					`${JSON.stringify(file, null, 2)}\n`,
					"utf-8",
				);
				return {
					success: true,
					path: result.filePath,
					count: portables.length,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"group-chats:import",
		async (): Promise<GroupChatImportResponse> => {
			const result = await dialog.showOpenDialog(window, {
				title: "Import group chats",
				properties: ["openFile", "multiSelections"],
				filters: [
					{ name: "Group Chat JSON", extensions: ["json"] },
					{ name: "All files", extensions: ["*"] },
				],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			return runGroupChatImport(result.filePaths);
		},
	);

	ipcMain.handle(
		"group-chats:importFromPaths",
		async (
			_event,
			payload: { paths: string[] },
		): Promise<GroupChatImportResponse> => {
			if (!payload.paths || payload.paths.length === 0) {
				return { success: false, error: "No files supplied" };
			}
			return runGroupChatImport(payload.paths);
		},
	);

	ipcMain.handle(
		"group-chats:save",
		async (
			_event,
			payload: {
				groupChat: GroupChat;
				characterIds: string[];
				messageLength: MessageLength;
				gatheringSummary?: string;
				gatheringMessages?: UIMessage[];
			},
		): Promise<StoredGroupChat> => {
			const stored: StoredGroupChat = {
				id: nanoid(),
				createdAt: new Date().toISOString(),
				groupChat: payload.groupChat,
				characterIds: payload.characterIds,
				messageLength: payload.messageLength,
				gatheringSummary: payload.gatheringSummary,
				gatheringMessages: payload.gatheringMessages,
			};
			await saveGroupChat(stored);
			return stored;
		},
	);

	ipcMain.handle(
		"group-chats:updateField",
		async (
			_event,
			payload: {
				id: string;
				field: "title" | "publicDescription" | "scenario" | "privateDetails";
				value: string;
			},
		): Promise<GroupChatResult> => {
			try {
				const next = await updateGroupChatField(
					payload.id,
					payload.field,
					payload.value,
				);
				return { success: true, stored: next };
			} catch (err) {
				return { success: false, error: String(err) };
			}
		},
	);

	ipcMain.handle(
		"group-chats:generateGreeting",
		async (
			_event,
			payload: { id: string; speakerFirstName: string },
		): Promise<GroupChatResult> => {
			const existing = await getGroupChat(payload.id);
			if (!existing) {
				return { success: false, error: `Group chat ${payload.id} not found` };
			}
			const settings = await getSettings();
			const allCharacters = await listCharacters();
			const byId = new Map(allCharacters.map((c) => [c.id, c]));
			const cast: Character[] = [];
			for (const cid of existing.characterIds) {
				const found = byId.get(cid);
				if (!found) {
					return {
						success: false,
						error: `Character ${cid} no longer exists — cannot generate a greeting for a missing cast member.`,
					};
				}
				cast.push(found.character);
			}
			const matchesSpeaker = cast.find(
				(c) =>
					c.firstName.toLowerCase() ===
					payload.speakerFirstName.toLowerCase(),
			);
			if (!matchesSpeaker) {
				return {
					success: false,
					error: `No cast member with first name "${payload.speakerFirstName}" — pick someone from the existing cast.`,
				};
			}
			const result = await generateSingleGroupChatGreeting({
				runId: `group-greet-${Date.now()}`,
				characters: cast,
				speakerFirstName: matchesSpeaker.firstName,
				scenario: existing.groupChat.scenario,
				privateDetails: existing.groupChat.privateDetails,
				existingGreetings: existing.groupChat.greetingMessages ?? [],
				messageLength: existing.messageLength,
				superAdmin: settings.superAdmin,
				generationModel: settings.generationModel,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return { success: false, error: result.error };
			}
			try {
				const next = await appendGroupChatGreeting(payload.id, result.data);
				return { success: true, stored: next };
			} catch (err) {
				return { success: false, error: String(err) };
			}
		},
	);

	ipcMain.handle(
		"group-chats:deleteGreeting",
		async (
			_event,
			payload: { id: string; index: number },
		): Promise<GroupChatResult> => {
			try {
				const next = await deleteGroupChatGreeting(payload.id, payload.index);
				return { success: true, stored: next };
			} catch (err) {
				return { success: false, error: String(err) };
			}
		},
	);

	ipcMain.handle(
		"group-chats:updateGreetingMessage",
		async (
			_event,
			payload: { id: string; index: number; message: string },
		): Promise<GroupChatResult> => {
			try {
				const next = await updateGroupChatGreetingMessage(
					payload.id,
					payload.index,
					payload.message,
				);
				return { success: true, stored: next };
			} catch (err) {
				return { success: false, error: String(err) };
			}
		},
	);

	ipcMain.handle(
		"group-chats:updateGatheringMessages",
		async (
			_event,
			payload: { id: string; gatheringMessages: UIMessage[] },
		): Promise<StoredGroupChat | null> => {
			return updateGroupChatGatheringMessages(
				payload.id,
				payload.gatheringMessages,
			);
		},
	);

	ipcMain.handle(
		"group-chats:regenerate",
		async (
			_event,
			payload: { id: string },
		): Promise<GenerateGroupChatResponse> => {
			const existing = await getGroupChat(payload.id);
			if (!existing) {
				return { success: false, error: `Group chat ${payload.id} not found` };
			}
			const settings = await getSettings();
			const allCharacters = await listCharacters();
			const byId = new Map(allCharacters.map((c) => [c.id, c]));
			const characters: Character[] = [];
			for (const cid of existing.characterIds) {
				const found = byId.get(cid);
				if (!found) {
					return {
						success: false,
						error: `Character ${cid} no longer exists — cannot regenerate a group chat with a missing member. Restore the character or create a new group chat.`,
					};
				}
				characters.push(found.character);
			}
			const result = await generateGroupChat({
				runId: `group-regen-${Date.now()}`,
				characters,
				gatheringSummary: existing.gatheringSummary ?? "",
				messageLength: existing.messageLength,
				superAdmin: settings.superAdmin,
				generationModel: settings.generationModel,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error,
					refusal: result.refusal,
					usage: result.usage,
					adminOverrideApplied: result.adminOverrideApplied,
				};
			}
			const next: StoredGroupChat = {
				...existing,
				groupChat: result.data,
			};
			await saveGroupChat(next);
			return {
				success: true,
				stored: next,
				usage: result.usage,
				adminOverrideApplied: result.adminOverrideApplied,
			};
		},
	);
}
