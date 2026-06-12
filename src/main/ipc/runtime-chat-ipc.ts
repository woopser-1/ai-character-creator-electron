import { ipcMain } from "electron";
import { nanoid } from "nanoid";
import type {
	RuntimeChatDeleteResult,
	RuntimeChatResult,
	RuntimeChatState,
	RuntimeChatUserProfile,
} from "@shared/runtime-chat";
import { runtimeChatUserProfileSchema } from "@shared/runtime-chat";
import { getFullName } from "@shared/schemas";
import {
	buildInitialRuntimeChatState,
	startRuntimeChatTurn,
	stopRuntimeChatTurn,
	stripRuntimeChatMessageText,
} from "../llm/runtime-chat";
import { getCharacter } from "../storage/characters";
import {
	deleteRuntimeChatConversation,
	getRuntimeChatConversation,
	listRuntimeChatConversations,
	replaceRuntimeChatMessages,
	saveRuntimeChatConversation,
	updateRuntimeChatState,
	updateRuntimeChatUserProfile,
} from "../storage/runtime-chat";
import { getSettings } from "../storage/settings";
import type { IpcCtx } from "./helpers";

function latestStateBefore(
	messages: NonNullable<
		Awaited<ReturnType<typeof getRuntimeChatConversation>>
	>["messages"],
	index: number,
	fallback: RuntimeChatState,
): RuntimeChatState {
	for (let i = index - 1; i >= 0; i--) {
		const state = messages[i]?.stateSnapshot;
		if (state) return state;
	}

	return fallback;
}

