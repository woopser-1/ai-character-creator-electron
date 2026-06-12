import {
	generateObject,
	generateText,
	jsonSchema,
	type ModelMessage,
	streamText,
} from "ai";
import type { BrowserWindow } from "electron";
import type {
	RuntimeChatAxisState,
	RuntimeChatEvent,
	RuntimeChatState,
	RuntimeChatStateDelta,
	RuntimeChatUserProfile,
	StoredChatConversation,
} from "@shared/runtime-chat";
import { runtimeChatStateSchema } from "@shared/runtime-chat";
import type { Character, StoredCharacter } from "@shared/schemas";
import {
	getFullName,
	getStoredMessageLength,
	MESSAGE_LENGTH_META,
} from "@shared/schemas";
import { getMessageLengthInstructions } from "@shared/prompts";
import {
	getRuntimeChatConversation,
	replaceRuntimeChatMessages,
	saveRuntimeChatConversation,
} from "../storage/runtime-chat";
import { getLanguageModel } from "./provider";

const MAX_TRANSCRIPT_MESSAGES = 40;
const MEMORY_REFRESH_MESSAGE_COUNT = 12;

const STATE_JSON_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: [
		"timestamp",
		"location",
		"outfit",
		"characterState",
		"visibleAxes",
		"hiddenAxes",
		"trust",
		"attraction",
		"arousal",
		"friendliness",
		"tier",
		"band",
	],
	properties: {
		timestamp: { type: "string" },
		location: { type: "string" },
		outfit: { type: "string" },
		characterState: { type: "string" },
		visibleAxes: {
			type: "object",
			additionalProperties: false,
			required: ["primary", "secondary"],
			properties: {
				primary: { $ref: "#/$defs/axis" },
				secondary: { $ref: "#/$defs/axis" },
			},
		},
		hiddenAxes: {
			type: "array",
			items: { $ref: "#/$defs/axis" },
		},
		trust: { type: "integer", minimum: 0, maximum: 100 },
		attraction: { type: "integer", minimum: 0, maximum: 100 },
		arousal: { type: "integer", minimum: 0, maximum: 100 },
		friendliness: { type: "integer", minimum: 0, maximum: 100 },
		tier: { type: "string" },
		band: { type: "string" },
		notes: { type: "string" },
	},
	$defs: {
		axis: {
			type: "object",
			additionalProperties: false,
			required: ["label", "value"],
			properties: {
				label: { type: "string" },
				lowDescriptor: { type: "string" },
				highDescriptor: { type: "string" },
				value: { type: "integer", minimum: 0, maximum: 100 },
			},
		},
	},
};

const activeTurns = new Map<string, AbortController>();

function clampInt(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.round(value)));
}

function bandForTrust(trust: number): string {
	if (trust >= 91) return "Bonded";
	if (trust >= 76) return "Close";
	if (trust >= 56) return "Trusted";
	if (trust >= 36) return "Familiar";
	if (trust >= 16) return "Acquaintance";
	return "Stranger";
}

function axisFromMoodAxis(axis: {
	label: string;
	lowDescriptor?: string;
	highDescriptor?: string;
	startingValue: number;
}): RuntimeChatAxisState {
	return {
		label: axis.label,
		lowDescriptor: axis.lowDescriptor,
		highDescriptor: axis.highDescriptor,
		value: axis.startingValue,
	};
}

function fallbackAxis(
	label: string,
	lowDescriptor: string,
	highDescriptor: string,
	value: number,
): RuntimeChatAxisState {
	return { label, lowDescriptor, highDescriptor, value };
}

function stripHiddenComments(text: string): string {
	return text.replace(/<!--[\s\S]*?-->/g, "").trim();
}

export function stripRuntimeChatMessageText(text: string): string {
	const clean = stripHiddenComments(text);
	const lines = clean.split(/\r?\n/);
	const firstContentIndex = lines.findIndex((line) => line.trim());
	if (firstContentIndex < 0) return "";

	const slice = lines.slice(firstContentIndex);
	const hasHeader =
		slice[0]?.trim().startsWith("[Date:") &&
		slice[1]?.trim().startsWith("[Outfit:") &&
		slice[2]?.trim().startsWith("[Mood:");

	if (!hasHeader) return clean;

	return slice
		.slice(3)
		.join("\n")
		.replace(/^\s+/, "")
		.trim();
}

