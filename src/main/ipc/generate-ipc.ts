import { ipcMain } from "electron";
import { nanoid } from "nanoid";
import type {
	GenerateCharacterAllResponse,
	GenerateCharacterStepResponse,
	GenerateGroupChatResponse,
	GenerateScenesResponse,
	GenerateSingleSceneResponse,
} from "@shared/generate";
import type { UIMessage } from "@shared/chat";
import type {
	Character,
	CharacterProfilePreview,
	CharacterStepId,
	ConfirmedProfile,
	Difficulty,
	ImageModel,
	Measurements,
	MessageLength,
	Scene,
	StoredCharacter,
	StoredGroupChat,
} from "@shared/schemas";
import {
	characterSchema,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_MESSAGE_LENGTH,
} from "@shared/schemas";
import {
	generateCharacter,
	generateCharacterStep,
	inferMeasurements,
	inferProfile,
} from "../agent/generate-character";
import { generateGroupChat } from "../agent/generate-group-chat";
import { generateScenes, generateSingleScene } from "../agent/generate-scenes";
import {
	listCharacters,
	saveCharacter,
} from "../storage/characters";
import { saveGroupChat } from "../storage/group-chats";
import { getSettings } from "../storage/settings";
import { type IpcCtx, withConfirmedMeasurements } from "./helpers";