export function registerRuntimeChatIpc({ window }: IpcCtx): void {
	ipcMain.handle("runtime-chat:list", async () => {
		return listRuntimeChatConversations();
	});

	ipcMain.handle("runtime-chat:get", async (_event, id: string) => {
		return getRuntimeChatConversation(id);
	});

	ipcMain.handle(
		"runtime-chat:create",
		async (
			_event,
			payload: { characterId: string; userProfile: RuntimeChatUserProfile },
		): Promise<RuntimeChatResult> => {
			try {
				const character = await getCharacter(payload.characterId);
				if (!character) {
					return {
						success: false,
						error: `Character ${payload.characterId} not found`,
					};
				}

				const userProfile = runtimeChatUserProfileSchema.parse(
					payload.userProfile,
				);
				const now = new Date().toISOString();
				const currentState = buildInitialRuntimeChatState(character);
				const greetingText =
					stripRuntimeChatMessageText(character.character.greetingMessage) ||
					character.character.greetingMessage;
				const conversation = await saveRuntimeChatConversation({
					id: nanoid(),
					characterId: character.id,
					title: `${getFullName(character.character)} chat`,
					createdAt: now,
					updatedAt: now,
					userProfile,
					currentState,
					messages: [
						{
							id: nanoid(),
							role: "assistant",
							text: greetingText,
							createdAt: now,
							stateSnapshot: currentState,
						},
					],
				});

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:delete",
		async (_event, id: string): Promise<RuntimeChatDeleteResult> => {
			try {
				stopRuntimeChatTurn(id);
				await deleteRuntimeChatConversation(id);

				return { success: true };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:updateUserProfile",
		async (
			_event,
			payload: { id: string; userProfile: RuntimeChatUserProfile },
		): Promise<RuntimeChatResult> => {
			try {
				const userProfile = runtimeChatUserProfileSchema.parse(
					payload.userProfile,
				);
				const conversation = await updateRuntimeChatUserProfile(
					payload.id,
					userProfile,
				);

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:updateState",
		async (
			_event,
			payload: { id: string; currentState: RuntimeChatState },
		): Promise<RuntimeChatResult> => {
			try {
				const conversation = await updateRuntimeChatState(
					payload.id,
					payload.currentState,
				);

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:sendMessage",
		async (
			_event,
			payload: { conversationId: string; text: string },
		): Promise<RuntimeChatResult> => {
			try {
				const existing = await getRuntimeChatConversation(payload.conversationId);
				if (!existing) {
					return {
						success: false,
						error: `Chat conversation ${payload.conversationId} not found`,
					};
				}
				const character = await getCharacter(existing.characterId);
				if (!character) {
					return {
						success: false,
						error: `Character ${existing.characterId} not found`,
					};
				}

				const text = payload.text.trim();
				if (!text) return { success: true, conversation: existing };

				const now = new Date().toISOString();
				const assistantMessageId = nanoid();
				const conversation = await saveRuntimeChatConversation({
					...existing,
					messages: [
						...existing.messages,
						{ id: nanoid(), role: "user", text, createdAt: now },
						{
							id: assistantMessageId,
							role: "assistant",
							text: "",
							createdAt: now,
						},
					],
				});
				const settings = await getSettings();
				window.webContents.send("runtime-chat:event", {
					conversationId: conversation.id,
					type: "conversation-updated",
					conversation,
				});
				startRuntimeChatTurn({
					window,
					conversation,
					storedCharacter: character,
					assistantMessageId,
					modelId: settings.mainModel,
				});

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:addCharacterMessage",
		async (
			_event,
			payload: { conversationId: string; guidance?: string },
		): Promise<RuntimeChatResult> => {
			try {
				const existing = await getRuntimeChatConversation(payload.conversationId);
				if (!existing) {
					return {
						success: false,
						error: `Chat conversation ${payload.conversationId} not found`,
					};
				}
				const character = await getCharacter(existing.characterId);
				if (!character) {
					return {
						success: false,
						error: `Character ${existing.characterId} not found`,
					};
				}

				const now = new Date().toISOString();
				const assistantMessageId = nanoid();
				const conversation = await saveRuntimeChatConversation({
					...existing,
					messages: [
						...existing.messages,
						{
							id: assistantMessageId,
							role: "assistant",
							text: "",
							createdAt: now,
						},
					],
				});
				const settings = await getSettings();
				window.webContents.send("runtime-chat:event", {
					conversationId: conversation.id,
					type: "conversation-updated",
					conversation,
				});
				startRuntimeChatTurn({
					window,
					conversation,
					storedCharacter: character,
					assistantMessageId,
					modelId: settings.mainModel,
					guidance: payload.guidance?.trim() || undefined,
				});

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:deleteMessage",
		async (
			_event,
			payload: { conversationId: string; messageId: string },
		): Promise<RuntimeChatResult> => {
			try {
				const existing = await getRuntimeChatConversation(payload.conversationId);
				if (!existing) {
					return {
						success: false,
						error: `Chat conversation ${payload.conversationId} not found`,
					};
				}
				const index = existing.messages.findIndex(
					(message) => message.id === payload.messageId,
				);
				if (index < 0) return { success: false, error: "Message not found" };
				if (existing.messages[index]?.role !== "user") {
					return { success: false, error: "Only user messages can be deleted" };
				}

				stopRuntimeChatTurn(existing.id);
				const messages = existing.messages.slice(0, index);
				const currentState = latestStateBefore(
					existing.messages,
					index,
					existing.currentState,
				);
				const conversation = await replaceRuntimeChatMessages(
					existing.id,
					messages,
					currentState,
				);

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"runtime-chat:regenerateMessage",
		async (
			_event,
			payload: { conversationId: string; messageId: string; guidance: string },
		): Promise<RuntimeChatResult> => {
			try {
				const existing = await getRuntimeChatConversation(payload.conversationId);
				if (!existing) {
					return {
						success: false,
						error: `Chat conversation ${payload.conversationId} not found`,
					};
				}
				const index = existing.messages.findIndex(
					(message) => message.id === payload.messageId,
				);
				if (index < 0) {
					return { success: false, error: "Message not found" };
				}
				if (existing.messages[index]?.role !== "assistant") {
					return { success: false, error: "Only assistant messages can be regenerated" };
				}
				if (!existing.messages.slice(0, index).some((message) => message.role === "user")) {
					return { success: false, error: "The greeting cannot be regenerated from chat history" };
				}

				const character = await getCharacter(existing.characterId);
				if (!character) {
					return {
						success: false,
						error: `Character ${existing.characterId} not found`,
					};
				}

				const now = new Date().toISOString();
				const currentState = latestStateBefore(
					existing.messages,
					index,
					existing.currentState,
				);
				const messages = [
					...existing.messages.slice(0, index),
					{
						id: payload.messageId,
						role: "assistant" as const,
						text: "",
						createdAt: now,
						regenerationHint: payload.guidance.trim() || undefined,
					},
				];
				const conversation = await saveRuntimeChatConversation({
					...existing,
					currentState,
					messages,
				});
				const settings = await getSettings();
				window.webContents.send("runtime-chat:event", {
					conversationId: conversation.id,
					type: "conversation-updated",
					conversation,
				});
				startRuntimeChatTurn({
					window,
					conversation,
					storedCharacter: character,
					assistantMessageId: payload.messageId,
					modelId: settings.mainModel,
					regenerationHint: payload.guidance.trim() || undefined,
				});

				return { success: true, conversation };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle("runtime-chat:stop", async (_event, conversationId: string) => {
		stopRuntimeChatTurn(conversationId);
	});
}