function extractBracketValue(line: string | undefined, label: string): string | null {
	if (!line) return null;
	const match = line.match(new RegExp(`\\[${label}:\\s*([^\\]]+)\\]`));
	return match?.[1]?.trim() ?? null;
}

function parseHeaderTimestamp(dateValue: string | null): string {
	if (!dateValue) return new Date().toISOString();
	const match = dateValue.match(
		/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)/i,
	);
	if (!match) return new Date().toISOString();

	const day = Number(match[1]);
	const month = Number(match[2]) - 1;
	const year = Number(match[3]);
	const hour12 = Number(match[4]);
	const minute = Number(match[5]);
	const suffix = match[6]?.toUpperCase();
	const hour =
		suffix === "PM" && hour12 < 12
			? hour12 + 12
			: suffix === "AM" && hour12 === 12
				? 0
				: hour12;
	const date = new Date(year, month, day, hour, minute);

	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function applyMoodHeaderValues(
	state: RuntimeChatState,
	moodValue: string | null,
): RuntimeChatState {
	if (!moodValue) return state;
	const parts = moodValue.split("|").map((part) => part.trim());
	const parsed = parts
		.map((part) => part.match(/^(.+?)\s+(\d{1,3})\/100\b/))
		.filter((match): match is RegExpMatchArray => Boolean(match));

	if (parsed[0]) {
		state.visibleAxes.primary = {
			...state.visibleAxes.primary,
			label: parsed[0][1]?.trim() || state.visibleAxes.primary.label,
			value: clampInt(Number(parsed[0][2]), 0, 100),
		};
	}

	if (parsed[1]) {
		state.visibleAxes.secondary = {
			...state.visibleAxes.secondary,
			label: parsed[1][1]?.trim() || state.visibleAxes.secondary.label,
			value: clampInt(Number(parsed[1][2]), 0, 100),
		};
	}

	return state;
}

export function buildInitialRuntimeChatState(stored: StoredCharacter): RuntimeChatState {
	const character = stored.character;
	const trust = clampInt(35 - character.difficultyProfile.trustThreshold * 3, 5, 45);
	const attraction = clampInt(5 + character.intimacyProfile.escalationSpeed * 3, 5, 45);
	const friendliness = clampInt(15 + (11 - character.difficultyProfile.moodResistance) * 2, 10, 45);
	const moodAxes = character.moodAxes;
	const primary = moodAxes
		? axisFromMoodAxis(moodAxes.primary)
		: fallbackAxis("Composure", "Shaken", "Composed", 45);
	const secondary = moodAxes
		? axisFromMoodAxis(moodAxes.secondary)
		: fallbackAxis("Openness", "Closed", "Open", 25);
	const hiddenAxes = moodAxes?.hidden?.map(axisFromMoodAxis) ?? [];
	const greeting = stripHiddenComments(character.greetingMessage);
	const lines = greeting.split(/\r?\n/);
	const dateLine = lines.find((line) => line.trim().startsWith("[Date:"));
	const outfitLine = lines.find((line) => line.trim().startsWith("[Outfit:"));
	const moodLine = lines.find((line) => line.trim().startsWith("[Mood:"));

	const state: RuntimeChatState = {
		timestamp: parseHeaderTimestamp(extractBracketValue(dateLine, "Date")),
		location:
			extractBracketValue(dateLine, "Loc") ??
			stored.character.occupationLabel ??
			"Current scene",
		outfit: extractBracketValue(outfitLine, "Outfit") ?? "as described",
		characterState: extractBracketValue(outfitLine, "State") ?? "present",
		visibleAxes: { primary, secondary },
		hiddenAxes,
		trust,
		attraction,
		arousal: 0,
		friendliness,
		tier: "T1",
		band: bandForTrust(trust),
		notes: "Conversation opened from the character greeting.",
	};

	return applyMoodHeaderValues(state, extractBracketValue(moodLine, "Mood"));
}

