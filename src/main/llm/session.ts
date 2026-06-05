import type { AgentStreamEvent } from "@shared/chat";
import {
	buildCharacterGatheringPrompt,
	buildGroupChatGatheringPrompt,
	buildRefineSceneGatheringPrompt,
	buildRegenerationGatheringPrompt,
	buildSceneGatheringPrompt,
	buildSingleSceneGatheringPrompt,
} from "@shared/prompts";
import {
	type Character,
	DEFAULT_MAIN_MODEL,
	type Scene,
	type StoredCharacter,
} from "@shared/schemas";
import {
	type LanguageModel,
	type ModelMessage,
	stepCountIs,
	streamText,
	tool,
} from "ai";
import type { BrowserWindow } from "electron";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getLanguageModel } from "./provider";

export type GatherFlow =
	| { flow: "gather-character" }
	| { flow: "gather-scenes"; character: Character }
	| { flow: "gather-scene"; character: Character; existingScenes: Scene[] }
	| {
			flow: "refine-scene";
			character: Character;
			existingScenes: Scene[];
			targetScene: Scene;
	  }
	| { flow: "gather-regenerate"; character: StoredCharacter }
	| { flow: "gather-group-chat"; characters: Character[] };

interface ActiveSession {
	id: string;
	window: BrowserWindow;
	model: LanguageModel;
	systemPrompt: string;
	messages: ModelMessage[];
	pendingTools: Map<string, (output: string) => void>;
	queue: string[];
	abort: AbortController;
	closed: boolean;
	running: boolean;
	lastText: string;
}

const MAX_STEPS = 40;
const toolQuestionSchema = z
	.string()
	.min(8)
	.max(240)
	.describe("One clear user-facing question, without extra instructions.");
const toolOptionSchema = z
	.string()
	.min(1)
	.max(90)
	.describe("One concise, user-facing option label.");

const sessions = new Map<string, ActiveSession>();

function buildSystemPrompt(flow: GatherFlow): string {
	switch (flow.flow) {
		case "gather-character":
			return buildCharacterGatheringPrompt();
		case "gather-scenes":
			return buildSceneGatheringPrompt(flow.character);
		case "gather-scene":
			return buildSingleSceneGatheringPrompt(
				flow.character,
				flow.existingScenes,
			);
		case "refine-scene":
			return buildRefineSceneGatheringPrompt(
				flow.character,
				flow.existingScenes,
				flow.targetScene,
			);
		case "gather-regenerate":
			return buildRegenerationGatheringPrompt(flow.character.character);
		case "gather-group-chat":
			return buildGroupChatGatheringPrompt(flow.characters);
	}
}

function emit(session: ActiveSession, event: AgentStreamEvent): void {
	if (session.window.isDestroyed()) return;
	session.window.webContents.send("chat:event", event);
}

function buildTools(session: ActiveSession) {
	const ask = (
		toolCallId: string,
		toolName: string,
		input: Record<string, unknown>,
	): Promise<string> =>
		new Promise((resolve) => {
			session.pendingTools.set(toolCallId, resolve);
			emit(session, {
				sessionId: session.id,
				type: "tool-call",
				toolCallId,
				toolName,
				input,
			});
		});

	return {
		suggestOptions: tool({
			description:
				"Ask the user one multiple-choice question with 6-8 concrete options. Use when the answer space can be enumerated.",
			inputSchema: z.object({
				question: toolQuestionSchema,
				options: z
					.array(toolOptionSchema)
					.min(6)
					.max(8)
					.describe("Six to eight distinct options, no duplicates."),
			}),
			execute: ({ question, options }, { toolCallId }) =>
				ask(toolCallId, "suggestOptions", { question, options }),
		}),
		askUser: tool({
			description:
				"Ask the user one free-form text question. Use only when a structured choice would lose important creative detail.",
			inputSchema: z.object({ question: toolQuestionSchema }),
			execute: ({ question }, { toolCallId }) =>
				ask(toolCallId, "askUser", { question }),
		}),
		askYesNo: tool({
			description:
				"Ask the user one simple yes/no question about a single subject.",
			inputSchema: z.object({ question: toolQuestionSchema }),
			execute: ({ question }, { toolCallId }) =>
				ask(toolCallId, "askYesNo", { question }),
		}),
		selectMultiple: tool({
			description:
				"Ask the user to select multiple items from 6-10 concrete options, with support for custom items.",
			inputSchema: z.object({
				question: toolQuestionSchema,
				options: z
					.array(toolOptionSchema)
					.min(6)
					.max(10)
					.describe("Six to ten distinct options, no duplicates."),
			}),
			execute: ({ question, options }, { toolCallId }) =>
				ask(toolCallId, "selectMultiple", { question, options }),
		}),
	};
}

