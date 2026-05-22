import { z } from "zod";
import { type ImportFileOutcome, PORT_FILE_VERSION } from "./port-shared";
import { characterSchema, confirmedProfileSchema, sceneSchema } from "./schemas";

export const CHARACTER_PORT_KIND = "ai-character-creator/character" as const;
export const CHARACTER_BUNDLE_KIND =
	"ai-character-creator/character-bundle" as const;
export const CHARACTER_PORT_VERSION = PORT_FILE_VERSION;

// A single character payload stripped of identity fields (id, createdAt). On
// import we mint a fresh id and timestamp so the file is a portable recipe,
// not a database row replica.
export const portableCharacterSchema = z.object({
	character: characterSchema,
	scenes: z.array(sceneSchema).default([]),
	difficulty: z.enum(["easy", "medium", "hard", "extreme"]),
	messageLength: z.enum(["short", "medium", "long"]).optional(),
	imageModel: z.enum(["Dreamy", "Vivid", "Vivid 2", "Vivid 3"]).optional(),
	ourdreamUrl: z.string().optional(),
	profileImageUrl: z.string().optional(),
	gatheringSummary: z.string().optional(),
	confirmedProfile: confirmedProfileSchema.optional(),
	// Origin metadata for traceability — purely informational, never trusted.
	origin: z
		.object({
			id: z.string().optional(),
			createdAt: z.string().optional(),
		})
		.optional(),
});

export type PortableCharacter = z.infer<typeof portableCharacterSchema>;

export const characterPortFileSchema = z.object({
	kind: z.literal(CHARACTER_PORT_KIND),
	version: z.literal(CHARACTER_PORT_VERSION),
	exportedAt: z.string(),
	app: z.string().optional(),
	character: portableCharacterSchema,
});

export type CharacterPortFile = z.infer<typeof characterPortFileSchema>;

export const characterBundleFileSchema = z.object({
	kind: z.literal(CHARACTER_BUNDLE_KIND),
	version: z.literal(CHARACTER_PORT_VERSION),
	exportedAt: z.string(),
	app: z.string().optional(),
	characters: z.array(portableCharacterSchema).min(1),
});

export type CharacterBundleFile = z.infer<typeof characterBundleFileSchema>;

// Permissive top-level schema for files we read off disk — discriminates by
// `kind` so we can give a precise error if the file is something else.
export const anyCharacterPortFileSchema = z.union([
	characterPortFileSchema,
	characterBundleFileSchema,
]);

export type AnyCharacterPortFile = z.infer<typeof anyCharacterPortFileSchema>;

// Re-export the shared types for backwards-compat with existing imports.
export type { ExportResponse, ImportFileOutcome } from "./port-shared";

// Forward-declared in renderer-friendly form. The renderer imports
// StoredCharacter from "@shared/schemas" directly.
import type { StoredCharacter } from "./schemas";

export type ImportResponse =
	| { success: true; imported: StoredCharacter[]; fileOutcomes: ImportFileOutcome[] }
	| { success: false; canceled: true }
	| { success: false; error: string; fileOutcomes?: ImportFileOutcome[] };