export function registerGenerateIpc({ emitProgress }: IpcCtx): void {
	ipcMain.handle(
		"generate:character:all",
		async (
			_event,
			payload: {
				runId: string;
				difficulty: Difficulty;
				messageLength?: MessageLength;
				gatheringSummary: string;
				imageModel?: ImageModel;
				confirmedMeasurements?: Measurements;
				confirmedProfile?: ConfirmedProfile;
				draftId?: string;
				sourceCharacterId?: string;
			},
		): Promise<GenerateCharacterAllResponse> => {
			const settings = await getSettings();
			const messageLength = payload.messageLength ?? DEFAULT_MESSAGE_LENGTH;
			const summaryWithMeasurements = withConfirmedMeasurements(
				payload.gatheringSummary,
				payload.confirmedMeasurements,
			);
			const result = await generateCharacter({
				runId: payload.runId,
				difficulty: payload.difficulty,
				messageLength,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
				generationModel: settings.generationModel,
				gatheringSummary: summaryWithMeasurements,
				superAdmin: settings.superAdmin,
				confirmedProfile: payload.confirmedProfile,
				onEvent: emitProgress,
			});

			if (!result.success || !result.character) {
				const partialByStep: Partial<Record<CharacterStepId, unknown>> = {};
				for (const [id, res] of Object.entries(result.stepResults)) {
					if (res && res.success) partialByStep[id as CharacterStepId] = res.data;
				}
				return {
					success: false,
					error: result.error ?? "character generation failed",
					partialByStep,
				};
			}

			const characterWithMeasurements: Character = payload.confirmedMeasurements
				? { ...result.character, confirmedMeasurements: payload.confirmedMeasurements }
				: result.character;
			const stored: StoredCharacter = {
				id: payload.draftId ?? nanoid(),
				createdAt: new Date().toISOString(),
				character: characterWithMeasurements,
				scenes: [],
				difficulty: payload.difficulty,
				messageLength,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
				gatheringSummary: payload.gatheringSummary,
				confirmedProfile: payload.confirmedProfile,
				sourceCharacterId: payload.sourceCharacterId,
			};
			await saveCharacter(stored);

			const usageTotal = Object.values(result.stepResults).reduce(
				(acc, r) => {
					if (!r || !r.usage) return acc;
					return {
						model: settings.generationModel,
						inputTokens: acc.inputTokens + r.usage.inputTokens,
						outputTokens: acc.outputTokens + r.usage.outputTokens,
						cacheReadTokens: acc.cacheReadTokens + r.usage.cacheReadTokens,
						cacheCreationTokens:
							acc.cacheCreationTokens + r.usage.cacheCreationTokens,
						costUsd: acc.costUsd + r.usage.costUsd,
						durationMs: Math.max(acc.durationMs, r.usage.durationMs),
					};
				},
				{
					model: settings.generationModel,
					inputTokens: 0,
					outputTokens: 0,
					cacheReadTokens: 0,
					cacheCreationTokens: 0,
					costUsd: 0,
					durationMs: 0,
				},
			);

			return { success: true, stored, usageTotal };
		},
	);

	ipcMain.handle(
		"generate:character:step",
		async (
			_event,
			payload: {
				runId: string;
				stepId: CharacterStepId;
				difficulty: Difficulty;
				messageLength?: MessageLength;
				imageModel?: ImageModel;
				gatheringSummary: string;
				confirmedMeasurements?: Measurements;
				confirmedProfile?: ConfirmedProfile;
			},
		): Promise<GenerateCharacterStepResponse> => {
			const settings = await getSettings();
			const result = await generateCharacterStep({
				runId: payload.runId,
				stepId: payload.stepId,
				difficulty: payload.difficulty,
				messageLength: payload.messageLength ?? DEFAULT_MESSAGE_LENGTH,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
				generationModel: settings.generationModel,
				gatheringSummary: withConfirmedMeasurements(
					payload.gatheringSummary,
					payload.confirmedMeasurements,
				),
				superAdmin: settings.superAdmin,
				confirmedProfile: payload.confirmedProfile,
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
			return {
				success: true,
				data: result.data,
				usage: result.usage,
				adminOverrideApplied: result.adminOverrideApplied,
			};
		},
	);

	ipcMain.handle(
		"generate:character:finalize",
		async (
			_event,
			payload: {
				stepData: Record<CharacterStepId, unknown>;
				difficulty: Difficulty;
				messageLength?: MessageLength;
				imageModel?: ImageModel;
				confirmedMeasurements?: Measurements;
				gatheringSummary?: string;
				confirmedProfile?: ConfirmedProfile;
				draftId?: string;
				sourceCharacterId?: string;
			},
		) => {
			const merged = characterSchema.safeParse({
				...(payload.stepData.light as object),
				...(payload.stepData.scenario as object),
				...(payload.stepData.personality as object),
				...(payload.stepData.extras as object),
				...(payload.stepData.visual as object),
				...(payload.confirmedMeasurements
					? { confirmedMeasurements: payload.confirmedMeasurements }
					: {}),
			});
			if (!merged.success) {
				return {
					success: false as const,
					error: `Merged character validation failed: ${merged.error.message}`,
				};
			}
			const stored: StoredCharacter = {
				id: payload.draftId ?? nanoid(),
				createdAt: new Date().toISOString(),
				character: merged.data,
				scenes: [],
				difficulty: payload.difficulty,
				messageLength: payload.messageLength ?? DEFAULT_MESSAGE_LENGTH,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
				gatheringSummary: payload.gatheringSummary,
				confirmedProfile: payload.confirmedProfile,
				sourceCharacterId: payload.sourceCharacterId,
			};
			await saveCharacter(stored);
			return { success: true as const, stored };
		},
	);

	ipcMain.handle(
		"generate:measurements:infer",
		async (
			_event,
			payload: { gatheringSummary: string },
		): Promise<
			| { success: true; measurements: Measurements }
			| { success: false; error: string }
		> => {
			const settings = await getSettings();
			return inferMeasurements({
				gatheringSummary: payload.gatheringSummary,
				generationModel: settings.generationModel,
			});
		},
	);

	ipcMain.handle(
		"generate:profile:infer",
		async (
			_event,
			payload: { gatheringSummary: string; difficulty: Difficulty },
		): Promise<
			| { success: true; profile: CharacterProfilePreview }
			| { success: false; error: string }
		> => {
			const settings = await getSettings();
			return inferProfile({
				gatheringSummary: payload.gatheringSummary,
				difficulty: payload.difficulty,
				generationModel: settings.generationModel,
			});
		},
	);

	ipcMain.handle(
		"generate:scenes",
		async (
			_event,
			payload: {
				runId: string;
				character: Character;
				gatheringSummary: string;
				imageModel?: ImageModel;
				sceneCount?: number;
			},
		): Promise<GenerateScenesResponse> => {
			const settings = await getSettings();
			const result = await generateScenes({
				runId: payload.runId,
				character: payload.character,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
				generationModel: settings.generationModel,
				sceneCount: payload.sceneCount,
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
			return {
				success: true,
				scenes: result.data,
				usage: result.usage,
				adminOverrideApplied: result.adminOverrideApplied,
			};
		},
	);

	ipcMain.handle(
		"generate:scene:single",
		async (
			_event,
			payload: {
				runId: string;
				character: Character;
				existingScenes: Scene[];
				gatheringSummary: string;
				imageModel?: ImageModel;
			},
		): Promise<GenerateSingleSceneResponse> => {
			const settings = await getSettings();
			const result = await generateSingleScene({
				runId: payload.runId,
				character: payload.character,
				existingScenes: payload.existingScenes,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
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
			return {
				success: true,
				scene: result.data,
				usage: result.usage,
				adminOverrideApplied: result.adminOverrideApplied,
			};
		},
	);

	ipcMain.handle(
		"generate:group-chat",
		async (
			_event,
			payload: {
				runId: string;
				characterIds: string[];
				gatheringSummary: string;
				messageLength: MessageLength;
				gatheringMessages?: UIMessage[];
			},
		): Promise<GenerateGroupChatResponse> => {
			const settings = await getSettings();
			const allCharacters = await listCharacters();
			const byId = new Map(allCharacters.map((c) => [c.id, c]));
			const characters: Character[] = [];
			for (const id of payload.characterIds) {
				const found = byId.get(id);
				if (!found) {
					return {
						success: false,
						error: `Character ${id} not found — it may have been deleted`,
					};
				}
				characters.push(found.character);
			}
			const result = await generateGroupChat({
				runId: payload.runId,
				characters,
				gatheringSummary: payload.gatheringSummary,
				messageLength: payload.messageLength,
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
			const stored: StoredGroupChat = {
				id: nanoid(),
				createdAt: new Date().toISOString(),
				groupChat: result.data,
				characterIds: payload.characterIds,
				messageLength: payload.messageLength,
				gatheringSummary: payload.gatheringSummary,
				gatheringMessages: payload.gatheringMessages,
			};
			await saveGroupChat(stored);
			return {
				success: true,
				stored,
				usage: result.usage,
				adminOverrideApplied: result.adminOverrideApplied,
			};
		},
	);
}
