import type { ExportResponse, ImportResponse } from "@shared/character-port";
import type {
	AgentStreamEvent,
	StartChatPayload,
	StartChatResult,
	UIMessage,
} from "@shared/chat";
import type { Draft } from "@shared/drafts";
import type {
	GenerateCharacterAllResponse,
	GenerateCharacterStepResponse,
	GenerateGroupChatResponse,
	GenerateProgressEvent,
	GenerateScenesResponse,
	GenerateSingleSceneResponse,
} from "@shared/generate";
import type { GroupChatImportResponse } from "@shared/group-chat-port";
import type { ImageRefreshProgress, ImageRefreshResult } from "@shared/images";
import type { CharacterResult, GroupChatResult } from "@shared/result";
import type {
	AppSettings,
	Character,
	CharacterProfilePreview,
	CharacterStepId,
	ConfirmedProfile,
	Difficulty,
	GroupChat,
	ImageModel,
	Measurements,
	MessageLength,
	Scene,
	StoredCharacter,
	StoredGroupChat,
} from "@shared/schemas";
import type { UpdateInfo } from "@shared/updates";
import { contextBridge, ipcRenderer } from "electron";

export type ApiKeyStatus = { hasKey: boolean; maskedHint?: string };
export type OpenRouterTestResult = { ok: boolean; error?: string };
export type { UpdateInfo };

