import {
	generateObject,
	generateText,
	jsonSchema,
	type LanguageModelUsage,
	NoObjectGeneratedError,
	type ProviderMetadata,
} from "ai";
import { getLanguageModel } from "./provider";

export { MissingApiKeyError } from "./provider";

const DEBUG = process.env.DEBUG_LLM === "1" || process.env.DEBUG_LLM === "true";

export interface ModelRunOptions {
	model: string;
	systemPrompt: string;
	userMessage: string;
	jsonSchema?: object;
	timeoutMs?: number;
	stepLabel?: string;
}

export interface ModelRunResult {
	success: boolean;
	result?: string;
	finalAssistantText?: string;
	toolUses: Array<{ name: string; input: unknown }>;
	structuredOutput?: unknown;
	error?: string;
	rawResultEvent?: Record<string, unknown>;
}

function truncate(value: unknown, max = 2000): string {
	const s = typeof value === "string" ? value : JSON.stringify(value);
	if (!s) return "";
	return s.length > max
		? `${s.slice(0, max)}…(${s.length - max} more chars)`
		: s;
}

function buildResultEvent(
	usage: LanguageModelUsage | undefined,
	providerMetadata: ProviderMetadata | undefined,
	startedAt: number,
): Record<string, unknown> {
	const openrouterUsage = providerMetadata?.openrouter?.usage as
		| { cost?: number }
		| undefined;
	const cost = Number(openrouterUsage?.cost ?? 0);

	return {
		usage: {
			input_tokens: usage?.inputTokens ?? 0,
			output_tokens: usage?.outputTokens ?? 0,
			cache_read_input_tokens: usage?.cachedInputTokens ?? 0,
			cache_creation_input_tokens: 0,
		},
		total_cost_usd: Number.isFinite(cost) ? cost : 0,
		duration_ms: Date.now() - startedAt,
	};
}

export async function runModel(
	options: ModelRunOptions,
): Promise<ModelRunResult> {
	const label = options.stepLabel ?? options.model;
	const startedAt = Date.now();

	console.log("[llm:start]", {
		label,
		model: options.model,
		hasSchema: Boolean(options.jsonSchema),
	});

	const model = await getLanguageModel(options.model);
	const abortSignal = AbortSignal.timeout(options.timeoutMs ?? 300_000);

	try {
		if (!options.jsonSchema) {
			const { text, usage, providerMetadata } = await generateText({
				model,
				system: options.systemPrompt,
				prompt: options.userMessage,
				abortSignal,
			});

			return {
				success: true,
				result: text,
				finalAssistantText: text,
				toolUses: [],
				rawResultEvent: buildResultEvent(usage, providerMetadata, startedAt),
			};
		}

		const { object, usage, providerMetadata } = await generateObject({
			model,
			schema: jsonSchema(options.jsonSchema),
			system: options.systemPrompt,
			prompt: options.userMessage,
			abortSignal,
			maxRetries: 2,
		});

		if (DEBUG) {
			console.log("[llm:ok]", {
				label,
				durationMs: Date.now() - startedAt,
				usage,
			});
		}

		return {
			success: true,
			result: JSON.stringify(object),
			toolUses: [],
			structuredOutput: object,
			rawResultEvent: buildResultEvent(usage, providerMetadata, startedAt),
		};
	} catch (err) {
		if (NoObjectGeneratedError.isInstance(err)) {
			console.error("[llm:no-object]", label, truncate(err.text, 1000));
			return {
				success: false,
				error: err.message,
				finalAssistantText: err.text,
				toolUses: [],
				rawResultEvent: buildResultEvent(err.usage, undefined, startedAt),
			};
		}

		const message = err instanceof Error ? err.message : String(err);
		console.error("[llm:fail]", {
			label,
			durationMs: Date.now() - startedAt,
			error: truncate(message, 2000),
		});

		return { success: false, error: message, toolUses: [] };
	}
}
