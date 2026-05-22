import { z } from "zod";
import { portableCharacterSchema } from "./character-port";
import { type ImportFileOutcome, PORT_FILE_VERSION } from "./port-shared";
import {
	groupChatSchema,
	MAX_GROUP_CHAT_CHARACTERS,
	MIN_GROUP_CHAT_CHARACTERS,
} from "./schemas";

export const GROUP_CHAT_PORT_KIND =
	"ai-character-creator/group-chat" as const;
export const GROUP_CHAT_BUNDLE_KIND =
	"ai-character-creator/group-chat-bundle" as const;
export const GROUP_CHAT_PORT_VERSION = PORT_FILE_VERSION;

// A portable group chat is self-contained — it embeds the full portable
// character data for every cast member so the file works on any machine
// regardless of the source library. On import we mint fresh character IDs
// for the embedded cast, then mint a fresh group chat pointing at them.
export const portableGroupChatSchema = z.object({
	groupChat: groupChatSchema,
	messageLength: z.enum(["short", "medium", "long"]),
	gatheringSummary: z.string().optional(),
	// Cast snapshot in the SAME ORDER as the original characterIds. Required
	// because the importer rebuilds characterIds from the freshly minted
	// character IDs in this order.
	characters: z
		.array(portableCharacterSchema)
		.min(MIN_GROUP_CHAT_CHARACTERS)
		.max(MAX_GROUP_CHAT_CHARACTERS),
	origin: z
		.object({
			id: z.string().optional(),
			createdAt: z.string().optional(),
		})
		.optional(),
});

export type PortableGroupChat = z.infer<typeof portableGroupChatSchema>;

export const groupChatPortFileSchema = z.object({
	kind: z.literal(GROUP_CHAT_PORT_KIND),
	version: z.literal(GROUP_CHAT_PORT_VERSION),
	exportedAt: z.string(),
	app: z.string().optional(),
	groupChat: portableGroupChatSchema,
});

export type GroupChatPortFile = z.infer<typeof groupChatPortFileSchema>;

export const groupChatBundleFileSchema = z.object({
	kind: z.literal(GROUP_CHAT_BUNDLE_KIND),
	version: z.literal(GROUP_CHAT_PORT_VERSION),
	exportedAt: z.string(),
	app: z.string().optional(),
	groupChats: z.array(portableGroupChatSchema).min(1),
});

export type GroupChatBundleFile = z.infer<typeof groupChatBundleFileSchema>;

export const anyGroupChatPortFileSchema = z.union([
	groupChatPortFileSchema,
	groupChatBundleFileSchema,
]);

export type AnyGroupChatPortFile = z.infer<typeof anyGroupChatPortFileSchema>;

import type { StoredGroupChat } from "./schemas";

export type GroupChatImportResponse =
	| {
			success: true;
			imported: StoredGroupChat[];
			fileOutcomes: ImportFileOutcome[];
	  }
	| { success: false; canceled: true }
	| { success: false; error: string; fileOutcomes?: ImportFileOutcome[] };