const api = {
	openrouter: {
		test: (): Promise<OpenRouterTestResult> =>
			ipcRenderer.invoke("openrouter:test"),
	},
	updates: {
		check: (): Promise<UpdateInfo> => ipcRenderer.invoke("updates:check"),
		onAvailable: (cb: (info: UpdateInfo) => void): (() => void) => {
			const listener = (_e: unknown, info: UpdateInfo) => cb(info);
			ipcRenderer.on("updates:available", listener);
			return () => ipcRenderer.removeListener("updates:available", listener);
		},
	},
	images: {
		refreshAll: (): Promise<ImageRefreshResult> =>
			ipcRenderer.invoke("images:refreshAll"),
		onProgress: (
			cb: (progress: ImageRefreshProgress) => void,
		): (() => void) => {
			const listener = (_e: unknown, progress: ImageRefreshProgress) =>
				cb(progress);
			ipcRenderer.on("images:refreshProgress", listener);
			return () =>
				ipcRenderer.removeListener("images:refreshProgress", listener);
		},
		onComplete: (cb: (result: ImageRefreshResult) => void): (() => void) => {
			const listener = (_e: unknown, result: ImageRefreshResult) => cb(result);
			ipcRenderer.on("images:refreshComplete", listener);
			return () =>
				ipcRenderer.removeListener("images:refreshComplete", listener);
		},
	},
	window: {
		minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
		toggleMaximize: (): Promise<{ maximized: boolean }> =>
			ipcRenderer.invoke("window:toggleMaximize"),
		close: (): Promise<void> => ipcRenderer.invoke("window:close"),
		isMaximized: (): Promise<boolean> =>
			ipcRenderer.invoke("window:isMaximized"),
		onMaximizeChange: (cb: (maximized: boolean) => void): (() => void) => {
			const listener = (_e: unknown, maximized: boolean) => cb(maximized);
			ipcRenderer.on("window:maximizeChange", listener);
			return () =>
				ipcRenderer.removeListener("window:maximizeChange", listener);
		},
		platform: process.platform as NodeJS.Platform,
	},
	characters: {
		list: (): Promise<StoredCharacter[]> =>
			ipcRenderer.invoke("characters:list"),
		get: (id: string): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:get", id),
		delete: (id: string): Promise<void> =>
			ipcRenderer.invoke("characters:delete", id),
		save: (payload: {
			character: Character;
			scenes: Scene[];
			difficulty: Difficulty;
			messageLength?: MessageLength;
			imageModel?: ImageModel;
		}): Promise<StoredCharacter> =>
			ipcRenderer.invoke("characters:save", payload),
		updateImageModel: (
			id: string,
			imageModel: ImageModel,
		): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:updateImageModel", { id, imageModel }),
		updateDifficulty: (
			id: string,
			difficulty: Difficulty,
		): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:updateDifficulty", { id, difficulty }),
		updateOurdreamUrl: (
			id: string,
			ourdreamUrl: string | null,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:updateOurdreamUrl", { id, ourdreamUrl }),
		refreshProfileImage: (id: string): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:refreshProfileImage", { id }),
		updateScenes: (
			id: string,
			scenes: Scene[],
		): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:updateScenes", { id, scenes }),
		updateGatheringMessages: (
			id: string,
			payload: {
				gatheringMessages?: UIMessage[];
				sceneGatheringMessages?: UIMessage[];
			},
		): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:updateGatheringMessages", {
				id,
				...payload,
			}),
		appendScene: (id: string, scene: Scene): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:appendScene", { id, scene }),
		replaceScene: (
			id: string,
			sceneIndex: number,
			scene: Scene,
		): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:replaceScene", { id, sceneIndex, scene }),
		updateMessageLength: (
			id: string,
			messageLength: MessageLength,
			gatheringSummary: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:updateMessageLength", {
				id,
				messageLength,
				gatheringSummary,
			}),
		regenerateMoodAxes: (
			id: string,
			gatheringSummary: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:regenerateMoodAxes", {
				id,
				gatheringSummary,
			}),
		upgradeSystemFramework: (
			id: string,
			gatheringSummary?: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:upgradeSystemFramework", {
				id,
				gatheringSummary,
			}),
		refreshVivid3Physical: (
			id: string,
			gatheringSummary?: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:refreshVivid3Physical", {
				id,
				gatheringSummary,
			}),
		updateCharacterField: (
			id: string,
			path: string,
			value: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:updateCharacterField", {
				id,
				path,
				value,
			}),
		updateSceneField: (
			id: string,
			sceneIndex: number,
			field: "prompt" | "negativePrompt",
			value: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:updateSceneField", {
				id,
				sceneIndex,
				field,
				value,
			}),
		regenerateForDifficulty: (
			id: string,
			difficulty: Difficulty,
			gatheringSummary: string,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:regenerateForDifficulty", {
				id,
				difficulty,
				gatheringSummary,
			}),
		regenerateScenes: (
			id: string,
			imageModel?: ImageModel,
		): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:regenerateScenes", { id, imageModel }),
		regenerateVisualOnly: (payload: {
			id: string;
			gatheringSummary: string;
			confirmedMeasurements?: Measurements;
			confirmedProfile?: ConfirmedProfile;
			imageModel?: ImageModel;
		}): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:regenerateVisualOnly", payload),
		regeneratePartial: (payload: {
			id: string;
			steps: CharacterStepId[];
			regenerateScenes: boolean;
			gatheringSummary: string;
			gatheringMessagesAppend?: UIMessage[];
			confirmedMeasurements?: Measurements;
			confirmedProfile?: ConfirmedProfile;
			imageModel?: ImageModel;
		}): Promise<CharacterResult> =>
			ipcRenderer.invoke("characters:regeneratePartial", payload),
		appendGatheringMessages: (
			id: string,
			messages: UIMessage[],
		): Promise<StoredCharacter | null> =>
			ipcRenderer.invoke("characters:appendGatheringMessages", {
				id,
				messages,
			}),
		exportToFile: (ids: string[]): Promise<ExportResponse> =>
			ipcRenderer.invoke("characters:export", { ids }),
		importFromFile: (): Promise<ImportResponse> =>
			ipcRenderer.invoke("characters:import"),
		importFromPaths: (paths: string[]): Promise<ImportResponse> =>
			ipcRenderer.invoke("characters:importFromPaths", { paths }),
	},
	groupChats: {
		list: (): Promise<StoredGroupChat[]> =>
			ipcRenderer.invoke("group-chats:list"),
		get: (id: string): Promise<StoredGroupChat | null> =>
			ipcRenderer.invoke("group-chats:get", id),
		delete: (id: string): Promise<void> =>
			ipcRenderer.invoke("group-chats:delete", id),
		save: (payload: {
			groupChat: GroupChat;
			characterIds: string[];
			messageLength: MessageLength;
			gatheringSummary?: string;
			gatheringMessages?: UIMessage[];
		}): Promise<StoredGroupChat> =>
			ipcRenderer.invoke("group-chats:save", payload),
		updateField: (
			id: string,
			field: "title" | "publicDescription" | "scenario" | "privateDetails",
			value: string,
		): Promise<GroupChatResult> =>
			ipcRenderer.invoke("group-chats:updateField", { id, field, value }),
		updateGreetingMessage: (
			id: string,
			index: number,
			message: string,
		): Promise<GroupChatResult> =>
			ipcRenderer.invoke("group-chats:updateGreetingMessage", {
				id,
				index,
				message,
			}),
		generateGreeting: (
			id: string,
			speakerFirstName: string,
		): Promise<GroupChatResult> =>
			ipcRenderer.invoke("group-chats:generateGreeting", {
				id,
				speakerFirstName,
			}),
		deleteGreeting: (id: string, index: number): Promise<GroupChatResult> =>
			ipcRenderer.invoke("group-chats:deleteGreeting", { id, index }),
		updateGatheringMessages: (
			id: string,
			gatheringMessages: UIMessage[],
		): Promise<StoredGroupChat | null> =>
			ipcRenderer.invoke("group-chats:updateGatheringMessages", {
				id,
				gatheringMessages,
			}),
		regenerate: (id: string): Promise<GenerateGroupChatResponse> =>
			ipcRenderer.invoke("group-chats:regenerate", { id }),
		exportToFile: (ids: string[]): Promise<ExportResponse> =>
			ipcRenderer.invoke("group-chats:export", { ids }),
		importFromFile: (): Promise<GroupChatImportResponse> =>
			ipcRenderer.invoke("group-chats:import"),
		importFromPaths: (paths: string[]): Promise<GroupChatImportResponse> =>
			ipcRenderer.invoke("group-chats:importFromPaths", { paths }),
	},
	drafts: {
		save: (draft: Draft): Promise<Draft> =>
			ipcRenderer.invoke("drafts:save", draft),
		get: (id: string): Promise<Draft | null> =>
			ipcRenderer.invoke("drafts:get", id),
		getLatest: (): Promise<Draft | null> =>
			ipcRenderer.invoke("drafts:getLatest"),
		list: (): Promise<Draft[]> => ipcRenderer.invoke("drafts:list"),
		delete: (id: string): Promise<void> =>
			ipcRenderer.invoke("drafts:delete", id),
	},
	shell: {
		showInFolder: (path: string): Promise<{ ok: boolean }> =>
			ipcRenderer.invoke("shell:showInFolder", path),
		openExternal: (url: string): Promise<{ ok: boolean; error?: string }> =>
			ipcRenderer.invoke("shell:openExternal", url),
	},
	settings: {
		get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
		update: (partial: Partial<AppSettings>): Promise<AppSettings> =>
			ipcRenderer.invoke("settings:update", partial),
		setApiKey: (key: string): Promise<ApiKeyStatus> =>
			ipcRenderer.invoke("settings:setApiKey", key),
		apiKeyStatus: (): Promise<ApiKeyStatus> =>
			ipcRenderer.invoke("settings:apiKeyStatus"),
	},
	generate: {
		characterAll: (payload: {
			runId: string;
			difficulty: Difficulty;
			messageLength?: MessageLength;
			gatheringSummary: string;
			imageModel?: ImageModel;
			confirmedMeasurements?: Measurements;
			confirmedProfile?: ConfirmedProfile;
			draftId?: string;
			sourceCharacterId?: string;
		}): Promise<GenerateCharacterAllResponse> =>
			ipcRenderer.invoke("generate:character:all", payload),
		characterStep: (payload: {
			runId: string;
			stepId: CharacterStepId;
			difficulty: Difficulty;
			messageLength?: MessageLength;
			imageModel?: ImageModel;
			gatheringSummary: string;
			confirmedMeasurements?: Measurements;
			confirmedProfile?: ConfirmedProfile;
		}): Promise<GenerateCharacterStepResponse> =>
			ipcRenderer.invoke("generate:character:step", payload),
		characterFinalize: (payload: {
			stepData: Record<CharacterStepId, unknown>;
			difficulty: Difficulty;
			messageLength?: MessageLength;
			imageModel?: ImageModel;
			confirmedMeasurements?: Measurements;
			gatheringSummary?: string;
			confirmedProfile?: ConfirmedProfile;
			draftId?: string;
			sourceCharacterId?: string;
		}): Promise<CharacterResult> =>
			ipcRenderer.invoke("generate:character:finalize", payload),
		inferMeasurements: (payload: {
			gatheringSummary: string;
		}): Promise<
			| { success: true; measurements: Measurements }
			| { success: false; error: string }
		> => ipcRenderer.invoke("generate:measurements:infer", payload),
		inferProfile: (payload: {
			gatheringSummary: string;
			difficulty: Difficulty;
		}): Promise<
			| { success: true; profile: CharacterProfilePreview }
			| { success: false; error: string }
		> => ipcRenderer.invoke("generate:profile:infer", payload),
		scenes: (payload: {
			runId: string;
			character: Character;
			gatheringSummary: string;
			imageModel?: ImageModel;
			sceneCount?: number;
		}): Promise<GenerateScenesResponse> =>
			ipcRenderer.invoke("generate:scenes", payload),
		sceneSingle: (payload: {
			runId: string;
			character: Character;
			existingScenes: Scene[];
			gatheringSummary: string;
			imageModel?: ImageModel;
		}): Promise<GenerateSingleSceneResponse> =>
			ipcRenderer.invoke("generate:scene:single", payload),
		groupChat: (payload: {
			runId: string;
			characterIds: string[];
			gatheringSummary: string;
			messageLength: MessageLength;
			gatheringMessages?: UIMessage[];
		}): Promise<GenerateGroupChatResponse> =>
			ipcRenderer.invoke("generate:group-chat", payload),
		onProgress: (cb: (ev: GenerateProgressEvent) => void): (() => void) => {
			const listener = (_e: unknown, ev: GenerateProgressEvent) => cb(ev);
			ipcRenderer.on("generate:progress", listener);
			return () => ipcRenderer.removeListener("generate:progress", listener);
		},
	},
	chat: {
		start: (
			payload: StartChatPayload & { sessionId?: string },
		): Promise<StartChatResult> => ipcRenderer.invoke("chat:start", payload),
		send: (sessionId: string, text: string): Promise<void> =>
			ipcRenderer.invoke("chat:send", { sessionId, text }),
		toolOutput: (
			sessionId: string,
			toolCallId: string,
			output: string,
		): Promise<void> =>
			ipcRenderer.invoke("chat:tool-output", { sessionId, toolCallId, output }),
		stop: (sessionId: string): Promise<void> =>
			ipcRenderer.invoke("chat:stop", sessionId),
		restart: (
			payload:
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
				  },
		): Promise<StartChatResult> => ipcRenderer.invoke("chat:restart", payload),
		onEvent: (cb: (ev: AgentStreamEvent) => void): (() => void) => {
			const listener = (_e: unknown, ev: AgentStreamEvent) => cb(ev);
			ipcRenderer.on("chat:event", listener);
			return () => ipcRenderer.removeListener("chat:event", listener);
		},
	},
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
