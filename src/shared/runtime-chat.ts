import { z } from "zod";

export const RUNTIME_CHAT_TIERS = [
	{ id: "T1", label: "Conversation", description: "Dialogue only" },
	{ id: "T2", label: "Light touch", description: "Brief, low-risk contact" },
	{ id: "T3", label: "Romantic contact", description: "Kissing and charged closeness" },
	{ id: "T4", label: "Sensual escalation", description: "Heavy intimacy and partial undress" },
	{ id: "T5", label: "Explicit unlocked", description: "Fully consensual explicit intimacy" },
] as const;

export type RuntimeChatTierId = (typeof RUNTIME_CHAT_TIERS)[number]["id"];

export const runtimeChatUserGenderSchema = z.enum([
	"male",
	"female",
	"other",
	"unspecified",
]);

export type RuntimeChatUserGender = z.infer<
	typeof runtimeChatUserGenderSchema
>;

export const runtimeChatUserProfileSchema = z.object({
	personaId: z.string().optional(),
	name: z.string().optional(),
	gender: z.union([runtimeChatUserGenderSchema, z.string()]).optional(),
	age: z.number().int().min(18).max(120).optional(),
	description: z.string().optional(),
	manner: z.string().optional(),
	clothing: z.string().optional(),
	location: z.string().optional(),
	notes: z.string().optional(),
});

export type RuntimeChatUserProfile = z.infer<
	typeof runtimeChatUserProfileSchema
>;

export const runtimeChatAxisStateSchema = z.object({
	label: z.string().min(1),
	lowDescriptor: z.string().optional(),
	highDescriptor: z.string().optional(),
	value: z.number().int().min(0).max(100),
});

export type RuntimeChatAxisState = z.infer<
	typeof runtimeChatAxisStateSchema
>;

export const runtimeChatStateSchema = z.object({
	timestamp: z.string().min(1),
	location: z.string().min(1),
	outfit: z.string().min(1),
	characterState: z.string().min(1),
	visibleAxes: z.object({
		primary: runtimeChatAxisStateSchema,
		secondary: runtimeChatAxisStateSchema,
	}),
	hiddenAxes: z.array(runtimeChatAxisStateSchema).default([]),
	trust: z.number().int().min(0).max(100),
	attraction: z.number().int().min(0).max(100),
	arousal: z.number().int().min(0).max(100),
	friendliness: z.number().int().min(0).max(100),
	tier: z.string().min(1),
	band: z.string().min(1),
	notes: z.string().optional(),
});

export type RuntimeChatState = z.infer<typeof runtimeChatStateSchema>;

export const runtimeChatDeltaToneSchema = z.enum([
	"positive",
	"negative",
	"neutral",
]);

export type RuntimeChatDeltaTone = z.infer<
	typeof runtimeChatDeltaToneSchema
>;

export const runtimeChatStateDeltaChangeSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	before: z.number().int().min(0).max(100),
	after: z.number().int().min(0).max(100),
	delta: z.number().int(),
	tone: runtimeChatDeltaToneSchema,
});

export type RuntimeChatStateDeltaChange = z.infer<
	typeof runtimeChatStateDeltaChangeSchema
>;

export const runtimeChatStateDeltaSchema = z.object({
	changes: z.array(runtimeChatStateDeltaChangeSchema),
	summary: z.string().optional(),
});

export type RuntimeChatStateDelta = z.infer<
	typeof runtimeChatStateDeltaSchema
>;

export const runtimeChatMessageSchema = z.object({
	id: z.string().min(1),
	role: z.enum(["user", "assistant"]),
	text: z.string(),
	createdAt: z.string().min(1),
	stateSnapshot: runtimeChatStateSchema.optional(),
	stateDelta: runtimeChatStateDeltaSchema.optional(),
	regenerationHint: z.string().optional(),
	modelId: z.string().optional(),
	usage: z
		.object({
			inputTokens: z.number().optional(),
			outputTokens: z.number().optional(),
			totalTokens: z.number().optional(),
			costUsd: z.number().optional(),
		})
		.optional(),
	error: z.string().optional(),
});

export type RuntimeChatMessage = z.infer<typeof runtimeChatMessageSchema>;

export const storedChatConversationSchema = z.object({
	id: z.string().min(1),
	characterId: z.string().min(1),
	title: z.string().min(1),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
	userProfile: runtimeChatUserProfileSchema,
	currentState: runtimeChatStateSchema,
	memorySummary: z.string().optional(),
	memoryUpdatedAt: z.string().optional(),
	messages: z.array(runtimeChatMessageSchema),
});

export type StoredChatConversation = z.infer<
	typeof storedChatConversationSchema
>;

export type RuntimeChatEvent =
	| {
			conversationId: string;
			type: "conversation-updated";
			conversation: StoredChatConversation;
	  }
	| {
			conversationId: string;
			type: "text-delta";
			messageId: string;
			text: string;
	  }
	| {
			conversationId: string;
			type: "error";
			messageId?: string;
			error: string;
	  };

export type RuntimeChatResult =
	| { success: true; conversation: StoredChatConversation }
	| { success: false; error: string };

export type RuntimeChatDeleteResult =
	| { success: true }
	| { success: false; error: string };

export const userPersonaSchema = z.object({
	id: z.string().min(1),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
	name: z.string().optional(),
	gender: runtimeChatUserGenderSchema.default("unspecified"),
	age: z.number().int().min(18).max(120).optional(),
	description: z.string().default(""),
});

export type UserPersona = z.infer<typeof userPersonaSchema>;

export type UserPersonaInput = Omit<
	UserPersona,
	"id" | "createdAt" | "updatedAt"
>;

export type UserPersonaResult =
	| { success: true; persona: UserPersona }
	| { success: false; error: string };
