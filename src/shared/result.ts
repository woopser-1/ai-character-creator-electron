import type { StoredCharacter, StoredGroupChat } from "@shared/schemas";

// Generic discriminated-union result used across the IPC boundary.
//
// The payload is spread on the success branch (rather than nested under a
// `value` key) so call sites read naturally: `res.stored`, `res.profile`,
// `res.sessionId`. The price is that the payload object must not contain a
// `success` or `error` key — none of ours do.
export type Result<TPayload extends object> =
	| ({ success: true } & TPayload)
	| { success: false; error: string };

export function ok<TPayload extends object>(
	payload: TPayload,
): { success: true } & TPayload {
	return { success: true, ...payload };
}

export function err(error: string): { success: false; error: string } {
	return { success: false, error };
}

// Shared aliases used by both main (handler return types) and preload
// (typed wrappers around ipcRenderer.invoke). Keeping them here ensures
// both sides stay in sync.
export type CharacterResult = Result<{ stored: StoredCharacter }>;
export type GroupChatResult = Result<{ stored: StoredGroupChat }>;
