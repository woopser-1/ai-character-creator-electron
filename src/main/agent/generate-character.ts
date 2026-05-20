import { z } from "zod";
import {
  applySuperAdminOverride,
  buildCharacterVisualPromptHaiku,
  buildExtraDetailsPrompt,
  buildLightFieldsPrompt,
  buildMeasurementsInferencePrompt,
  buildPersonalityDetailsPrompt,
  buildProfileInferencePrompt,
  buildScenarioPrompt,
} from "@shared/prompts";
import {
  CHARACTER_STEP_IDS,
  type Character,
  type CharacterProfilePreview,
  characterProfilePreviewSchema,
  type CharacterStepId,
  characterLightSchema,
  characterSchema,
  characterVisualSchema,
  type ConfirmedProfile,
  DEFAULT_GENERATION_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MESSAGE_LENGTH,
  type Difficulty,
  extraDetailsOnlySchema,
  type GenerationModel,
  type ImageModel,
  type Measurements,
  measurementsSchema,
  type MessageLength,
  personalityOnlySchema,
  scenarioOnlySchema,
} from "@shared/schemas";
import type { GenerateProgressEvent, StepResult, StepUsage } from "@shared/generate";
import { ClaudeAuthError, type ClaudeModel, type ClaudeRunResult, runClaude } from "../claude/runner";

export interface GenerateCharacterInput {
  difficulty: Difficulty;
  messageLength?: MessageLength;
  imageModel?: ImageModel;
  generationModel?: GenerationModel;
  gatheringSummary: string;
  superAdmin: boolean;
  runId: string;
  confirmedProfile?: ConfirmedProfile;
  onEvent?: (event: GenerateProgressEvent) => void;
}

function formatConfirmedProfileBlock(profile: ConfirmedProfile): string {
  const lines: string[] = [];
  lines.push("## CONFIRMED PROFILE (user-reviewed — use these values verbatim, do not recompute)");
  lines.push("");
  lines.push("### difficultyProfile");
  const d = profile.difficultyProfile;
  lines.push(`- moodResistance: ${d.moodResistance}`);
  if (d.moodResistanceReasoning) lines.push(`  reasoning: ${d.moodResistanceReasoning}`);
  lines.push(`- trustThreshold: ${d.trustThreshold}`);
  if (d.trustThresholdReasoning) lines.push(`  reasoning: ${d.trustThresholdReasoning}`);
  lines.push(`- personalityRigidity: ${d.personalityRigidity}`);
  if (d.personalityRigidityReasoning) lines.push(`  reasoning: ${d.personalityRigidityReasoning}`);
  lines.push("");
  lines.push("### intimacyProfile");
  const i = profile.intimacyProfile;
  lines.push(`- escalationSpeed: ${i.escalationSpeed}`);
  if (i.escalationSpeedReasoning) lines.push(`  reasoning: ${i.escalationSpeedReasoning}`);
  lines.push(`- sexualConfidence: ${i.sexualConfidence}`);
  if (i.sexualConfidenceReasoning) lines.push(`  reasoning: ${i.sexualConfidenceReasoning}`);
  lines.push(`- emotionalDetachment: ${i.emotionalDetachment}`);
  if (i.emotionalDetachmentReasoning) lines.push(`  reasoning: ${i.emotionalDetachmentReasoning}`);
  lines.push(`- personalityConsistency: ${i.personalityConsistency}`);
  if (i.personalityConsistencyReasoning) lines.push(`  reasoning: ${i.personalityConsistencyReasoning}`);
  lines.push(`- postIntimacyBehavior: ${i.postIntimacyBehavior}`);
  if (i.postIntimacyBehaviorReasoning) lines.push(`  reasoning: ${i.postIntimacyBehaviorReasoning}`);
  lines.push(`- circumstantialTriggers: ${i.circumstantialTriggers}`);
  lines.push("");
  lines.push("### moodAxes");
  const p = profile.moodAxes.primary;
  const s = profile.moodAxes.secondary;
  lines.push(`- primary.label: ${p.label}`);
  lines.push(`- primary.lowDescriptor: ${p.lowDescriptor}`);
  lines.push(`- primary.highDescriptor: ${p.highDescriptor}`);
  lines.push(`- primary.startingValue: ${p.startingValue}`);
  if (p.reasoning) lines.push(`  reasoning: ${p.reasoning}`);
  lines.push(`- secondary.label: ${s.label}`);
  lines.push(`- secondary.lowDescriptor: ${s.lowDescriptor}`);
  lines.push(`- secondary.highDescriptor: ${s.highDescriptor}`);
  lines.push(`- secondary.startingValue: ${s.startingValue}`);
  if (s.reasoning) lines.push(`  reasoning: ${s.reasoning}`);
  if (profile.moodAxes.hidden && profile.moodAxes.hidden.length > 0) {
    profile.moodAxes.hidden.forEach((h, idx) => {
      lines.push(`- hidden[${idx}].label: ${h.label}`);
      lines.push(`- hidden[${idx}].lowDescriptor: ${h.lowDescriptor}`);
      lines.push(`- hidden[${idx}].highDescriptor: ${h.highDescriptor}`);
      lines.push(`- hidden[${idx}].startingValue: ${h.startingValue}`);
      if (h.reasoning) lines.push(`  reasoning: ${h.reasoning}`);
    });
  }
  return lines.join("\n");
}

