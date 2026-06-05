import { ipcMain } from "electron";
import type {
	Character,
	Scene,
	StoredCharacter,
} from "@shared/schemas";
import {
	type GatherFlow,
	sendToSession,
	startSession,
	stopSession,
	submitToolOutput,
} from "../llm/session";
import { getSettings } from "../storage/settings";
import type { IpcCtx } from "./helpers";

type ChatStartPayload = (
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
	| {
			flow: "gather-group-chat";
			characters: Character[];
			initialUserMessage: string;
		}
) & { sessionId?: string };

type ChatRestartPayload =
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
	| {
			sessionId?: string;
			oldSessionId?: string;
			flow: "gather-group-chat";
			characters: Character[];
			replayTranscript: string;
			newMessage: string;
		};

// Both chat:start and chat:restart pick the GatherFlow from the same shape;
// extracted so the two handlers stay in sync.
function buildGatherFlow(
	payload: ChatStartPayload | ChatRestartPayload,
): GatherFlow {
	switch (payload.flow) {
		case "gather-character":
			return { flow: "gather-character" };
		case "gather-scenes":
			return { flow: "gather-scenes", character: payload.character };
		case "gather-scene":
			return {
				flow: "gather-scene",
				character: payload.character,
				existingScenes: payload.existingScenes,
			};
		case "refine-scene":
			return {
				flow: "refine-scene",
				character: payload.character,
				existingScenes: payload.existingScenes,
				targetScene: payload.targetScene,
			};
		case "gather-group-chat":
			return { flow: "gather-group-chat", characters: payload.characters };
		default:
			return { flow: "gather-regenerate", character: payload.character };
	}
}

export function registerChatIpc({ window }: IpcCtx): void {
	ipcMain.handle("chat:start", async (_event, payload: ChatStartPayload) => {
		try {
			const gatherFlow = buildGatherFlow(payload);
			const settings = await getSettings();
			const { sessionId } = await startSession(
				gatherFlow,
				window,
				payload.initialUserMessage,
				undefined,
				settings.mainModel,
				payload.sessionId,
			);
			return { success: true, sessionId };
		} catch (err) {
			return { success: false, error: String(err) };
		}
	});

	ipcMain.handle(
		"chat:send",
		async (_event, payload: { sessionId: string; text: string }) => {
			sendToSession(payload.sessionId, payload.text);
		},
	);

	ipcMain.handle(
		"chat:tool-output",
		async (
			_event,
			payload: { sessionId: string; toolCallId: string; output: string },
		) => {
			submitToolOutput(payload.sessionId, payload.toolCallId, payload.output);
		},
	);

	ipcMain.handle("chat:stop", async (_event, sessionId: string) => {
		stopSession(sessionId);
	});

	ipcMain.handle(
		"chat:restart",
		async (_event, payload: ChatRestartPayload) => {
			if (payload.oldSessionId) stopSession(payload.oldSessionId);
			try {
				const gatherFlow = buildGatherFlow(payload);
				const settings = await getSettings();
				const { sessionId } = await startSession(
					gatherFlow,
					window,
					payload.newMessage,
					payload.replayTranscript,
					settings.mainModel,
					payload.sessionId,
				);
				return { success: true as const, sessionId };
			} catch (err) {
				console.error("[chat:restart] failed", err);
				return { success: false as const, error: String(err) };
			}
		},
	);
}