async function runTurn(session: ActiveSession): Promise<void> {
	if (session.closed) return;
	session.running = true;

	const result = streamText({
		model: session.model,
		system: session.systemPrompt,
		messages: session.messages,
		tools: buildTools(session),
		stopWhen: stepCountIs(MAX_STEPS),
		abortSignal: session.abort.signal,
	});

	let buffer = "";
	const flush = (): void => {
		const text = buffer.trim();
		buffer = "";
		if (!text) return;
		session.lastText = text;
		emit(session, { sessionId: session.id, type: "text-delta", text });
	};

	try {
		for await (const part of result.fullStream) {
			if (session.closed) return;
			if (part.type === "text-delta") {
				buffer += part.text;
			} else if (part.type === "tool-call" || part.type === "finish-step") {
				flush();
			} else if (part.type === "error") {
				throw part.error;
			}
		}
		flush();

		const response = await result.response;
		session.messages.push(...response.messages);
		session.running = false;

		if (session.closed) return;

		if (session.queue.length > 0) {
			const next = session.queue.shift() as string;
			session.messages.push({ role: "user", content: next });
			void runTurn(session);
			return;
		}

		emit(session, {
			sessionId: session.id,
			type: "finished",
			finalSummary: session.lastText,
		});
	} catch (err) {
		session.running = false;
		if (session.closed) return;

		emit(session, {
			sessionId: session.id,
			type: "error",
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

export async function startSession(
	flow: GatherFlow,
	window: BrowserWindow,
	initialUserMessage: string,
	replayTranscript?: string,
	model: string = DEFAULT_MAIN_MODEL,
	presetSessionId?: string,
): Promise<{ sessionId: string }> {
	const sessionId = presetSessionId ?? nanoid();
	const systemPrompt = buildSystemPrompt(flow);

	console.log("[session:start]", {
		sessionId,
		flow: flow.flow,
		replayBytes: replayTranscript?.length ?? 0,
	});

	const languageModel = await getLanguageModel(model);

	const firstMessage = replayTranscript
		? [
				"The user already had this conversation with you. Continue from where it leaves off without re-asking questions that were already answered. Treat the transcript as authoritative — do not challenge prior answers.",
				"",
				"<conversation>",
				replayTranscript,
				"</conversation>",
				"",
				"Now continue from the user's latest message:",
				"",
				initialUserMessage,
			].join("\n")
		: initialUserMessage;

	const session: ActiveSession = {
		id: sessionId,
		window,
		model: languageModel,
		systemPrompt,
		messages: [{ role: "user", content: firstMessage }],
		pendingTools: new Map(),
		queue: [],
		abort: new AbortController(),
		closed: false,
		running: false,
		lastText: "",
	};
	sessions.set(sessionId, session);

	void runTurn(session);

	return { sessionId };
}

export function sendToSession(sessionId: string, text: string): void {
	const session = sessions.get(sessionId);
	if (!session || session.closed) return;

	if (session.running) {
		session.queue.push(text);
		return;
	}

	session.messages.push({ role: "user", content: text });
	void runTurn(session);
}

export function submitToolOutput(
	sessionId: string,
	toolCallId: string,
	output: string,
): void {
	const session = sessions.get(sessionId);
	if (!session || session.closed) return;

	const resolver = session.pendingTools.get(toolCallId);
	if (!resolver) return;

	session.pendingTools.delete(toolCallId);
	resolver(output);

	emit(session, {
		sessionId,
		type: "tool-result",
		toolCallId,
		output,
	});
}

export function stopSession(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session) return;

	session.closed = true;
	session.abort.abort();

	for (const resolver of session.pendingTools.values()) {
		resolver("");
	}
	session.pendingTools.clear();

	sessions.delete(sessionId);
}