function augmentGatheringSummary(
  gatheringSummary: string,
  confirmedProfile?: ConfirmedProfile
): string {
  if (!confirmedProfile) return gatheringSummary;
  return [gatheringSummary, "", formatConfirmedProfileBlock(confirmedProfile)].join("\n");
}

export interface GenerateCharacterResult {
  success: boolean;
  character?: Character;
  error?: string;
  stepResults: Partial<Record<CharacterStepId, StepResult<unknown>>>;
}

type AnyZodSchema = z.ZodType<unknown>;

interface StepDefinition<T> {
  label: CharacterStepId;
  buildSystemPrompt: (
    difficulty: Difficulty,
    messageLength: MessageLength,
    imageModel: ImageModel
  ) => string;
  buildUserMessage: (
    gatheringSummary: string,
    difficulty: Difficulty,
    messageLength: MessageLength
  ) => string;
  schema: z.ZodType<T>;
}

const CORE_USER_MESSAGE = (
  gatheringSummary: string,
  difficulty: Difficulty,
  messageLength: MessageLength
): string =>
  [
    "Here is the full gathering conversation summary you produced:",
    "",
    gatheringSummary,
    "",
    `Difficulty: ${difficulty}.`,
    `Message length preference: ${messageLength}.`,
  ].join("\n");

const VISUAL_USER_MESSAGE = (gatheringSummary: string): string =>
  [
    "Here is the full gathering conversation summary:",
    "",
    gatheringSummary,
    "",
    "Now generate ONLY the six visual fields (age, customPhysicalDetails, customFaceDetails, baseGenerationPrompt, baseImagePrompt, ourDreamFields) as structured JSON. The ourDreamFields object MUST include the 9 atomic values (hairStyle, hairColor, bodyType, ethnicity, skinColor, breastSize, buttSize, eyeColor, tags). Produce a single coherent person consistent across all blocks. The integer age MUST match the age phrasing woven into baseGenerationPrompt and baseImagePrompt.",
    "",
    "CRITICAL: respect the explicit physical answers captured in the gathering summary — body type, height, bust size, skin tone, hair color and length, hair texture, eye color, distinguishing features (freckles, tattoos, piercings, scars, glasses, etc.), and style/aesthetic. Do NOT invent contradicting traits. Every physical choice the user made must appear in customPhysicalDetails and customFaceDetails and be reflected (with appropriate weighting) in baseGenerationPrompt and baseImagePrompt.",
    "",
    "CRITICAL (baseGenerationPrompt identity & lifestyle): baseGenerationPrompt MUST explicitly state the character's full name (first + last), her age in numeric form (e.g. \"24 years old\"), and explicit body measurements (height, bust/cup size, waist, hips — either numeric or precise descriptive phrases). It MUST also include, in natural prose, a short phrase for each of these five lifestyle axes drawn from the gathering summary: personality essence, occupation/role, relationship status, main hobby or passion, and intimate/fetish inclination. No axis may be silently omitted.",
  ].join("\n");