function userProfileBlock(profile: RuntimeChatUserProfile): string {
	const lines = [
		`name: ${profile.name?.trim() || "unspecified"}`,
		`gender: ${profile.gender?.trim() || "unspecified"}`,
		`age: ${profile.age ?? "unspecified"}`,
		`description: ${
			profile.description?.trim() ||
			profile.notes?.trim() ||
			[
				profile.manner?.trim(),
				profile.clothing?.trim(),
				profile.location?.trim(),
			]
				.filter(Boolean)
				.join("; ") ||
			"none"
		}`,
	];

	return lines.join("\n");
}

function buildSystemPrompt(
	conversation: StoredChatConversation,
	storedCharacter: StoredCharacter,
	guidance?: string,
): string {
	const character = storedCharacter.character;
	const messageLength = getStoredMessageLength(storedCharacter);
	const meta = MESSAGE_LENGTH_META[messageLength];

	return `You are roleplaying as ${getFullName(character)} in a private single-character chat.

Adult-content mode is enabled only for fictional adults 18+ and consensual situations. Refuse or redirect any request involving minors, coercion, sexual violence, illegal sexual content, or incapacity. Keep all intimacy grounded in the character's consent, agency, personality, and pacing.

Autonomy boundary:
- Never write, assume, or dictate the user's actions, dialogue, thoughts, bodily reactions, arousal, consent, emotions, or intent.
- The user exists only through the user's own messages.
- Treat short user input as intentional pacing, not empty space to fill.
- End after the character's action, dialogue, or environmental shift invites the user to respond.

Output rules:
- Reply only as ${character.firstName} and immediate world elements from ${character.firstName}'s perspective.
- Do not include JSON, XML, metadata headers, hidden state comments, score numbers, or analysis.
- Use action beats in asterisks and natural dialogue.
- Keep replies ${meta.label.toLowerCase()} length: ${meta.sentenceRange} sentences in active dialogue, unless a bridge genuinely needs a little more.
${guidance ? `- Apply this one-turn operator guidance: ${guidance}` : ""}

${getMessageLengthInstructions(messageLength)}

Character profile:
Name: ${getFullName(character)}
Gender: ${character.gender ?? "unspecified"}
Age: ${character.age ?? "unspecified"}
Public description: ${character.publicDescription}
Scenario: ${character.scenario}
Personality details: ${character.additionalPersonalityDetails}
Extra details: ${character.extraDetails}
Difficulty profile: ${JSON.stringify(character.difficultyProfile)}
Intimacy profile: ${JSON.stringify(character.intimacyProfile)}
Mood axes: ${JSON.stringify(character.moodAxes ?? null)}

User profile for this conversation:
${userProfileBlock(conversation.userProfile)}

Long memory summary:
${conversation.memorySummary?.trim() || "No long memory summary yet."}

Current state JSON:
${JSON.stringify(conversation.currentState, null, 2)}`;
}

function buildMessages(
	conversation: StoredChatConversation,
	assistantMessageId: string,
): ModelMessage[] {
	const source = conversation.messages
		.filter((message) => message.id !== assistantMessageId)
		.slice(-MAX_TRANSCRIPT_MESSAGES);

	return source.map((message) => ({
		role: message.role,
		content: message.text,
	}));
}

async function generateNextState(params: {
	modelId: string;
	character: Character;
	conversation: StoredChatConversation;
	previousState: RuntimeChatState;
	assistantText: string;
	regenerationHint?: string;
	abortSignal: AbortSignal;
}): Promise<RuntimeChatState> {
	const model = await getLanguageModel(params.modelId);
	const latestUserMessage = [...params.conversation.messages]
		.reverse()
		.find((message) => message.role === "user");
	const prompt = `Return the next state JSON after this assistant reply.

Rules:
- Preserve labels, descriptors, and hidden axes unless the fiction clearly changes their values.
- Timestamp must be ISO-8601 and move forward naturally from the previous timestamp.
- location, outfit, and characterState describe the character after this assistant reply.
- visibleAxes.primary and visibleAxes.secondary are the two visible tracked axes.
- hiddenAxes are tracked silently.
- trust, attraction, arousal, friendliness are 0-100 integers.
- tier is one of T1, T2, T3, T4, T5.
- band is Stranger, Acquaintance, Familiar, Trusted, Close, or Bonded.
- Do not reward user behavior that was not actually present.
- Never infer user feelings, consent, actions, speech, or physical reactions.

Character: ${getFullName(params.character)}
Character mood axes: ${JSON.stringify(params.character.moodAxes ?? null)}
User profile: ${JSON.stringify(params.conversation.userProfile)}
Previous state: ${JSON.stringify(params.previousState)}
Latest user message: ${latestUserMessage?.text ?? ""}
Assistant reply: ${params.assistantText}
Regeneration guidance: ${params.regenerationHint ?? "none"}`;

	const result = await generateObject({
		model,
		schema: jsonSchema(STATE_JSON_SCHEMA),
		system: "You update a roleplay conversation state. Output only valid JSON matching the schema.",
		prompt,
		abortSignal: params.abortSignal,
		maxRetries: 1,
	});

	return runtimeChatStateSchema.parse(result.object);
}

