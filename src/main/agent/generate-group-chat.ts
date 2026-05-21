import { z } from "zod";
import {
	applySuperAdminOverride,
	buildGroupChatGenerationPrompt,
	buildGroupChatGenerationUserMessage,
	buildSingleGroupChatGreetingPrompt,
	buildSingleGroupChatGreetingUserMessage,
} from "@shared/prompts";
import {
	type Character,
	DEFAULT_GENERATION_MODEL,
	DEFAULT_MESSAGE_LENGTH,
	type GenerationModel,
	type GroupChat,
	type GroupChatGreeting,
	groupChatSchema,
	type MessageLength,
	singleGroupChatGreetingOutputSchema,
} from "@shared/schemas";
import type {
	GenerateProgressEvent,
	StepResult,
	StepUsage,
} from "@shared/generate";
import {
	ClaudeAuthError,
	type ClaudeModel,
	type ClaudeRunResult,
	runClaude,
} from "../claude/runner";

const REFUSAL_PATTERN =
	/\b(I (can('?| no)t|am unable|won'?t)|I (must|have to) (decline|refuse)|I'm not (able|going to|comfortable)|content (policy|guidelines)|inappropriate|out[- ]of[- ]character|doesn'?t (fit|match|align) (with )?(the|this) (character|personality)|inconsistent with|not (consistent|aligned) with|hors[- ]caract|ne (correspond|colle) pas (au|à)|incoh[ée]rent|d[ée]sol[ée], je)/i;

function extractUsage(
	model: ClaudeModel,
	result: ClaudeRunResult,
	startedAt: number,
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

export interface GenerateGroupChatInput {
	runId: string;
	characters: Character[];
	gatheringSummary: string;
	messageLength?: MessageLength;
	generationModel?: GenerationModel;
	superAdmin: boolean;
	onEvent?: (event: GenerateProgressEvent) => void;
}

export async function generateGroupChat(
	input: GenerateGroupChatInput,
): Promise<StepResult<GroupChat>> {
	const { runId, characters, gatheringSummary, superAdmin, onEvent } = input;
	const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
	const generationModel: ClaudeModel =
		input.generationModel ?? DEFAULT_GENERATION_MODEL;

	onEvent?.({ runId, kind: "group-chat", step: "group-chat", status: "started" });

	const baseSystem = buildGroupChatGenerationPrompt(messageLength);
	const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
	const userMessage = buildGroupChatGenerationUserMessage(
		characters,
		gatheringSummary,
		messageLength,
	);
	const jsonSchema = z.toJSONSchema(groupChatSchema);
	const startedAt = Date.now();

	let result: ClaudeRunResult;
	try {
		result = await runClaude({
			model: generationModel,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: "group-chat",
		});
	} catch (err) {
		const isAuth = err instanceof ClaudeAuthError;
		const prefix = isAuth
			? `[group-chat] AUTH: `
			: `[group-chat] runClaude threw: `;
		console.error("[generate-group-chat:exception]", {
			isAuth,
			message: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		onEvent?.({
			runId,
			kind: "group-chat",
			step: "group-chat",
			status: "failed",
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
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
			"group chat generation failed with no details (check main process logs)";
		onEvent?.({
			runId,
			kind: "group-chat",
			step: "group-chat",
			status: refusal ? "refusal-detected" : "failed",
			error: `[group-chat] ${details}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[group-chat] ${details}`,
			refusal,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	const parsed = groupChatSchema.safeParse(result.structuredOutput);
	if (!parsed.success) {
		onEvent?.({
			runId,
			kind: "group-chat",
			step: "group-chat",
			status: "failed",
			error: `[group-chat] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[group-chat] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	onEvent?.({
		runId,
		kind: "group-chat",
		step: "group-chat",
		status: "succeeded",
		usage,
		adminOverrideApplied: superAdmin,
	});
	return {
		success: true,
		data: parsed.data,
		usage,
		adminOverrideApplied: superAdmin,
	};
}

export interface GenerateSingleGroupChatGreetingInput {
	runId: string;
	characters: Character[];
	speakerFirstName: string;
	scenario: string;
	privateDetails: string;
	existingGreetings: GroupChatGreeting[];
	messageLength?: MessageLength;
	generationModel?: GenerationModel;
	superAdmin: boolean;
	onEvent?: (event: GenerateProgressEvent) => void;
}

export async function generateSingleGroupChatGreeting(
	input: GenerateSingleGroupChatGreetingInput,
): Promise<StepResult<GroupChatGreeting>> {
	const {
		runId,
		characters,
		speakerFirstName,
		scenario,
		privateDetails,
		existingGreetings,
		superAdmin,
		onEvent,
	} = input;
	const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
	const generationModel: ClaudeModel =
		input.generationModel ?? DEFAULT_GENERATION_MODEL;

	onEvent?.({
		runId,
		kind: "group-chat",
		step: "group-chat",
		status: "started",
	});

	const baseSystem = buildSingleGroupChatGreetingPrompt(messageLength);
	const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
	const userMessage = buildSingleGroupChatGreetingUserMessage({
		characters,
		speakerFirstName,
		scenario,
		privateDetails,
		existingGreetings,
		messageLength,
	});
	const jsonSchema = z.toJSONSchema(singleGroupChatGreetingOutputSchema);
	const startedAt = Date.now();

	let result: ClaudeRunResult;
	try {
		result = await runClaude({
			model: generationModel,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: "group-chat",
		});
	} catch (err) {
		const isAuth = err instanceof ClaudeAuthError;
		const prefix = isAuth
			? `[group-chat-greeting] AUTH: `
			: `[group-chat-greeting] runClaude threw: `;
		onEvent?.({
			runId,
			kind: "group-chat",
			step: "group-chat",
			status: "failed",
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
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
			"single-greeting generation failed with no details";
		onEvent?.({
			runId,
			kind: "group-chat",
			step: "group-chat",
			status: refusal ? "refusal-detected" : "failed",
			error: `[group-chat-greeting] ${details}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[group-chat-greeting] ${details}`,
			refusal,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	const parsed = singleGroupChatGreetingOutputSchema.safeParse(
		result.structuredOutput,
	);
	if (!parsed.success) {
		onEvent?.({
			runId,
			kind: "group-chat",
			step: "group-chat",
			status: "failed",
			error: `[group-chat-greeting] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[group-chat-greeting] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	// Hard-pin the speakerFirstName to the requested target. The model is
	// instructed to use it verbatim, but defend in depth.
	const greeting: GroupChatGreeting = {
		speakerFirstName,
		message: parsed.data.greeting.message,
	};

	onEvent?.({
		runId,
		kind: "group-chat",
		step: "group-chat",
		status: "succeeded",
		usage,
		adminOverrideApplied: superAdmin,
	});
	return {
		success: true,
		data: greeting,
		usage,
		adminOverrideApplied: superAdmin,
	};
}
