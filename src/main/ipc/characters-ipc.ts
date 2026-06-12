import { promises as fs } from "node:fs";
import { basename } from "node:path";
import {
	anyCharacterPortFileSchema,
	CHARACTER_BUNDLE_KIND,
	CHARACTER_PORT_KIND,
	CHARACTER_PORT_VERSION,
	type ImportResponse,
	type PortableCharacter,
} from "@shared/character-port";
import type { UIMessage } from "@shared/chat";
import type { ExportResponse, ImportFileOutcome } from "@shared/port-shared";
import type { CharacterResult } from "@shared/result";
import type {
	Character,
	CharacterStepId,
	ConfirmedProfile,
	Difficulty,
	ImageModel,
	Measurements,
	MessageLength,
	Scene,
	StoredCharacter,
} from "@shared/schemas";
import {
	characterLightSchema,
	characterSchema,
	characterVisualSchema,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_MESSAGE_LENGTH,
	extraDetailsOnlySchema,
	getStoredImageModel,
	personalityOnlySchema,
	scenarioOnlySchema,
} from "@shared/schemas";
import { dialog, ipcMain } from "electron";
import { nanoid } from "nanoid";
import {
	generateCharacterStep,
	refreshVivid3Physical,
	upgradeSystemFramework,
} from "../agent/generate-character";
import { generateScenes } from "../agent/generate-scenes";
import {
	appendSceneToCharacter,
	deleteCharacter,
	getCharacter,
	importPortableCharacters,
	listCharacters,
	replaceSceneInCharacter,
	saveCharacter,
	toPortableCharacter,
	updateCharacter,
	updateCharacterScenes,
} from "../storage/characters";
import { extractOurDreamProfileImage } from "../storage/ourdream";
import { getSettings } from "../storage/settings";
import {
	APP_TAG,
	characterFilename,
	type IpcCtx,
	withConfirmedMeasurements,
} from "./helpers";