function deltaTone(key: string, value: number): "positive" | "negative" | "neutral" {
	if (value === 0) return "neutral";
	if (key === "arousal") return "neutral";

	return value > 0 ? "positive" : "negative";
}

function buildStateDelta(
	before: RuntimeChatState,
	after: RuntimeChatState,
): RuntimeChatStateDelta {
	const specs = [
		{
			key: "primary",
			label: after.visibleAxes.primary.label,
			before: before.visibleAxes.primary.value,
			after: after.visibleAxes.primary.value,
		},
		{
			key: "secondary",
			label: after.visibleAxes.secondary.label,
			before: before.visibleAxes.secondary.value,
			after: after.visibleAxes.secondary.value,
		},
		{ key: "trust", label: "Trust", before: before.trust, after: after.trust },
		{
			key: "attraction",
			label: "Attraction",
			before: before.attraction,
			after: after.attraction,
		},
		{
			key: "arousal",
			label: "Arousal",
			before: before.arousal,
			after: after.arousal,
		},
		{
			key: "friendliness",
			label: "Friendliness",
			before: before.friendliness,
			after: after.friendliness,
		},
	];
	const changes = specs
		.map((spec) => ({
			...spec,
			delta: spec.after - spec.before,
			tone: deltaTone(spec.key, spec.after - spec.before),
		}))
		.filter((spec) => spec.delta !== 0);

	return {
		changes,
		summary: after.notes,
	};
}

async function maybeRefreshMemorySummary(params: {
	modelId: string;
	character: Character;
	conversation: StoredChatConversation;
	assistantText: string;
	abortSignal: AbortSignal;
}): Promise<{ summary?: string; updatedAt?: string }> {
	const completedMessages = params.conversation.messages.filter(
		(message) => message.text.trim() && !message.error,
	);
	if (completedMessages.length < MEMORY_REFRESH_MESSAGE_COUNT) {
		return {
			summary: params.conversation.memorySummary,
			updatedAt: params.conversation.memoryUpdatedAt,
		};
	}
	if (
		params.conversation.memoryUpdatedAt &&
		completedMessages.length % MEMORY_REFRESH_MESSAGE_COUNT !== 0
	) {
		return {
			summary: params.conversation.memorySummary,
			updatedAt: params.conversation.memoryUpdatedAt,
		};
	}

	const model = await getLanguageModel(params.modelId);
	const transcript = completedMessages
		.slice(-MEMORY_REFRESH_MESSAGE_COUNT)
		.map((message) => `${message.role}: ${message.text}`)
		.concat(`assistant: ${params.assistantText}`)
		.join("\n\n");
	const result = await generateText({
		model,
		system:
			"Summarize durable roleplay memory for future turns. Keep it concise, factual, and never invent user actions or feelings.",
		prompt: [
			`Character: ${getFullName(params.character)}`,
			"",
			"Previous memory:",
			params.conversation.memorySummary || "(none)",
			"",
			"Recent transcript:",
			transcript,
			"",
			"Write 6-10 compact bullets covering established facts, relationship events, unresolved threads, boundaries, promises, and the current scene state.",
		].join("\n"),
		abortSignal: params.abortSignal,
	});

	return {
		summary: result.text.trim(),
		updatedAt: new Date().toISOString(),
	};
}

function emit(window: BrowserWindow, event: RuntimeChatEvent): void {
	if (window.isDestroyed()) return;
	window.webContents.send("runtime-chat:event", event);
}

