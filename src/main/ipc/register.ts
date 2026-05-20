import { promises as fs } from "node:fs";
import { basename } from "node:path";
import { type BrowserWindow, dialog, ipcMain, shell } from "electron";
import { nanoid } from "nanoid";
import {
  anyCharacterPortFileSchema,
  CHARACTER_BUNDLE_KIND,
  CHARACTER_PORT_KIND,
  CHARACTER_PORT_VERSION,
  type ExportResponse,
  type ImportFileOutcome,
  type ImportResponse,
  type PortableCharacter,
} from "@shared/character-port";
import type { UIMessage } from "@shared/chat";
import type { Draft } from "@shared/drafts";
import type {
  AppSettings,
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
} from "@shared/schemas";
import { DEFAULT_IMAGE_MODEL, DEFAULT_MESSAGE_LENGTH } from "@shared/schemas";
import type {
  GenerateCharacterAllResponse,
  GenerateCharacterStepResponse,
  GenerateProgressEvent,
  GenerateScenesResponse,
  GenerateSingleSceneResponse,
} from "@shared/generate";
import {
  generateCharacter,
  generateCharacterStep,
  inferMeasurements,
  inferProfile,
} from "../agent/generate-character";
import { generateScenes, generateSingleScene } from "../agent/generate-scenes";
import {
  type GatherFlow,
  sendToSession,
  startSession,
  stopSession,
  submitToolOutput,
} from "../agent/session";
import { checkClaudeAvailable } from "../claude/runner";
import {
  appendSceneToCharacter,
  replaceSceneInCharacter,
  deleteCharacter,
  getCharacter,
  importPortableCharacters,
  listCharacters,
  saveCharacter,
  toPortableCharacter,
  updateCharacter,
  updateCharacterScenes,
} from "../storage/characters";
import {
  deleteDraft,
  getDraft,
  getLatestDraft,
  listDrafts,
  saveDraft,
} from "../storage/drafts";
import { extractOurDreamProfileImage } from "../storage/ourdream";
import { getSettings, updateSettings } from "../storage/settings";
import { checkForUpdate, type UpdateInfo } from "../updates/check";

const APP_TAG = "ai-character-creator";

function safeFilenameSegment(input: string, fallback: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned.length > 0 ? cleaned.slice(0, 60) : fallback;
}

function characterFilename(c: PortableCharacter): string {
  const first = safeFilenameSegment(c.character.firstName, "character");
  const last = safeFilenameSegment(c.character.lastName, "");
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = last ? `${first}-${last}` : first;
  return `${slug}-${stamp}.character.json`;
}

function withConfirmedMeasurements(
  gatheringSummary: string,
  measurements?: Measurements
): string {
  if (!measurements) return gatheringSummary;
  const block = [
    "## CONFIRMED MEASUREMENTS (use these EXACT values, do not change)",
    `- Height: ${measurements.heightCm} cm`,
    `- Bust: ${measurements.bustCm} cm`,
    `- Cup size: ${measurements.cupSize}`,
    `- Waist: ${measurements.waistCm} cm`,
    `- Hips: ${measurements.hipsCm} cm`,
  ].join("\n");
  return `${gatheringSummary}\n\n${block}`;
}

