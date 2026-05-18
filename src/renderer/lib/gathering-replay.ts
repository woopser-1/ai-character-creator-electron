import type { UIMessage } from "@shared/chat";
import type { Character, StoredCharacter } from "@shared/schemas";

const STORAGE_KEY = "ai-cc:gathering-replay-seed";

export interface CharacterReplaySeed {
	kind: "gather-character";
	originCharacterId: string;
	difficulty: StoredCharacter["difficulty"];
	messageLength?: StoredCharacter["messageLength"];
	imageModel?: StoredCharacter["imageModel"];
	truncatedMessages: UIMessage[];
	newMessage: string;
}

export interface ScenesReplaySeed {
	kind: "gather-scenes";
	originCharacterId: string;
	character: Character;
	difficulty: StoredCharacter["difficulty"];
	messageLength?: StoredCharacter["messageLength"];
	imageModel?: StoredCharacter["imageModel"];
	truncatedMessages: UIMessage[];
	newMessage: string;
}

export type ReplaySeed = CharacterReplaySeed | ScenesReplaySeed;

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
