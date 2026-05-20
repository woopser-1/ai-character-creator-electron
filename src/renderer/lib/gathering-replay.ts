import type { UIMessage } from "@shared/chat";
import type { Character, StoredCharacter } from "@shared/schemas";

const STORAGE_KEY = "ai-cc:gathering-replay-seed";

/**
 * Fork a completed character's gathering into a brand new draft.
 *
 * The user clicked Rewind on a message in CharacterDetail; we open /create with
 * a pre-allocated draftId so autosave starts immediately, and we keep
 * `sourceCharacterId` so the produced character can trace its origin without
 * touching the original.
 */
export interface CharacterRewindSeed {
	kind: "rewind-character";
	draftId: string;
	sourceCharacterId: string;
	difficulty: StoredCharacter["difficulty"];
	messageLength?: StoredCharacter["messageLength"];
	imageModel?: StoredCharacter["imageModel"];
	truncatedMessages: UIMessage[];
	newMessage: string;
}

/**
 * Rewind into the scene-gathering of an existing character. The character
 * itself stays put (same id), only the scene-gathering chat reruns from the
 * chosen point; the eventual `generate:scenes` call will overwrite the
 * character's `scenes` and `sceneGatheringMessages` in place.
 */
export interface ScenesRewindSeed {
	kind: "rewind-scenes";
	originCharacterId: string;
	character: Character;
	difficulty: StoredCharacter["difficulty"];
	messageLength?: StoredCharacter["messageLength"];
	imageModel?: StoredCharacter["imageModel"];
	truncatedMessages: UIMessage[];
	newMessage: string;
}

export type ReplaySeed = CharacterRewindSeed | ScenesRewindSeed;

export function setReplaySeed(seed: ReplaySeed): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
	} catch (err) {
		console.error("[gathering-replay] failed to store seed", err);
	}
}

export function consumeReplaySeed(): ReplaySeed | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		sessionStorage.removeItem(STORAGE_KEY);
		return JSON.parse(raw) as ReplaySeed;
	} catch (err) {
		console.error("[gathering-replay] failed to read seed", err);
		return null;
	}
}