export function registerIpc(window: BrowserWindow): void {
  const emitProgress = (event: GenerateProgressEvent) => {
    if (window.isDestroyed()) return;
    window.webContents.send("generate:progress", event);
  };

  ipcMain.handle("claude:check", async () => {
    return checkClaudeAvailable();
  });

  ipcMain.handle("updates:check", async (): Promise<UpdateInfo> => {
    return checkForUpdate();
  });

  ipcMain.handle("window:minimize", () => {
    if (!window.isDestroyed()) window.minimize();
  });

  ipcMain.handle("window:toggleMaximize", () => {
    if (window.isDestroyed()) return { maximized: false };
    if (window.isMaximized()) {
      window.unmaximize();
      return { maximized: false };
    }
    window.maximize();
    return { maximized: true };
  });

  ipcMain.handle("window:close", () => {
    if (!window.isDestroyed()) window.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return window.isDestroyed() ? false : window.isMaximized();
  });

  const emitMaximizeChange = (maximized: boolean) => {
    if (window.isDestroyed()) return;
    window.webContents.send("window:maximizeChange", maximized);
  };
  window.on("maximize", () => emitMaximizeChange(true));
  window.on("unmaximize", () => emitMaximizeChange(false));

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
    async (
      _event,
      payload: { ids: string[] }
    ): Promise<ExportResponse> => {
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
        title: isSingle ? "Export character" : `Export ${selected.length} characters`,
        defaultPath: defaultName,
        filters: [{ name: "Character JSON", extensions: ["json"] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const exportedAt = new Date().toISOString();
      const file = isSingle && selected[0]
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
          "utf-8"
        );
        return { success: true, path: result.filePath, count: selected.length };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

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
            error:
              parsed.error.issues[0]?.message ?? "Invalid character file",
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

  ipcMain.handle(
    "characters:import",
    async (): Promise<ImportResponse> => {
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
    }
  );

  ipcMain.handle(
    "characters:importFromPaths",
    async (_event, payload: { paths: string[] }): Promise<ImportResponse> => {
      if (!payload.paths || payload.paths.length === 0) {
        return { success: false, error: "No files supplied" };
      }
      return runImport(payload.paths);
    }
  );

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

  ipcMain.handle(
    "shell:showInFolder",
    async (_event, path: string): Promise<{ ok: boolean }> => {
      try {
        shell.showItemInFolder(path);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }
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
      }
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
    }
  );

  ipcMain.handle(
    "characters:updateImageModel",
    async (_event, payload: { id: string; imageModel: ImageModel }) => {
      return updateCharacter(payload.id, { imageModel: payload.imageModel });
    }
  );

  ipcMain.handle(
    "characters:updateDifficulty",
    async (_event, payload: { id: string; difficulty: Difficulty }) => {
      return updateCharacter(payload.id, { difficulty: payload.difficulty });
    }
  );

  ipcMain.handle(
    "characters:updateOurdreamUrl",
    async (
      _event,
      payload: { id: string; ourdreamUrl: string | null }
    ): Promise<
      | { success: true; stored: StoredCharacter }
      | { success: false; error: string }
    > => {
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
    }
  );

  ipcMain.handle(
    "characters:refreshProfileImage",
    async (
      _event,
      payload: { id: string }
    ): Promise<
      | { success: true; stored: StoredCharacter }
      | { success: false; error: string }
    > => {
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
    }
  );

  ipcMain.handle(
    "characters:updateScenes",
    async (_event, payload: { id: string; scenes: Scene[] }) => {
      await updateCharacterScenes(payload.id, payload.scenes);
      return getCharacter(payload.id);
    }
  );

  ipcMain.handle(
    "characters:appendScene",
    async (_event, payload: { id: string; scene: Scene }) => {
      await appendSceneToCharacter(payload.id, payload.scene);
      return getCharacter(payload.id);
    }
  );

  ipcMain.handle(
    "characters:replaceScene",
    async (
      _event,
      payload: { id: string; sceneIndex: number; scene: Scene }
    ) => {
      await replaceSceneInCharacter(payload.id, payload.sceneIndex, payload.scene);
      return getCharacter(payload.id);
    }
  );

  ipcMain.handle(
    "characters:updateGatheringMessages",
    async (
      _event,
      payload: {
        id: string;
        gatheringMessages?: UIMessage[];
        sceneGatheringMessages?: UIMessage[];
      }
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
    }
  );

  ipcMain.handle(
    "drafts:save",
    async (_event, draft: Draft): Promise<Draft> => {
      return saveDraft(draft);
    }
  );

  ipcMain.handle(
    "drafts:get",
    async (_event, id: string): Promise<Draft | null> => {
      return getDraft(id);
    }
  );

  ipcMain.handle(
    "drafts:getLatest",
    async (): Promise<Draft | null> => {
      return getLatestDraft();
    }
  );

  ipcMain.handle(
    "drafts:list",
    async (): Promise<Draft[]> => {
      return listDrafts();
    }
  );

  ipcMain.handle(
    "drafts:delete",
    async (_event, id: string): Promise<void> => {
      await deleteDraft(id);
    }
  );

  ipcMain.handle("settings:get", async (): Promise<AppSettings> => {
    return getSettings();
  });

  ipcMain.handle(
    "settings:update",
    async (_event, partial: Partial<AppSettings>): Promise<AppSettings> => {
      return updateSettings(partial);
    }
  );

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
      }
    ): Promise<GenerateCharacterAllResponse> => {
      const settings = await getSettings();
      const messageLength = payload.messageLength ?? DEFAULT_MESSAGE_LENGTH;
      const summaryWithMeasurements = withConfirmedMeasurements(
        payload.gatheringSummary,
        payload.confirmedMeasurements
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
            cacheCreationTokens: acc.cacheCreationTokens + r.usage.cacheCreationTokens,
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
        }
      );

      return { success: true, stored, usageTotal };
    }
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
      }
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
          payload.confirmedMeasurements
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
    }
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
      }
    ) => {
      const { characterSchema } = await import("@shared/schemas");
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
    }
  );

  ipcMain.handle(
    "generate:measurements:infer",
    async (
      _event,
      payload: { gatheringSummary: string }
    ): Promise<
      | { success: true; measurements: Measurements }
      | { success: false; error: string }
    > => {
      const settings = await getSettings();
      return inferMeasurements({
        gatheringSummary: payload.gatheringSummary,
        generationModel: settings.generationModel,
      });
    }
  );

  ipcMain.handle(
    "generate:profile:infer",
    async (
      _event,
      payload: { gatheringSummary: string; difficulty: Difficulty }
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
    }
  );

  ipcMain.handle(
    "characters:updateMessageLength",
    async (
      _event,
      payload: { id: string; messageLength: MessageLength; gatheringSummary: string }
    ) => {
      const existing = await getCharacter(payload.id);
      if (!existing) {
        return { success: false as const, error: `Character ${payload.id} not found` };
      }
      const settings = await getSettings();
      const { scenarioOnlySchema } = await import("@shared/schemas");
      const runId = nanoid();
      const result = await generateCharacterStep({
        runId,
        stepId: "scenario",
        difficulty: existing.difficulty,
        messageLength: payload.messageLength,
        generationModel: settings.generationModel,
        gatheringSummary: payload.gatheringSummary,
        superAdmin: settings.superAdmin,
        onEvent: emitProgress,
      });
      if (!result.success) {
        return {
          success: false as const,
          error: result.error ?? "scenario regeneration failed",
        };
      }
      const parsed = scenarioOnlySchema.safeParse(result.data);
      if (!parsed.success) {
        return {
          success: false as const,
          error: `scenario schema validation failed: ${parsed.error.message}`,
        };
      }
      const updated = await updateCharacter(payload.id, {
        messageLength: payload.messageLength,
        character: { ...existing.character, scenario: parsed.data.scenario },
      });
      return { success: true as const, stored: updated };
    }
  );

  ipcMain.handle(
    "characters:regenerateMoodAxes",
    async (
      _event,
      payload: { id: string; gatheringSummary: string }
    ) => {
      const existing = await getCharacter(payload.id);
      if (!existing) {
        return { success: false as const, error: `Character ${payload.id} not found` };
      }
      const settings = await getSettings();
      const { characterLightSchema } = await import("@shared/schemas");
      const runId = nanoid();
      const result = await generateCharacterStep({
        runId,
        stepId: "light",
        difficulty: existing.difficulty,
        messageLength: existing.messageLength ?? DEFAULT_MESSAGE_LENGTH,
        generationModel: settings.generationModel,
        gatheringSummary: payload.gatheringSummary,
        superAdmin: settings.superAdmin,
        onEvent: emitProgress,
      });
      if (!result.success) {
        return {
          success: false as const,
          error: result.error ?? "light regeneration failed",
        };
      }
      const parsed = characterLightSchema.safeParse(result.data);
      if (!parsed.success) {
        return {
          success: false as const,
          error: `light schema validation failed: ${parsed.error.message}`,
        };
      }
      const updated = await updateCharacter(payload.id, {
        character: { ...existing.character, moodAxes: parsed.data.moodAxes },
      });
      return { success: true as const, stored: updated };
    }
  );

  ipcMain.handle(
    "characters:regenerateForDifficulty",
    async (
      _event,
      payload: { id: string; difficulty: Difficulty; gatheringSummary: string }
    ) => {
      const existing = await getCharacter(payload.id);
      if (!existing) {
        return { success: false as const, error: `Character ${payload.id} not found` };
      }
      const settings = await getSettings();
      const { characterLightSchema, scenarioOnlySchema } = await import(
        "@shared/schemas"
      );
      const messageLength = existing.messageLength ?? DEFAULT_MESSAGE_LENGTH;

      const lightRes = await generateCharacterStep({
        runId: nanoid(),
        stepId: "light",
        difficulty: payload.difficulty,
        messageLength,
        generationModel: settings.generationModel,
        gatheringSummary: payload.gatheringSummary,
        superAdmin: settings.superAdmin,
        onEvent: emitProgress,
      });
      if (!lightRes.success) {
        return {
          success: false as const,
          error: lightRes.error ?? "light regeneration failed",
        };
      }
      const lightParsed = characterLightSchema.safeParse(lightRes.data);
      if (!lightParsed.success) {
        return {
          success: false as const,
          error: `light schema validation failed: ${lightParsed.error.message}`,
        };
      }

      const scenarioRes = await generateCharacterStep({
        runId: nanoid(),
        stepId: "scenario",
        difficulty: payload.difficulty,
        messageLength,
        generationModel: settings.generationModel,
        gatheringSummary: payload.gatheringSummary,
        superAdmin: settings.superAdmin,
        onEvent: emitProgress,
      });
      if (!scenarioRes.success) {
        return {
          success: false as const,
          error: scenarioRes.error ?? "scenario regeneration failed",
        };
      }
      const scenarioParsed = scenarioOnlySchema.safeParse(scenarioRes.data);
      if (!scenarioParsed.success) {
        return {
          success: false as const,
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
      return { success: true as const, stored: updated };
    }
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
      }
    ) => {
      const existing = await getCharacter(payload.id);
      if (!existing) {
        return { success: false as const, error: `Character ${payload.id} not found` };
      }
      const settings = await getSettings();
      const { characterVisualSchema } = await import("@shared/schemas");
      const targetModel =
        payload.imageModel ?? existing.imageModel ?? DEFAULT_IMAGE_MODEL;
      const result = await generateCharacterStep({
        runId: nanoid(),
        stepId: "visual",
        difficulty: existing.difficulty,
        messageLength: existing.messageLength ?? DEFAULT_MESSAGE_LENGTH,
        imageModel: targetModel,
        generationModel: settings.generationModel,
        gatheringSummary: withConfirmedMeasurements(
          payload.gatheringSummary,
          payload.confirmedMeasurements
        ),
        superAdmin: settings.superAdmin,
        confirmedProfile: payload.confirmedProfile,
        onEvent: emitProgress,
      });
      if (!result.success) {
        return {
          success: false as const,
          error: result.error ?? "visual regeneration failed",
        };
      }
      const parsed = characterVisualSchema.safeParse(result.data);
      if (!parsed.success) {
        return {
          success: false as const,
          error: `visual schema validation failed: ${parsed.error.message}`,
        };
      }
      const updated = await updateCharacter(payload.id, {
        imageModel: targetModel,
        gatheringSummary: payload.gatheringSummary,
        confirmedProfile: payload.confirmedProfile ?? existing.confirmedProfile,
        character: {
          ...existing.character,
          customPhysicalDetails: parsed.data.customPhysicalDetails,
          customFaceDetails: parsed.data.customFaceDetails,
          baseGenerationPrompt: parsed.data.baseGenerationPrompt,
          baseImagePrompt: parsed.data.baseImagePrompt,
          ...(payload.confirmedMeasurements
            ? { confirmedMeasurements: payload.confirmedMeasurements }
            : {}),
        },
      });
      return { success: true as const, stored: updated };
    }
  );

  ipcMain.handle(
    "characters:regenerateScenes",
    async (
      _event,
      payload: { id: string; imageModel?: ImageModel }
    ) => {
      const existing = await getCharacter(payload.id);
      if (!existing) {
        return { success: false as const, error: `Character ${payload.id} not found` };
      }
      const settings = await getSettings();
      const targetModel =
        payload.imageModel ?? existing.imageModel ?? DEFAULT_IMAGE_MODEL;
      const sceneCount = existing.scenes.length > 0 ? existing.scenes.length : 4;

      const sceneConcepts = existing.scenes.length
        ? existing.scenes
            .map((s, i) => `${i + 1}. ${s.sceneName}`)
            .join("\n")
        : "(no prior scenes — invent fresh concepts that fit the character)";

      const synthSummary = [
        `Regenerating the scene set for ${existing.character.firstName} ${existing.character.lastName}.`,
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
        generationModel: settings.generationModel,
        sceneCount,
        onEvent: emitProgress,
      });
      if (!result.success) {
        return {
          success: false as const,
          error: result.error ?? "scenes regeneration failed",
        };
      }

      const updated = await updateCharacter(payload.id, {
        imageModel: targetModel,
        scenes: result.data,
      });
      return { success: true as const, stored: updated };
    }
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
      }
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
    }
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
      }
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
    }
  );

  ipcMain.handle(
    "chat:start",
    async (
      _event,
      payload: (
        | { flow: "gather-character"; initialUserMessage: string }
        | {
            flow: "gather-scenes";
            character: Character;
            initialUserMessage: string;
          }
        | {
            flow: "gather-scene";
            character: Character;
            existingScenes: Scene[];
            initialUserMessage: string;
          }
        | {
            flow: "refine-scene";
            character: Character;
            existingScenes: Scene[];
            targetScene: Scene;
            initialUserMessage: string;
          }
        | {
            flow: "gather-regenerate";
            character: StoredCharacter;
            initialUserMessage: string;
          }
      ) & { sessionId?: string }
    ) => {
      try {
        let gatherFlow: GatherFlow;
        if (payload.flow === "gather-character") {
          gatherFlow = { flow: "gather-character" };
        } else if (payload.flow === "gather-scenes") {
          gatherFlow = {
            flow: "gather-scenes",
            character: payload.character,
          };
        } else if (payload.flow === "gather-scene") {
          gatherFlow = {
            flow: "gather-scene",
            character: payload.character,
            existingScenes: payload.existingScenes,
          };
        } else if (payload.flow === "refine-scene") {
          gatherFlow = {
            flow: "refine-scene",
            character: payload.character,
            existingScenes: payload.existingScenes,
            targetScene: payload.targetScene,
          };
        } else {
          gatherFlow = { flow: "gather-regenerate", character: payload.character };
        }
        const settings = await getSettings();
        const { sessionId } = await startSession(
          gatherFlow,
          window,
          payload.initialUserMessage,
          undefined,
          settings.generationModel,
          payload.sessionId
        );
        return { success: true, sessionId };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  );

  ipcMain.handle(
    "chat:send",
    async (_event, payload: { sessionId: string; text: string }) => {
      sendToSession(payload.sessionId, payload.text);
    }
  );

  ipcMain.handle(
    "chat:tool-output",
    async (
      _event,
      payload: { sessionId: string; toolCallId: string; output: string }
    ) => {
      submitToolOutput(payload.sessionId, payload.toolCallId, payload.output);
    }
  );

  ipcMain.handle("chat:stop", async (_event, sessionId: string) => {
    stopSession(sessionId);
  });

  ipcMain.handle(
    "chat:restart",
    async (
      _event,
      payload: (
        | {
            sessionId?: string;
            oldSessionId?: string;
            flow: "gather-character";
            replayTranscript: string;
            newMessage: string;
          }
        | {
            sessionId?: string;
            oldSessionId?: string;
            flow: "gather-scenes";
            character: Character;
            replayTranscript: string;
            newMessage: string;
          }
        | {
            sessionId?: string;
            oldSessionId?: string;
            flow: "gather-scene";
            character: Character;
            existingScenes: Scene[];
            replayTranscript: string;
            newMessage: string;
          }
        | {
            sessionId?: string;
            oldSessionId?: string;
            flow: "refine-scene";
            character: Character;
            existingScenes: Scene[];
            targetScene: Scene;
            replayTranscript: string;
            newMessage: string;
          }
        | {
            sessionId?: string;
            oldSessionId?: string;
            flow: "gather-regenerate";
            character: StoredCharacter;
            replayTranscript: string;
            newMessage: string;
          }
      )
    ) => {
      if (payload.oldSessionId) stopSession(payload.oldSessionId);
      try {
        let gatherFlow: GatherFlow;
        if (payload.flow === "gather-character") {
          gatherFlow = { flow: "gather-character" };
        } else if (payload.flow === "gather-scenes") {
          gatherFlow = {
            flow: "gather-scenes",
            character: payload.character,
          };
        } else if (payload.flow === "gather-scene") {
          gatherFlow = {
            flow: "gather-scene",
            character: payload.character,
            existingScenes: payload.existingScenes,
          };
        } else if (payload.flow === "refine-scene") {
          gatherFlow = {
            flow: "refine-scene",
            character: payload.character,
            existingScenes: payload.existingScenes,
            targetScene: payload.targetScene,
          };
        } else {
          gatherFlow = { flow: "gather-regenerate", character: payload.character };
        }
        const settings = await getSettings();
        const { sessionId } = await startSession(
          gatherFlow,
          window,
          payload.newMessage,
          payload.replayTranscript,
          settings.generationModel,
          payload.sessionId
        );
        return { success: true as const, sessionId };
      } catch (err) {
        console.error("[chat:restart] failed", err);
        return { success: false as const, error: String(err) };
      }
    }
  );
}