export function stopRuntimeChatTurn(conversationId: string): void {
	const active = activeTurns.get(conversationId);
	if (!active) return;

	active.abort();
	activeTurns.delete(conversationId);
}

function clearRuntimeChatTurn(conversationId: string, abort: AbortController): void {
	if (activeTurns.get(conversationId) === abort) {
		activeTurns.delete(conversationId);
	}
}

export function startRuntimeChatTurn(params: {
	window: BrowserWindow;
	conversation: StoredChatConversation;
	storedCharacter: StoredCharacter;
	assistantMessageId: string;
	modelId: string;
	regenerationHint?: string;
	guidance?: string;
}): void {
	stopRuntimeChatTurn(params.conversation.id);

	const abort = new AbortController();
	activeTurns.set(params.conversation.id, abort);

	void runRuntimeChatTurn({ ...params, abort }).catch((error) => {
		emit(params.window, {
			conversationId: params.conversation.id,
			type: "error",
			messageId: params.assistantMessageId,
			error: error instanceof Error ? error.message : String(error),
		});
	});
}

async function runRuntimeChatTurn(params: {
	window: BrowserWindow;
	conversation: StoredChatConversation;
	storedCharacter: StoredCharacter;
	assistantMessageId: string;
	modelId: string;
	regenerationHint?: string;
	guidance?: string;
	abort: AbortController;
}): Promise<void> {
	let assistantText = "";

	try {
		const model = await getLanguageModel(params.modelId);
		const result = streamText({
			model,
			system: buildSystemPrompt(
				params.conversation,
				params.storedCharacter,
				params.guidance ?? params.regenerationHint,
			),
			messages: buildMessages(params.conversation, params.assistantMessageId),
			abortSignal: params.abort.signal,
		});

		for await (const part of result.fullStream) {
			if (part.type === "text-delta") {
				assistantText += part.text;
				emit(params.window, {
					conversationId: params.conversation.id,
					type: "text-delta",
					messageId: params.assistantMessageId,
					text: part.text,
				});
			} else if (part.type === "error") {
				throw part.error;
			}
		}

		const state = await generateNextState({
			modelId: params.modelId,
			character: params.storedCharacter.character,
			conversation: params.conversation,
			previousState: params.conversation.currentState,
			assistantText,
			regenerationHint: params.regenerationHint,
			abortSignal: params.abort.signal,
		});
		const stateDelta = buildStateDelta(params.conversation.currentState, state);
		const memory = await maybeRefreshMemorySummary({
			modelId: params.modelId,
			character: params.storedCharacter.character,
			conversation: params.conversation,
			assistantText,
			abortSignal: params.abort.signal,
		});
		const latest = await getRuntimeChatConversation(params.conversation.id);
		if (!latest) throw new Error(`Chat conversation ${params.conversation.id} not found`);

		const messages = latest.messages.map((message) =>
			message.id === params.assistantMessageId
				? {
						...message,
						text: assistantText.trim(),
						stateSnapshot: state,
						stateDelta,
						modelId: params.modelId,
						regenerationHint: params.regenerationHint,
					}
				: message,
		);
		const updated = await saveRuntimeChatConversation({
			...latest,
			messages,
			currentState: state,
			memorySummary: memory.summary,
			memoryUpdatedAt: memory.updatedAt,
		});
		clearRuntimeChatTurn(params.conversation.id, params.abort);

		emit(params.window, {
			conversationId: updated.id,
			type: "conversation-updated",
			conversation: updated,
		});
	} catch (error) {
		clearRuntimeChatTurn(params.conversation.id, params.abort);
		const latest = await getRuntimeChatConversation(params.conversation.id);
		const message = error instanceof Error ? error.message : String(error);

		if (latest) {
			const messages = latest.messages.map((item) =>
				item.id === params.assistantMessageId
					? { ...item, text: assistantText.trim(), error: message }
					: item,
			);
			const updated = await replaceRuntimeChatMessages(latest.id, messages);
			emit(params.window, {
				conversationId: updated.id,
				type: "conversation-updated",
				conversation: updated,
			});
		}

		emit(params.window, {
			conversationId: params.conversation.id,
			type: "error",
			messageId: params.assistantMessageId,
			error: message,
		});
	}
}
