import { z } from "zod";
import {
  applySuperAdminOverride,
  buildSceneGenerationPrompt,
  buildSingleSceneGenerationPrompt,
} from "@shared/prompts";
import {
  type Character,
  clampSceneCount,
  DEFAULT_GENERATION_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SCENE_COUNT,
  type GenerationModel,
  type ImageModel,
  type Scene,
  scenesOutputSchema,
  singleSceneOutputSchema,
} from "@shared/schemas";
import type { GenerateProgressEvent, StepResult, StepUsage } from "@shared/generate";
import { ClaudeAuthError, type ClaudeModel, type ClaudeRunResult, runClaude } from "../claude/runner";

export interface GenerateScenesInput {
  character: Character;
  gatheringSummary: string;
  superAdmin: boolean;
  runId: string;
  imageModel?: ImageModel;
  generationModel?: GenerationModel;
  sceneCount?: number;
  onEvent?: (event: GenerateProgressEvent) => void;
}

const SCENES_REFUSAL_PATTERN =
  /\b(I (can('?| no)t|am unable|won'?t)|I (must|have to) (decline|refuse)|I'm not (able|going to|comfortable)|content (policy|guidelines)|inappropriate|out[- ]of[- ]character|doesn'?t (fit|match|align) (with )?(the|this) (character|personality)|inconsistent with|not (consistent|aligned) with|hors[- ]caract|ne (correspond|colle) pas (au|\u00e0)|incoh[\u00e9e]rent|d[\u00e9e]sol[\u00e9e], je)/i;

function extractUsage(
  model: ClaudeModel,
  result: ClaudeRunResult,
  startedAt: number
): StepUsage | undefined {
  const raw = result.rawResultEvent;
  if (!raw) return undefined;
  const usage = (raw.usage as Record<string, unknown> | undefined) ?? undefined;
  const input = Number(usage?.input_tokens ?? 0);
  const output = Number(usage?.output_tokens ?? 0);
  const cacheRead = Number(usage?.cache_read_input_tokens ?? 0);
  const cacheCreation = Number(usage?.cache_creation_input_tokens ?? 0);
  const cost = Number(raw.total_cost_usd ?? 0);
  const duration = Number(raw.duration_ms ?? Date.now() - startedAt);
  return {
    model,
    inputTokens: Number.isFinite(input) ? input : 0,
    outputTokens: Number.isFinite(output) ? output : 0,
    cacheReadTokens: Number.isFinite(cacheRead) ? cacheRead : 0,
    cacheCreationTokens: Number.isFinite(cacheCreation) ? cacheCreation : 0,
    costUsd: Number.isFinite(cost) ? cost : 0,
    durationMs: Number.isFinite(duration) ? duration : Date.now() - startedAt,
  };
}

async function runScenesOnce(
  character: Character,
  gatheringSummary: string,
  superAdmin: boolean,
  imageModel: ImageModel,
  generationModel: ClaudeModel,
  enforcedCount: number | undefined
): Promise<
  | { ok: true; scenes: Scene[]; usage?: StepUsage }
  | { ok: false; error: string; refusal: boolean; usage?: StepUsage }
> {
  const model: ClaudeModel = generationModel;
  // When the caller doesn't impose a count (new gather-driven flow), pass a hint of 0 so
  // buildSceneGenerationPrompt knows to defer the count to the gathering summary.
  const promptCount = enforcedCount ?? 0;
  const baseSystem = buildSceneGenerationPrompt(character, imageModel, promptCount);
  const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
  const jsonSchema = z.toJSONSchema(scenesOutputSchema);
  const userMessage = [
    "Here is the full gathering conversation summary for the scenes:",
    "",
    gatheringSummary,
    "",
    enforcedCount !== undefined
      ? `Now generate exactly ${enforcedCount} scenes as a structured JSON object matching the schema.`
      : "Now generate one entry per scene finalized in the gathering summary above, as a structured JSON object matching the schema. The `scenes` array MUST contain exactly the scenes the user selected — no more, no fewer.",
    enforcedCount !== undefined
      ? `The \`scenes\` array MUST have exactly ${enforcedCount} items — not more, not fewer.`
      : "Match the final count from the summary precisely. If the summary lists 3 scenes, return 3; if it lists 7, return 7.",
    "Each scene MUST include `sceneName` (short descriptive name), `prompt` (full image prompt) AND `negativePrompt` (8-15 comma-separated tags of things to avoid — supported by ALL image models now, not just Dreamy).",
    "Do NOT omit `sceneName` or `negativePrompt` — both are required and missing fields will fail schema validation.",
  ].join("\n");

  const startedAt = Date.now();
  let result: ClaudeRunResult;
  try {
    result = await runClaude({
      model,
      systemPrompt,
      userMessage,
      jsonSchema,
      stepLabel: "scenes",
    });
  } catch (err) {
    const isAuth = err instanceof ClaudeAuthError;
    const prefix = isAuth ? "AUTH: " : "runClaude threw: ";
    console.error("[generate-scenes:exception]", {
      isAuth,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { ok: false, error: prefix + String(err), refusal: false };
  }

  const usage = extractUsage(model, result, startedAt);

  if (!result.success || !result.structuredOutput) {
    const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
    const refusal = SCENES_REFUSAL_PATTERN.test(text);
    const details =
      result.error ??
      (result.finalAssistantText
        ? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
        : undefined) ??
      (result.rawResultEvent
        ? `no structured output — result event: ${JSON.stringify(result.rawResultEvent).slice(0, 500)}`
        : undefined) ??
      "scene generation failed with no details (check main process logs)";
    const trunc = (v: unknown, max = 1500): string => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (!s) return "";
      return s.length > max ? `${s.slice(0, max)}…(${s.length - max} more chars)` : s;
    };
    console.error("[generate-scenes:failed]", {
      error: trunc(result.error, 1500),
      finalAssistantText: trunc(result.finalAssistantText, 1000),
      rawResultEvent: trunc(result.rawResultEvent, 1500),
    });
    return {
      ok: false,
      error: details,
      refusal,
      usage,
    };
  }

  const parsed = scenesOutputSchema.safeParse(result.structuredOutput);
  if (!parsed.success) {
    const refusal = SCENES_REFUSAL_PATTERN.test(result.finalAssistantText ?? "");
    return {
      ok: false,
      error: `Schema validation failed: ${parsed.error.message}`,
      refusal,
      usage,
    };
  }

  if (enforcedCount !== undefined && parsed.data.scenes.length !== enforcedCount) {
    return {
      ok: false,
      error: `Model returned ${parsed.data.scenes.length} scenes but ${enforcedCount} were requested`,
      refusal: false,
      usage,
    };
  }

  return { ok: true, scenes: parsed.data.scenes, usage };
}

export async function generateScenes(
  input: GenerateScenesInput
): Promise<StepResult<Scene[]>> {
  const { character, gatheringSummary, superAdmin, runId, onEvent } = input;
  const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
  const generationModel: ClaudeModel = input.generationModel ?? DEFAULT_GENERATION_MODEL;
  // sceneCount is only enforced when the caller explicitly passes one (regeneration path).
  // When undefined, the model picks the count from the gathering summary itself.
  const enforcedCount =
    typeof input.sceneCount === "number" ? clampSceneCount(input.sceneCount) : undefined;

  onEvent?.({ runId, kind: "scenes", step: "scenes", status: "started" });

  const first = await runScenesOnce(
    character,
    gatheringSummary,
    superAdmin,
    imageModel,
    generationModel,
    enforcedCount
  );

  if (first.ok) {
    onEvent?.({
      runId,
      kind: "scenes",
      step: "scenes",
      status: "succeeded",
      usage: first.usage,
      adminOverrideApplied: superAdmin,
    });
    return {
      success: true,
      data: first.scenes,
      usage: first.usage,
      adminOverrideApplied: superAdmin,
    };
  }

  if (first.refusal) {
    onEvent?.({
      runId,
      kind: "scenes",
      step: "scenes",
      status: "refusal-detected",
      error: first.error,
      usage: first.usage,
    });

    if (superAdmin) {
      console.log(`[generate-scenes] refusal detected under super-admin — retrying with reinforced override`);
      const retry = await runScenesOnce(
        character,
        gatheringSummary,
        true,
        imageModel,
        generationModel,
        enforcedCount
      );
      if (retry.ok) {
        onEvent?.({
          runId,
          kind: "scenes",
          step: "scenes",
          status: "succeeded",
          usage: retry.usage,
          adminOverrideApplied: true,
        });
        return {
          success: true,
          data: retry.scenes,
          usage: retry.usage,
          adminOverrideApplied: true,
        };
      }
      onEvent?.({
        runId,
        kind: "scenes",
        step: "scenes",
        status: "failed",
        error: retry.error,
        usage: retry.usage,
        adminOverrideApplied: true,
      });
      return {
        success: false,
        error: retry.error,
        refusal: retry.refusal,
        usage: retry.usage,
        adminOverrideApplied: true,
      };
    }

    return {
      success: false,
      error: first.error,
      refusal: true,
      usage: first.usage,
      adminOverrideApplied: false,
    };
  }

  onEvent?.({
    runId,
    kind: "scenes",
    step: "scenes",
    status: "failed",
    error: first.error,
    usage: first.usage,
    adminOverrideApplied: superAdmin,
  });
  return {
    success: false,
    error: first.error,
    usage: first.usage,
    adminOverrideApplied: superAdmin,
  };
}

export interface GenerateSingleSceneInput {
  character: Character;
  existingScenes: Scene[];
  gatheringSummary: string;
  superAdmin: boolean;
  runId: string;
  imageModel?: ImageModel;
  generationModel?: GenerationModel;
  onEvent?: (event: GenerateProgressEvent) => void;
}

async function runSingleSceneOnce(
  character: Character,
  existingScenes: Scene[],
  gatheringSummary: string,
  superAdmin: boolean,
  imageModel: ImageModel,
  generationModel: ClaudeModel
): Promise<
  | { ok: true; scene: Scene; usage?: StepUsage }
  | { ok: false; error: string; refusal: boolean; usage?: StepUsage }
> {
  const model: ClaudeModel = generationModel;
  const baseSystem = buildSingleSceneGenerationPrompt(character, existingScenes, imageModel);
  const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
  const jsonSchema = z.toJSONSchema(singleSceneOutputSchema);
  const userMessage = [
    "Here is the full gathering conversation summary for the new scene:",
    "",
    gatheringSummary,
    "",
    "Now generate ONE scene as a structured JSON object matching the schema.",
    "The object MUST have a single `scene` field containing `sceneName` (short descriptive name, distinct from existing scenes), `prompt` (full image prompt) AND `negativePrompt` (8-15 comma-separated tags of things to avoid — supported by ALL image models now).",
    "Do NOT return an array or multiple scenes — exactly one scene.",
  ].join("\n");

  const startedAt = Date.now();
  let result: ClaudeRunResult;
  try {
    result = await runClaude({
      model,
      systemPrompt,
      userMessage,
      jsonSchema,
      stepLabel: "scene-single",
    });
  } catch (err) {
    const isAuth = err instanceof ClaudeAuthError;
    const prefix = isAuth ? "AUTH: " : "runClaude threw: ";
    console.error("[generate-scene-single:exception]", {
      isAuth,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { ok: false, error: prefix + String(err), refusal: false };
  }

  const usage = extractUsage(model, result, startedAt);

  if (!result.success || !result.structuredOutput) {
    const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
    const refusal = SCENES_REFUSAL_PATTERN.test(text);
    const details =
      result.error ??
      (result.finalAssistantText
        ? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
        : undefined) ??
      (result.rawResultEvent
        ? `no structured output — result event: ${JSON.stringify(result.rawResultEvent).slice(0, 500)}`
        : undefined) ??
      "single-scene generation failed with no details (check main process logs)";
    console.error("[generate-scene-single:failed]", { error: details });
    return { ok: false, error: details, refusal, usage };
  }

  const parsed = singleSceneOutputSchema.safeParse(result.structuredOutput);
  if (!parsed.success) {
    const refusal = SCENES_REFUSAL_PATTERN.test(result.finalAssistantText ?? "");
    return {
      ok: false,
      error: `Schema validation failed: ${parsed.error.message}`,
      refusal,
      usage,
    };
  }

  return { ok: true, scene: parsed.data.scene, usage };
}

export async function generateSingleScene(
  input: GenerateSingleSceneInput
): Promise<StepResult<Scene>> {
  const { character, existingScenes, gatheringSummary, superAdmin, runId, onEvent } = input;
  const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
  const generationModel: ClaudeModel = input.generationModel ?? DEFAULT_GENERATION_MODEL;

  onEvent?.({ runId, kind: "scenes", step: "scenes", status: "started" });

  const first = await runSingleSceneOnce(
    character,
    existingScenes,
    gatheringSummary,
    superAdmin,
    imageModel,
    generationModel
  );

  if (first.ok) {
    onEvent?.({
      runId,
      kind: "scenes",
      step: "scenes",
      status: "succeeded",
      usage: first.usage,
      adminOverrideApplied: superAdmin,
    });
    return {
      success: true,
      data: first.scene,
      usage: first.usage,
      adminOverrideApplied: superAdmin,
    };
  }

  if (first.refusal) {
    onEvent?.({
      runId,
      kind: "scenes",
      step: "scenes",
      status: "refusal-detected",
      error: first.error,
      usage: first.usage,
    });

    if (superAdmin) {
      console.log(
        "[generate-scene-single] refusal detected under super-admin — retrying with reinforced override"
      );
      const retry = await runSingleSceneOnce(
        character,
        existingScenes,
        gatheringSummary,
        true,
        imageModel,
        generationModel
      );
      if (retry.ok) {
        onEvent?.({
          runId,
          kind: "scenes",
          step: "scenes",
          status: "succeeded",
          usage: retry.usage,
          adminOverrideApplied: true,
        });
        return {
          success: true,
          data: retry.scene,
          usage: retry.usage,
          adminOverrideApplied: true,
        };
      }
      onEvent?.({
        runId,
        kind: "scenes",
        step: "scenes",
        status: "failed",
        error: retry.error,
        usage: retry.usage,
        adminOverrideApplied: true,
      });
      return {
        success: false,
        error: retry.error,
        refusal: retry.refusal,
        usage: retry.usage,
        adminOverrideApplied: true,
      };
    }

    return {
      success: false,
      error: first.error,
      refusal: true,
      usage: first.usage,
      adminOverrideApplied: false,
    };
  }

  onEvent?.({
    runId,
    kind: "scenes",
    step: "scenes",
    status: "failed",
    error: first.error,
    usage: first.usage,
    adminOverrideApplied: superAdmin,
  });
  return {
    success: false,
    error: first.error,
    usage: first.usage,
    adminOverrideApplied: superAdmin,
  };
}
