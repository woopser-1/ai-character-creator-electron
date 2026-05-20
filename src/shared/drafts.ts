import type { UIMessage } from "./chat";
import type { Difficulty, ImageModel, MessageLength } from "./schemas";

export type DraftKind = "character" | "scenes";

export interface Draft {
	id: string;
	createdAt: string;
	updatedAt: string;
	kind: DraftKind;
	difficulty: Difficulty;
	messageLength?: MessageLength;
	imageModel?: ImageModel;
	characterGatheringMessages?: UIMessage[];
	sceneGatheringMessages?: UIMessage[];
	/** Set when this draft was forked from a completed character. */
	sourceCharacterId?: string;
	/**
	 * For scene-gathering drafts: the character we are generating scenes for.
	 * Carried verbatim from the parent character so the chat session can resume.
	 */
	character?: import("./schemas").Character;
}