async function readPortablesFromPaths(paths: string[]): Promise<{
	portables: PortableCharacter[];
	fileOutcomes: ImportFileOutcome[];
}> {
	const portables: PortableCharacter[] = [];
	const fileOutcomes: ImportFileOutcome[] = [];

	for (const filePath of paths) {
		const fileName = basename(filePath);
		try {
			const raw = await fs.readFile(filePath, "utf-8");
			const json = JSON.parse(raw);
			const parsed = anyCharacterPortFileSchema.safeParse(json);
			if (!parsed.success) {
				fileOutcomes.push({
					fileName,
					ok: false,
					error: parsed.error.issues[0]?.message ?? "Invalid character file",
				});
				continue;
			}
			const fileCharacters =
				parsed.data.kind === CHARACTER_PORT_KIND
					? [parsed.data.character]
					: parsed.data.characters;
			portables.push(...fileCharacters);
			fileOutcomes.push({
				fileName,
				ok: true,
				count: fileCharacters.length,
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

async function runImport(paths: string[]): Promise<ImportResponse> {
	const { portables, fileOutcomes } = await readPortablesFromPaths(paths);

	if (portables.length === 0) {
		return {
			success: false,
			error:
				fileOutcomes.find((o) => !o.ok)?.error ??
				"No characters found in the selected files",
			fileOutcomes,
		};
	}

	const imported = await importPortableCharacters(portables);
	return { success: true, imported, fileOutcomes };
}

function buildScenesUpgradeSummary(
	existing: StoredCharacter,
	imageModel: ImageModel,
): string {
	const character = existing.character;
	const clip = (value: string, max: number) =>
		value.length > max ? `${value.slice(0, max)}...` : value;
	const sceneBlocks = existing.scenes.map((scene, index) =>
		[
			`<scene index="${index + 1}" name="${scene.sceneName}">`,
			`Current positive prompt: ${clip(scene.prompt, 2500)}`,
			`Current negative prompt: ${scene.negativePrompt ? clip(scene.negativePrompt, 800) : "(none)"}`,
			"</scene>",
		].join("\n"),
	);

	return [
		`Upgrade the full existing scene set for ${character.firstName} ${character.lastName}.`,
		`Target image model: ${imageModel}.`,
		`Gender: ${character.gender ?? "unspecified"}.`,
		`Difficulty: ${existing.difficulty}.`,
		`Personality: ${character.personalityLabel}.`,
		`Occupation: ${character.occupationLabel}.`,
		`Scenario context: ${clip(character.scenario, 1800)}`,
		"",
		`Rewrite exactly ${existing.scenes.length} scenes in the same order. Preserve every sceneName exactly as provided. Preserve each scene's core concept, setting, action, outfit/state, mood, and framing, but upgrade the prompt text to the latest scene framework for the target image model.`,
		"Every upgraded scene must include the character physical anchor using the canonical stored age and atomic appearance fields. Every upgraded scene must include a fresh negativePrompt with 8-15 concise tags. Do not invent new scenes, remove scenes, split scenes, merge scenes, or rename scenes.",
		"",
		"Existing scenes to upgrade:",
		sceneBlocks.join("\n\n"),
	].join("\n");
}

export function registerCharactersIpc({ window, emitProgress }: IpcCtx): void {
	ipcMain.handle("characters:list", async () => {
		return listCharacters();
	});

	ipcMain.handle("characters:get", async (_event, id: string) => {
		return getCharacter(id);
	});

	ipcMain.handle("characters:delete", async (_event, id: string) => {
		await deleteCharacter(id);
	});

	ipcMain.handle(
		"characters:export",
		async (_event, payload: { ids: string[] }): Promise<ExportResponse> => {
			if (!payload.ids || payload.ids.length === 0) {
				return { success: false, error: "No characters selected for export" };
			}

			const all = await listCharacters();
			const selectedById = new Map(all.map((c) => [c.id, c]));
			const selected = payload.ids
				.map((id) => selectedById.get(id))
				.filter((c): c is NonNullable<typeof c> => Boolean(c));

			if (selected.length === 0) {
				return { success: false, error: "Selected characters not found" };
			}

			const isSingle = selected.length === 1;
			const stamp = new Date().toISOString().slice(0, 10);
			const defaultName =
				isSingle && selected[0]
					? characterFilename(toPortableCharacter(selected[0]))
					: `characters-${stamp}.bundle.json`;

			const result = await dialog.showSaveDialog(window, {
				title: isSingle
					? "Export character"
					: `Export ${selected.length} characters`,
				defaultPath: defaultName,
				filters: [{ name: "Character JSON", extensions: ["json"] }],
			});

			if (result.canceled || !result.filePath) {
				return { success: false, canceled: true };
			}

			const exportedAt = new Date().toISOString();
			const file =
				isSingle && selected[0]
					? {
							kind: CHARACTER_PORT_KIND,
							version: CHARACTER_PORT_VERSION,
							exportedAt,
							app: APP_TAG,
							character: toPortableCharacter(selected[0]),
						}
					: {
							kind: CHARACTER_BUNDLE_KIND,
							version: CHARACTER_PORT_VERSION,
							exportedAt,
							app: APP_TAG,
							characters: selected.map(toPortableCharacter),
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
					count: selected.length,
				};
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);

	ipcMain.handle("characters:import", async (): Promise<ImportResponse> => {
		const result = await dialog.showOpenDialog(window, {
			title: "Import characters",
			properties: ["openFile", "multiSelections"],
			filters: [
				{ name: "Character JSON", extensions: ["json"] },
				{ name: "All files", extensions: ["*"] },
			],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return { success: false, canceled: true };
		}

		return runImport(result.filePaths);
	});

	ipcMain.handle(
		"characters:importFromPaths",
		async (_event, payload: { paths: string[] }): Promise<ImportResponse> => {
			if (!payload.paths || payload.paths.length === 0) {
				return { success: false, error: "No files supplied" };
			}
			return runImport(payload.paths);
		},
	);

	ipcMain.handle(
		"characters:save",
		async (
			_event,
			payload: {
				character: Character;
				scenes: Scene[];
				difficulty: Difficulty;
				messageLength?: MessageLength;
				imageModel?: ImageModel;
			},
		): Promise<StoredCharacter> => {
			const stored: StoredCharacter = {
				id: nanoid(),
				createdAt: new Date().toISOString(),
				character: payload.character,
				scenes: payload.scenes,
				difficulty: payload.difficulty,
				messageLength: payload.messageLength ?? DEFAULT_MESSAGE_LENGTH,
				imageModel: payload.imageModel ?? DEFAULT_IMAGE_MODEL,
			};
			await saveCharacter(stored);
			return stored;
		},
	);

	ipcMain.handle(
		"characters:updateImageModel",
		async (_event, payload: { id: string; imageModel: ImageModel }) => {
			return updateCharacter(payload.id, { imageModel: payload.imageModel });
		},
	);

	ipcMain.handle(
		"characters:updateDifficulty",
		async (_event, payload: { id: string; difficulty: Difficulty }) => {
			return updateCharacter(payload.id, { difficulty: payload.difficulty });
		},
	);

	ipcMain.handle(
		"characters:updateOurdreamUrl",
		async (
			_event,
			payload: { id: string; ourdreamUrl: string | null },
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			if (!payload.ourdreamUrl) {
				const updated = await updateCharacter(payload.id, {
					ourdreamUrl: undefined,
					profileImageUrl: undefined,
				});
				return { success: true, stored: updated };
			}
			const extracted = await extractOurDreamProfileImage(payload.ourdreamUrl);
			if (!extracted.success) {
				return { success: false, error: extracted.error };
			}
			const updated = await updateCharacter(payload.id, {
				ourdreamUrl: payload.ourdreamUrl.trim(),
				profileImageUrl: extracted.profileImageUrl,
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:refreshProfileImage",
		async (_event, payload: { id: string }): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			if (!existing.ourdreamUrl) {
				return {
					success: false,
					error: "No OurDream URL saved for this character",
				};
			}
			const extracted = await extractOurDreamProfileImage(existing.ourdreamUrl);
			if (!extracted.success) {
				return { success: false, error: extracted.error };
			}
			const updated = await updateCharacter(payload.id, {
				profileImageUrl: extracted.profileImageUrl,
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:updateScenes",
		async (_event, payload: { id: string; scenes: Scene[] }) => {
			await updateCharacterScenes(payload.id, payload.scenes);
			return getCharacter(payload.id);
		},
	);

	ipcMain.handle(
		"characters:updateCharacterField",
		async (
			_event,
			payload: { id: string; path: string; value: string },
		): Promise<CharacterResult> => {
			const EDITABLE_PATHS = new Set<string>([
				"customPhysicalDetails",
				"customFaceDetails",
				"baseGenerationPrompt",
				"baseImagePrompt",
				"scenario",
				"greetingMessage",
				"firstReplySuggestion",
				"additionalPersonalityDetails",
				"extraDetails",
				"publicDescription",
				"gender",
				"personalityLabel",
				"occupationLabel",
				"relationshipLabel",
				"hobbyLabel",
				"fetishLabel",
				"ourDreamFields.hairStyle",
				"ourDreamFields.hairColor",
				"ourDreamFields.bodyType",
				"ourDreamFields.ethnicity",
				"ourDreamFields.skinColor",
				"ourDreamFields.breastSize",
				"ourDreamFields.buttSize",
				"ourDreamFields.eyeColor",
				"intimacyProfile.circumstantialTriggers",
			]);
			if (!EDITABLE_PATHS.has(payload.path)) {
				return {
					success: false,
					error: `Path "${payload.path}" is not editable`,
				};
			}
			if (payload.value.trim().length === 0) {
				return { success: false, error: "Value cannot be empty" };
			}
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const segments = payload.path.split(".");
			const nextCharacter: Character = JSON.parse(
				JSON.stringify(existing.character),
			);
			// Walk segments, but only one level of nesting is whitelisted.
			if (segments.length === 1) {
				(nextCharacter as Record<string, unknown>)[segments[0]] = payload.value;
			} else if (segments.length === 2) {
				const [parent, child] = segments;
				const parentObj = (nextCharacter as Record<string, unknown>)[parent];
				if (parentObj === undefined || parentObj === null) {
					return {
						success: false,
						error: `Parent "${parent}" missing on character`,
					};
				}
				(parentObj as Record<string, unknown>)[child] = payload.value;
			}
			const parsed = characterSchema.safeParse(nextCharacter);
			if (!parsed.success) {
				return {
					success: false,
					error: `Validation failed: ${parsed.error.message}`,
				};
			}
			const updated = await updateCharacter(payload.id, {
				character: parsed.data,
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:updateSceneField",
		async (
			_event,
			payload: {
				id: string;
				sceneIndex: number;
				field: "prompt" | "negativePrompt";
				value: string;
			},
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			if (
				payload.sceneIndex < 0 ||
				payload.sceneIndex >= existing.scenes.length
			) {
				return {
					success: false,
					error: `Scene index ${payload.sceneIndex} out of range`,
				};
			}
			if (payload.field === "prompt" && payload.value.trim().length === 0) {
				return { success: false, error: "Scene prompt cannot be empty" };
			}
			const nextScenes: Scene[] = existing.scenes.map((scene, idx) =>
				idx === payload.sceneIndex
					? { ...scene, [payload.field]: payload.value }
					: scene,
			);
			await updateCharacterScenes(payload.id, nextScenes);
			const updated = await getCharacter(payload.id);
			if (!updated) {
				return {
					success: false,
					error: "Character disappeared after update",
				};
			}
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:appendScene",
		async (_event, payload: { id: string; scene: Scene }) => {
			await appendSceneToCharacter(payload.id, payload.scene);
			return getCharacter(payload.id);
		},
	);

	ipcMain.handle(
		"characters:replaceScene",
		async (
			_event,
			payload: { id: string; sceneIndex: number; scene: Scene },
		) => {
			await replaceSceneInCharacter(
				payload.id,
				payload.sceneIndex,
				payload.scene,
			);
			return getCharacter(payload.id);
		},
	);

	ipcMain.handle(
		"characters:updateGatheringMessages",
		async (
			_event,
			payload: {
				id: string;
				gatheringMessages?: UIMessage[];
				sceneGatheringMessages?: UIMessage[];
			},
		): Promise<StoredCharacter | null> => {
			const patch: Partial<Omit<StoredCharacter, "id" | "createdAt">> = {};
			if (payload.gatheringMessages !== undefined) {
				patch.gatheringMessages = payload.gatheringMessages;
			}
			if (payload.sceneGatheringMessages !== undefined) {
				patch.sceneGatheringMessages = payload.sceneGatheringMessages;
			}
			if (Object.keys(patch).length === 0) {
				return getCharacter(payload.id);
			}
			return updateCharacter(payload.id, patch);
		},
	);

	ipcMain.handle(
		"characters:updateMessageLength",
		async (
			_event,
			payload: {
				id: string;
				messageLength: MessageLength;
				gatheringSummary: string;
			},
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const settings = await getSettings();
			const runId = nanoid();
			const result = await generateCharacterStep({
				runId,
				stepId: "scenario",
				difficulty: existing.difficulty,
				messageLength: payload.messageLength,
				generationModel: settings.mainModel,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? "scenario regeneration failed",
				};
			}
			const parsed = scenarioOnlySchema.safeParse(result.data);
			if (!parsed.success) {
				return {
					success: false,
					error: `scenario schema validation failed: ${parsed.error.message}`,
				};
			}
			const updated = await updateCharacter(payload.id, {
				messageLength: payload.messageLength,
				character: { ...existing.character, scenario: parsed.data.scenario },
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:regenerateMoodAxes",
		async (
			_event,
			payload: { id: string; gatheringSummary: string },
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const settings = await getSettings();
			const runId = nanoid();
			const result = await generateCharacterStep({
				runId,
				stepId: "light",
				difficulty: existing.difficulty,
				messageLength: existing.messageLength ?? DEFAULT_MESSAGE_LENGTH,
				generationModel: settings.mainModel,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? "light regeneration failed",
				};
			}
			const parsed = characterLightSchema.safeParse(result.data);
			if (!parsed.success) {
				return {
					success: false,
					error: `light schema validation failed: ${parsed.error.message}`,
				};
			}
			const updated = await updateCharacter(payload.id, {
				character: { ...existing.character, moodAxes: parsed.data.moodAxes },
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:upgradeSystemFramework",
		async (
			_event,
			payload: { id: string; gatheringSummary?: string },
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const settings = await getSettings();
			const result = await upgradeSystemFramework({
				runId: nanoid(),
				character: existing.character,
				difficulty: existing.difficulty,
				messageLength: existing.messageLength ?? DEFAULT_MESSAGE_LENGTH,
				generationModel: settings.mainModel,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? "system framework upgrade failed",
				};
			}
			const updated = await updateCharacter(payload.id, {
				character: {
					...existing.character,
					scenario: result.data.scenario,
					greetingMessage: result.data.greetingMessage,
					moodAxes: result.data.moodAxes,
				},
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:refreshVivid3Physical",
		async (
			_event,
			payload: { id: string; gatheringSummary?: string },
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const imageModel = getStoredImageModel(existing);
			if (imageModel !== "Vivid 3") {
				return {
					success: false,
					error: `Refresh is only available for Vivid 3 characters (this one uses ${imageModel})`,
				};
			}
			const settings = await getSettings();
			const result = await refreshVivid3Physical({
				runId: nanoid(),
				character: existing.character,
				generationModel: settings.fastModel,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? "Vivid 3 physical refresh failed",
				};
			}
			const updated = await updateCharacter(payload.id, {
				character: {
					...existing.character,
					customPhysicalDetails: result.data.customPhysicalDetails,
					customFaceDetails: result.data.customFaceDetails,
					baseGenerationPrompt: result.data.baseGenerationPrompt,
					baseImagePrompt: result.data.baseImagePrompt,
					ourDreamFields: result.data.ourDreamFields,
				},
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:regenerateForDifficulty",
		async (
			_event,
			payload: {
				id: string;
				difficulty: Difficulty;
				gatheringSummary: string;
			},
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const settings = await getSettings();
			const messageLength = existing.messageLength ?? DEFAULT_MESSAGE_LENGTH;

			const lightRes = await generateCharacterStep({
				runId: nanoid(),
				stepId: "light",
				difficulty: payload.difficulty,
				messageLength,
				generationModel: settings.mainModel,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				onEvent: emitProgress,
			});
			if (!lightRes.success) {
				return {
					success: false,
					error: lightRes.error ?? "light regeneration failed",
				};
			}
			const lightParsed = characterLightSchema.safeParse(lightRes.data);
			if (!lightParsed.success) {
				return {
					success: false,
					error: `light schema validation failed: ${lightParsed.error.message}`,
				};
			}

			const scenarioRes = await generateCharacterStep({
				runId: nanoid(),
				stepId: "scenario",
				difficulty: payload.difficulty,
				messageLength,
				generationModel: settings.mainModel,
				gatheringSummary: payload.gatheringSummary,
				superAdmin: settings.superAdmin,
				onEvent: emitProgress,
			});
			if (!scenarioRes.success) {
				return {
					success: false,
					error: scenarioRes.error ?? "scenario regeneration failed",
				};
			}
			const scenarioParsed = scenarioOnlySchema.safeParse(scenarioRes.data);
			if (!scenarioParsed.success) {
				return {
					success: false,
					error: `scenario schema validation failed: ${scenarioParsed.error.message}`,
				};
			}

			const updated = await updateCharacter(payload.id, {
				difficulty: payload.difficulty,
				character: {
					...existing.character,
					moodAxes: lightParsed.data.moodAxes,
					difficultyProfile: lightParsed.data.difficultyProfile,
					intimacyProfile: lightParsed.data.intimacyProfile,
					scenario: scenarioParsed.data.scenario,
				},
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:regenerateVisualOnly",
		async (
			_event,
			payload: {
				id: string;
				gatheringSummary: string;
				confirmedMeasurements?: Measurements;
				confirmedProfile?: ConfirmedProfile;
				imageModel?: ImageModel;
			},
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const settings = await getSettings();
			const targetModel =
				payload.imageModel ?? existing.imageModel ?? DEFAULT_IMAGE_MODEL;
			const result = await generateCharacterStep({
				runId: nanoid(),
				stepId: "visual",
				difficulty: existing.difficulty,
				messageLength: existing.messageLength ?? DEFAULT_MESSAGE_LENGTH,
				imageModel: targetModel,
				generationModel: settings.fastModel,
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
					error: result.error ?? "visual regeneration failed",
				};
			}
			const parsed = characterVisualSchema.safeParse(result.data);
			if (!parsed.success) {
				return {
					success: false,
					error: `visual schema validation failed: ${parsed.error.message}`,
				};
			}
			const updated = await updateCharacter(payload.id, {
				imageModel: targetModel,
				confirmedProfile: payload.confirmedProfile ?? existing.confirmedProfile,
				character: {
					...existing.character,
					age: parsed.data.age,
					customPhysicalDetails: parsed.data.customPhysicalDetails,
					customFaceDetails: parsed.data.customFaceDetails,
					baseGenerationPrompt: parsed.data.baseGenerationPrompt,
					baseImagePrompt: parsed.data.baseImagePrompt,
					ourDreamFields: parsed.data.ourDreamFields,
					...(payload.confirmedMeasurements
						? { confirmedMeasurements: payload.confirmedMeasurements }
						: {}),
				},
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:regenerateScenes",
		async (
			_event,
			payload: { id: string; imageModel?: ImageModel },
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			const settings = await getSettings();
			const targetModel =
				payload.imageModel ?? existing.imageModel ?? DEFAULT_IMAGE_MODEL;
			const sceneCount =
				existing.scenes.length > 0 ? existing.scenes.length : 4;

			const sceneConcepts = existing.scenes.length
				? existing.scenes.map((s, i) => `${i + 1}. ${s.sceneName}`).join("\n")
				: "(no prior scenes — invent fresh concepts that fit the character)";

			const synthSummary = [
				`Regenerating the scene set for ${existing.character.firstName} ${existing.character.lastName}.`,
				`Gender: ${existing.character.gender ?? "unspecified"}.`,
				`Difficulty: ${existing.difficulty}.`,
				`Personality: ${existing.character.personalityLabel}.`,
				`Occupation: ${existing.character.occupationLabel}.`,
				`Scenario gist: ${existing.character.scenario.slice(0, 600)}`,
				"",
				`Generate exactly ${sceneCount} scenes preserving the original scene NAMES and concepts below, but written for the new image model. Do NOT invent new scene names — reuse these in order:`,
				sceneConcepts,
			].join("\n");

			const result = await generateScenes({
				runId: nanoid(),
				character: existing.character,
				gatheringSummary: synthSummary,
				superAdmin: settings.superAdmin,
				imageModel: targetModel,
				generationModel: settings.mainModel,
				sceneCount,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? "scenes regeneration failed",
				};
			}

			const updated = await updateCharacter(payload.id, {
				imageModel: targetModel,
				scenes: result.data,
			});
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:upgradeScenes",
		async (_event, payload: { id: string }): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			if (existing.scenes.length === 0) {
				return {
					success: false,
					error: "This character has no scenes to upgrade",
				};
			}

			const settings = await getSettings();
			const targetModel = existing.imageModel ?? DEFAULT_IMAGE_MODEL;
			const result = await generateScenes({
				runId: nanoid(),
				character: existing.character,
				gatheringSummary: buildScenesUpgradeSummary(existing, targetModel),
				superAdmin: settings.superAdmin,
				imageModel: targetModel,
				generationModel: settings.mainModel,
				sceneCount: existing.scenes.length,
				onEvent: emitProgress,
			});
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? "scenes upgrade failed",
				};
			}

			const scenes = result.data.map((scene, index) => ({
				...scene,
				sceneName: existing.scenes[index]?.sceneName ?? scene.sceneName,
			}));
			const updated = await updateCharacter(payload.id, { scenes });
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:regeneratePartial",
		async (
			_event,
			payload: {
				id: string;
				steps: CharacterStepId[];
				regenerateScenes: boolean;
				gatheringSummary: string;
				gatheringMessagesAppend?: UIMessage[];
				confirmedMeasurements?: Measurements;
				confirmedProfile?: ConfirmedProfile;
				imageModel?: ImageModel;
			},
		): Promise<CharacterResult> => {
			const existing = await getCharacter(payload.id);
			if (!existing) {
				return { success: false, error: `Character ${payload.id} not found` };
			}
			if (payload.steps.length === 0 && !payload.regenerateScenes) {
				return {
					success: false,
					error: "No regeneration targets selected",
				};
			}
			const settings = await getSettings();
			const messageLength = existing.messageLength ?? DEFAULT_MESSAGE_LENGTH;
			const targetModel =
				payload.imageModel ?? existing.imageModel ?? DEFAULT_IMAGE_MODEL;
			const summary = withConfirmedMeasurements(
				payload.gatheringSummary,
				payload.confirmedMeasurements,
			);

			const stepOutcomes = await Promise.all(
				payload.steps.map(async (stepId) => {
					const result = await generateCharacterStep({
						runId: nanoid(),
						stepId,
						difficulty: existing.difficulty,
						messageLength,
						imageModel: targetModel,
						generationModel:
							stepId === "visual" ? settings.fastModel : settings.mainModel,
						gatheringSummary: summary,
						superAdmin: settings.superAdmin,
						confirmedProfile: payload.confirmedProfile,
						onEvent: emitProgress,
					});
					return { stepId, result };
				}),
			);

			for (const { stepId, result } of stepOutcomes) {
				if (!result.success) {
					return {
						success: false,
						error: result.error ?? `${stepId} regeneration failed`,
					};
				}
			}

			const characterPatch: Partial<Character> = {};
			for (const { stepId, result } of stepOutcomes) {
				if (!result.success) continue;
				switch (stepId) {
					case "light": {
						const parsed = characterLightSchema.safeParse(result.data);
						if (!parsed.success) {
							return {
								success: false,
								error: `light schema validation failed: ${parsed.error.message}`,
							};
						}
						characterPatch.moodAxes = parsed.data.moodAxes;
						characterPatch.difficultyProfile = parsed.data.difficultyProfile;
						characterPatch.intimacyProfile = parsed.data.intimacyProfile;
						break;
					}
					case "scenario": {
						const parsed = scenarioOnlySchema.safeParse(result.data);
						if (!parsed.success) {
							return {
								success: false,
								error: `scenario schema validation failed: ${parsed.error.message}`,
							};
						}
						characterPatch.scenario = parsed.data.scenario;
						break;
					}
					case "personality": {
						const parsed = personalityOnlySchema.safeParse(result.data);
						if (!parsed.success) {
							return {
								success: false,
								error: `personality schema validation failed: ${parsed.error.message}`,
							};
						}
						characterPatch.additionalPersonalityDetails =
							parsed.data.additionalPersonalityDetails;
						break;
					}
					case "extras": {
						const parsed = extraDetailsOnlySchema.safeParse(result.data);
						if (!parsed.success) {
							return {
								success: false,
								error: `extras schema validation failed: ${parsed.error.message}`,
							};
						}
						characterPatch.extraDetails = parsed.data.extraDetails;
						break;
					}
					case "visual": {
						const parsed = characterVisualSchema.safeParse(result.data);
						if (!parsed.success) {
							return {
								success: false,
								error: `visual schema validation failed: ${parsed.error.message}`,
							};
						}
						characterPatch.age = parsed.data.age;
						characterPatch.customPhysicalDetails =
							parsed.data.customPhysicalDetails;
						characterPatch.customFaceDetails = parsed.data.customFaceDetails;
						characterPatch.baseGenerationPrompt =
							parsed.data.baseGenerationPrompt;
						characterPatch.baseImagePrompt = parsed.data.baseImagePrompt;
						characterPatch.ourDreamFields = parsed.data.ourDreamFields;
						break;
					}
				}
			}
			if (payload.confirmedMeasurements) {
				characterPatch.confirmedMeasurements = payload.confirmedMeasurements;
			}

			let scenesPatch: Scene[] | undefined;
			if (payload.regenerateScenes) {
				const mergedCharacter: Character = {
					...existing.character,
					...characterPatch,
				};
				const sceneCount =
					existing.scenes.length > 0 ? existing.scenes.length : 4;
				const sceneConcepts = existing.scenes.length
					? existing.scenes.map((s, i) => `${i + 1}. ${s.sceneName}`).join("\n")
					: "(no prior scenes — invent fresh concepts that fit the character)";
				const synthSummary = [
					`Regenerating the scene set for ${mergedCharacter.firstName} ${mergedCharacter.lastName}.`,
					`Gender: ${mergedCharacter.gender ?? "unspecified"}.`,
					`Difficulty: ${existing.difficulty}.`,
					`Personality: ${mergedCharacter.personalityLabel}.`,
					`Occupation: ${mergedCharacter.occupationLabel}.`,
					`Scenario gist: ${mergedCharacter.scenario.slice(0, 600)}`,
					"",
					`Generate exactly ${sceneCount} scenes preserving the original scene NAMES and concepts below, but written for the new image model. Do NOT invent new scene names — reuse these in order:`,
					sceneConcepts,
				].join("\n");
				const sceneRes = await generateScenes({
					runId: nanoid(),
					character: mergedCharacter,
					gatheringSummary: synthSummary,
					superAdmin: settings.superAdmin,
					imageModel: targetModel,
					generationModel: settings.mainModel,
					sceneCount,
					onEvent: emitProgress,
				});
				if (!sceneRes.success) {
					return {
						success: false,
						error: sceneRes.error ?? "scenes regeneration failed",
					};
				}
				scenesPatch = sceneRes.data;
			}

			const updates: Partial<Omit<StoredCharacter, "id" | "createdAt">> = {};
			if (Object.keys(characterPatch).length > 0) {
				updates.character = { ...existing.character, ...characterPatch };
			}
			if (scenesPatch) {
				updates.scenes = scenesPatch;
			}
			if (payload.imageModel && payload.imageModel !== existing.imageModel) {
				updates.imageModel = payload.imageModel;
			}
			if (payload.confirmedProfile) {
				updates.confirmedProfile = payload.confirmedProfile;
			}
			if (
				payload.gatheringMessagesAppend &&
				payload.gatheringMessagesAppend.length > 0
			) {
				updates.gatheringMessages = [
					...(existing.gatheringMessages ?? []),
					...payload.gatheringMessagesAppend,
				];
			}
			// gatheringSummary is intentionally never touched here — the original
			// stays the source of truth; appended review-chat messages live in
			// gatheringMessages and feed the next regen via the live summary.

			const updated = await updateCharacter(payload.id, updates);
			return { success: true, stored: updated };
		},
	);

	ipcMain.handle(
		"characters:appendGatheringMessages",
		async (
			_event,
			payload: { id: string; messages: UIMessage[] },
		): Promise<StoredCharacter | null> => {
			if (!payload.messages || payload.messages.length === 0) {
				return getCharacter(payload.id);
			}
			const existing = await getCharacter(payload.id);
			if (!existing) return null;
			return updateCharacter(payload.id, {
				gatheringMessages: [
					...(existing.gatheringMessages ?? []),
					...payload.messages,
				],
			});
		},
	);
}
