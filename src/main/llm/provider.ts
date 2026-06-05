import {
	createOpenRouter,
	type OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { getApiKey } from "../storage/credentials";

export class MissingApiKeyError extends Error {
	constructor() {
		super("No OpenRouter API key configured. Add your key in Settings.");
		this.name = "MissingApiKeyError";
	}
}

let cache: { apiKey: string; provider: OpenRouterProvider } | undefined;

export async function getOpenRouter(): Promise<OpenRouterProvider> {
	const apiKey = await getApiKey();
	if (!apiKey) throw new MissingApiKeyError();

	if (!cache || cache.apiKey !== apiKey) {
		cache = {
			apiKey,
			provider: createOpenRouter({
				apiKey,
				extraBody: { usage: { include: true } },
			}),
		};
	}

	return cache.provider;
}

export async function getLanguageModel(
	modelId: string,
): Promise<LanguageModel> {
	const openrouter = await getOpenRouter();
	return openrouter(modelId);
}