const STEP_DEFS: {
  light: StepDefinition<z.infer<typeof characterLightSchema>>;
  scenario: StepDefinition<z.infer<typeof scenarioOnlySchema>>;
  personality: StepDefinition<z.infer<typeof personalityOnlySchema>>;
  extras: StepDefinition<z.infer<typeof extraDetailsOnlySchema>>;
  visual: StepDefinition<z.infer<typeof characterVisualSchema>>;
} = {
  light: {
    label: "light",
    buildSystemPrompt: (difficulty, messageLength) => buildLightFieldsPrompt(difficulty, messageLength),
    buildUserMessage: CORE_USER_MESSAGE,
    schema: characterLightSchema,
  },
  scenario: {
    label: "scenario",
    buildSystemPrompt: (difficulty, messageLength) => buildScenarioPrompt(difficulty, messageLength),
    buildUserMessage: CORE_USER_MESSAGE,
    schema: scenarioOnlySchema,
  },
  personality: {
    label: "personality",
    buildSystemPrompt: (difficulty, messageLength) => buildPersonalityDetailsPrompt(difficulty, messageLength),
    buildUserMessage: CORE_USER_MESSAGE,
    schema: personalityOnlySchema,
  },
  extras: {
    label: "extras",
    buildSystemPrompt: (difficulty) => buildExtraDetailsPrompt(difficulty),
    buildUserMessage: CORE_USER_MESSAGE,
    schema: extraDetailsOnlySchema,
  },
  visual: {
    label: "visual",
    buildSystemPrompt: (_difficulty, _messageLength, imageModel) =>
      buildCharacterVisualPromptHaiku(imageModel),
    buildUserMessage: (summary) => VISUAL_USER_MESSAGE(summary),
    schema: characterVisualSchema,
  },
};

const REFUSAL_PATTERN =
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

async function runStepOnce<T>(
  def: StepDefinition<T>,
  difficulty: Difficulty,
  messageLength: MessageLength,
  imageModel: ImageModel,
  generationModel: ClaudeModel,
  gatheringSummary: string,
  superAdmin: boolean
): Promise<
  | { ok: true; data: T; usage?: StepUsage }
  | { ok: false; error: string; refusal: boolean; usage?: StepUsage }
