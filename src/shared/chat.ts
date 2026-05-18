export type ToolName =
	| "suggestOptions"
	| "askUser"
	| "askYesNo"
	| "selectMultiple";

export type ToolState =
	| "input-streaming"
	| "input-available"
	| "output-available";

export interface TextPart {
	type: "text";
	text: string;
}

export interface ToolPart {
	type: `tool-${ToolName}` | "dynamic-tool";
	toolName: ToolName | string;
	toolCallId: string;
	state: ToolState;
	input: Record<string, unknown>;
	output?: unknown;
}

export type MessagePart = TextPart | ToolPart;

export interface UIMessage {
	id: string;
	role: "user" | "assistant";
	parts: MessagePart[];
}

export interface AgentStreamEvent {
	sessionId: string;
	type: "text-delta" | "tool-call" | "tool-result" | "finished" | "error";
	messageId?: string;
	text?: string;
	toolCallId?: string;
	toolName?: string;
	input?: Record<string, unknown>;
	output?: unknown;
	error?: string;
	finalSummary?: string;
}

export interface ChatToolReply {
	sessionId: string;
	toolCallId: string;
	output: string;
}

export type StartChatPayload =
	| { flow: "gather-character"; initialUserMessage: string }
	| {
			flow: "gather-scenes";
			character: import("./schemas").Character;
			initialUserMessage: string;
	  }
	| {
			flow: "gather-scene";
			character: import("./schemas").Character;
			existingScenes: import("./schemas").Scene[];
			initialUserMessage: string;
	  }
	| {
			flow: "refine-scene";
			character: import("./schemas").Character;
			existingScenes: import("./schemas").Scene[];
			targetScene: import("./schemas").Scene;
			initialUserMessage: string;
	  }
	| {
			flow: "gather-regenerate";
			character: import("./schemas").StoredCharacter;
			initialUserMessage: string;
	  };

export type StartChatResult =
	| { success: true; sessionId: string }
	| { success: false; error: string };
