import type {
	Character,
	CharacterStepId,
	Difficulty,
	ImageModel,
	MessageLength,
	Scene,
	StoredCharacter,
	StoredGroupChat,
} from "./schemas";

export type GenerateKind = "character" | "scenes" | "group-chat";
export type GenerateStepId = CharacterStepId | "scenes" | "group-chat";
export type StepStatus =
	| "idle"
	| "running"
	| "succeeded"
	| "failed"
	| "refusal-detected";

export interface StepUsage {
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	costUsd: number;
	durationMs: number;
}

export interface GenerateProgressEvent {
	runId: string;
	kind: GenerateKind;
	step: GenerateStepId;
	status: "started" | "succeeded" | "failed" | "refusal-detected";
	error?: string;
	usage?: StepUsage;
	adminOverrideApplied?: boolean;
}

export interface StepResultSuccess<T> {
	success: true;
	data: T;
	usage?: StepUsage;
	adminOverrideApplied?: boolean;
}
export interface StepResultFailure {
	success: false;
	error: string;
	refusal?: boolean;
	usage?: StepUsage;
	adminOverrideApplied?: boolean;
}
export type StepResult<T> = StepResultSuccess<T> | StepResultFailure;

export interface GenerateCharacterAllPayload {
	runId: string;
	difficulty: Difficulty;
	gatheringSummary: string;
	imageModel?: ImageModel;
}

export interface GenerateCharacterStepPayload {
	runId: string;
	stepId: CharacterStepId;
	difficulty: Difficulty;
	gatheringSummary: string;
	existing?: Partial<Character>;
}

export interface GenerateScenesPayload {
	runId: string;
	character: Character;
	gatheringSummary: string;
	imageModel?: ImageModel;
}

export interface GenerateSingleScenePayload {
	runId: string;
	character: Character;
	existingScenes: Scene[];
	gatheringSummary: string;
	imageModel?: ImageModel;
}

export type GenerateCharacterAllResponse =
	| {
			success: true;
			stored: StoredCharacter;
			usageTotal: StepUsage;
	  }
	| {
			success: false;
			error: string;
			partialByStep: Partial<Record<CharacterStepId, unknown>>;
	  };

export type GenerateCharacterStepResponse =
	| {
			success: true;
			data: unknown;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  }
	| {
			success: false;
			error: string;
			refusal?: boolean;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  };

export type GenerateScenesResponse =
	| {
			success: true;
			scenes: Scene[];
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  }
	| {
			success: false;
			error: string;
			refusal?: boolean;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  };

export interface GenerateGroupChatPayload {
	runId: string;
	characterIds: string[];
	gatheringSummary: string;
	messageLength: MessageLength;
}

export type GenerateGroupChatResponse =
	| {
			success: true;
			stored: StoredGroupChat;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  }
	| {
			success: false;
			error: string;
			refusal?: boolean;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  };

export type GenerateSingleSceneResponse =
	| {
			success: true;
			scene: Scene;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  }
	| {
			success: false;
			error: string;
			refusal?: boolean;
			usage?: StepUsage;
			adminOverrideApplied?: boolean;
	  };