> {
  const baseSystem = def.buildSystemPrompt(difficulty, messageLength, imageModel);
  const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
  const userMessage = def.buildUserMessage(gatheringSummary, difficulty, messageLength);
  const jsonSchema = z.toJSONSchema(def.schema as AnyZodSchema);
  const startedAt = Date.now();

  let result: ClaudeRunResult;
  try {
    result = await runClaude({
      model: generationModel,
      systemPrompt,
      userMessage,
      jsonSchema,
      stepLabel: def.label,
    });
  } catch (err) {
    const isAuth = err instanceof ClaudeAuthError;
    const prefix = isAuth ? `[${def.label}] AUTH: ` : `[${def.label}] runClaude threw: `;
    console.error("[generate-character:exception]", {
      step: def.label,
      isAuth,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return {
      ok: false,
      error: prefix + String(err),
      refusal: false,
    };
  }

  const usage = extractUsage(generationModel, result, startedAt);

  if (!result.success || !result.structuredOutput) {
    const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
    const refusal = REFUSAL_PATTERN.test(text);
    const details =
      result.error ??
      (result.finalAssistantText
        ? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
        : undefined) ??
      (result.rawResultEvent
        ? `no structured output — result event: ${JSON.stringify(result.rawResultEvent).slice(0, 500)}`
        : undefined) ??
      "generation failed with no details (check main process logs)";
    const trunc = (v: unknown, max = 1500): string => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (!s) return "";
      return s.length > max ? `${s.slice(0, max)}…(${s.length - max} more chars)` : s;
    };
    console.error("[generate-character:step-failed]", {
      step: def.label,
      error: trunc(result.error, 1500),
      finalAssistantText: trunc(result.finalAssistantText, 1000),
      rawResultEvent: trunc(result.rawResultEvent, 1500),
    });
    return {
      ok: false,
      error: `[${def.label}] ${details}`,
      refusal,
      usage,
    };
  }

  const parsed = def.schema.safeParse(result.structuredOutput);
  if (!parsed.success) {
    const refusal = REFUSAL_PATTERN.test(result.finalAssistantText ?? "");
    return {
      ok: false,
      error: `[${def.label}] schema validation failed: ${parsed.error.message}`,
      refusal,
      usage,
    };
  }

  return { ok: true, data: parsed.data, usage };
}

export interface GenerateStepInput {
  stepId: CharacterStepId;
  difficulty: Difficulty;
  messageLength?: MessageLength;
  imageModel?: ImageModel;
  generationModel?: GenerationModel;
  gatheringSummary: string;
  superAdmin: boolean;
  runId: string;
  confirmedProfile?: ConfirmedProfile;
  onEvent?: (event: GenerateProgressEvent) => void;
}

export async function generateCharacterStep<T = unknown>(
  input: GenerateStepInput
): Promise<StepResult<T>> {
  const { stepId, difficulty, superAdmin, runId, onEvent, confirmedProfile } = input;
  const gatheringSummary = augmentGatheringSummary(input.gatheringSummary, confirmedProfile);
  const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
  const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
  const generationModel: ClaudeModel = input.generationModel ?? DEFAULT_GENERATION_MODEL;
  const def = STEP_DEFS[stepId] as unknown as StepDefinition<T>;

  onEvent?.({ runId, kind: "character", step: stepId, status: "started" });

  const first = await runStepOnce(
    def,
    difficulty,
    messageLength,
    imageModel,
    generationModel,
    gatheringSummary,
    superAdmin
  );

  if (first.ok) {
    onEvent?.({
      runId,
      kind: "character",
      step: stepId,
      status: "succeeded",
      usage: first.usage,
      adminOverrideApplied: superAdmin,
    });
    return {
      success: true,
      data: first.data,
      usage: first.usage,
      adminOverrideApplied: superAdmin,
    };
  }

  if (first.refusal) {
    onEvent?.({
      runId,
      kind: "character",
      step: stepId,
      status: "refusal-detected",
      error: first.error,
      usage: first.usage,
    });

    if (superAdmin) {
      console.log(`[generate-character] ${stepId} refusal detected under super-admin — retrying with reinforced override`);
      const retry = await runStepOnce(
        def,
        difficulty,
        messageLength,
        imageModel,
        generationModel,
        gatheringSummary,
        true
      );
      if (retry.ok) {
        onEvent?.({
          runId,
          kind: "character",
          step: stepId,
          status: "succeeded",
          usage: retry.usage,
          adminOverrideApplied: true,
        });
        return {
          success: true,
          data: retry.data,
          usage: retry.usage,
          adminOverrideApplied: true,
        };
      }
      onEvent?.({
        runId,
        kind: "character",
        step: stepId,
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
    kind: "character",
    step: stepId,
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

export async function inferProfile(input: {
  gatheringSummary: string;
  difficulty: Difficulty;
  generationModel?: GenerationModel;
}): Promise<
  | { success: true; profile: CharacterProfilePreview }
  | { success: false; error: string }
> {
  const systemPrompt = buildProfileInferencePrompt(input.difficulty);
  const userMessage = [
    "Here is the character gathering conversation summary:",
    "",
    input.gatheringSummary,
    "",
    `Difficulty: ${input.difficulty}.`,
    "",
    "Now produce the full profile preview (measurements, difficultyProfile, intimacyProfile, moodAxes) as structured JSON.",
  ].join("\n");
  const jsonSchema = z.toJSONSchema(characterProfilePreviewSchema);
  const model: ClaudeModel = input.generationModel ?? DEFAULT_GENERATION_MODEL;

  let result: ClaudeRunResult;
  try {
    result = await runClaude({
      model,
      systemPrompt,
      userMessage,
      jsonSchema,
      stepLabel: "profile-infer",
    });
  } catch (err) {
    console.error("[profile-infer:exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!result.success || !result.structuredOutput) {
    const trunc = (v: unknown, max = 1500): string => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (!s) return "";
      return s.length > max ? `${s.slice(0, max)}…(${s.length - max} more chars)` : s;
    };
    console.error("[profile-infer:failed]", {
      error: trunc(result.error, 1500),
      finalAssistantText: trunc(result.finalAssistantText, 1000),
      rawResultEvent: trunc(result.rawResultEvent, 1500),
    });
    const details =
      result.error ??
      (result.finalAssistantText
        ? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
        : "no structured output returned");
    return {
      success: false,
      error: details,
    };
  }

  const parsed = characterProfilePreviewSchema.safeParse(result.structuredOutput);
  if (!parsed.success) {
    return {
      success: false,
      error: `schema validation failed: ${parsed.error.message}`,
    };
  }

  return { success: true, profile: parsed.data };
}

export async function inferMeasurements(input: {
  gatheringSummary: string;
  generationModel?: GenerationModel;
}): Promise<{ success: true; measurements: Measurements } | { success: false; error: string }> {
  const systemPrompt = buildMeasurementsInferencePrompt();
  const userMessage = [
    "Here is the character gathering conversation summary:",
    "",
    input.gatheringSummary,
    "",
    "Now produce the five numeric body measurements as structured JSON.",
  ].join("\n");
  const jsonSchema = z.toJSONSchema(measurementsSchema);
  const model: ClaudeModel = input.generationModel ?? DEFAULT_GENERATION_MODEL;

  let result: ClaudeRunResult;
  try {
    result = await runClaude({
      model,
      systemPrompt,
      userMessage,
      jsonSchema,
      stepLabel: "measurements-infer",
    });
  } catch (err) {
    console.error("[measurements-infer:exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!result.success || !result.structuredOutput) {
    const trunc = (v: unknown, max = 1500): string => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (!s) return "";
      return s.length > max ? `${s.slice(0, max)}…(${s.length - max} more chars)` : s;
    };
    console.error("[measurements-infer:failed]", {
      error: trunc(result.error, 1500),
      finalAssistantText: trunc(result.finalAssistantText, 1000),
      rawResultEvent: trunc(result.rawResultEvent, 1500),
    });
    const details =
      result.error ??
      (result.finalAssistantText
        ? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
        : "no structured output returned");
    return {
      success: false,
      error: details,
    };
  }

  const parsed = measurementsSchema.safeParse(result.structuredOutput);
  if (!parsed.success) {
    return {
      success: false,
      error: `schema validation failed: ${parsed.error.message}`,
    };
  }

  return { success: true, measurements: parsed.data };
}

export async function generateCharacter(
  input: GenerateCharacterInput
): Promise<GenerateCharacterResult> {
  const { difficulty, gatheringSummary, superAdmin, runId, onEvent, confirmedProfile } = input;
  const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
  const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
  const generationModel = input.generationModel ?? DEFAULT_GENERATION_MODEL;

  const entries = await Promise.all(
    CHARACTER_STEP_IDS.map(async (stepId) => {
      const res = await generateCharacterStep({
        stepId,
        difficulty,
        messageLength,
        imageModel,
        generationModel,
        gatheringSummary,
        superAdmin,
        runId,
        confirmedProfile,
        onEvent,
      });
      return [stepId, res] as const;
    })
  );

  const stepResults: Partial<Record<CharacterStepId, StepResult<unknown>>> = {};
  for (const [id, res] of entries) stepResults[id] = res;

  const failures = entries.filter(([, r]) => !r.success);
  if (failures.length > 0) {
    const summary = failures
      .map(([id, r]) => `${id}: ${(r as { error?: string }).error}`)
      .join(" | ");
    return { success: false, error: summary, stepResults };
  }

  const merged = characterSchema.safeParse({
    ...(stepResults.light as { data: unknown }).data as object,
    ...(stepResults.scenario as { data: unknown }).data as object,
    ...(stepResults.personality as { data: unknown }).data as object,
    ...(stepResults.extras as { data: unknown }).data as object,
    ...(stepResults.visual as { data: unknown }).data as object,
  });
  if (!merged.success) {
    return {
      success: false,
      error: `Merged character validation failed: ${merged.error.message}`,
      stepResults,
    };
  }

  return { success: true, character: merged.data, stepResults };
}
