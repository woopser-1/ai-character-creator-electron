import type { ImageModel } from "@shared/schemas";

export * from "@shared/schemas";
export type {
	ExportResponse,
	ImportFileOutcome,
	ImportResponse,
	PortableCharacter,
} from "@shared/character-port";
export type {
	GroupChatImportResponse,
	PortableGroupChat,
} from "@shared/group-chat-port";

export const IMAGE_MODEL_META: Record<
	ImageModel,
	{ label: string; description: string }
> = {
	Dreamy: {
		label: "Dreamy",
		description: "Tag-style positive and negative prompts (new format)",
	},
	Vivid: {
		label: "Vivid",
		description: "Flowing sentence ending with 'photorealistic'",
	},
	"Vivid 2": {
		label: "Vivid 2",
		description: "Same schema as Vivid, next-gen quality",
	},
	"Vivid 3": {
		label: "Vivid 3",
		description: "Natural-language descriptive prose, no tags or weights",
	},
};
