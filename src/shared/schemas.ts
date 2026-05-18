import { z } from "zod";
import type { UIMessage } from "./chat";

export const DIFFICULTIES = ["easy", "medium", "hard", "extreme"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MESSAGE_LENGTHS = ["short", "medium", "long"] as const;
export type MessageLength = (typeof MESSAGE_LENGTHS)[number];

export const MESSAGE_LENGTH_META: Record<
	MessageLength,
	{ label: string; description: string; sentenceRange: string }
> = {
	short: {
		label: "Short",
		description: "Punchy replies, 1-3 sentences, quick back-and-forth",
		sentenceRange: "1-3",
	},
	medium: {
		label: "Medium",
		description: "Balanced replies, 2-6 sentences, natural conversation rhythm",
		sentenceRange: "2-6",
	},
	long: {
		label: "Long",
		description: "Rich immersive replies, 5-12 sentences with sensory detail",
		sentenceRange: "5-12",
	},
};

export const DEFAULT_MESSAGE_LENGTH: MessageLength = "medium";

export const IMAGE_MODELS = ["Dreamy", "Vivid", "Vivid 2", "Vivid 3"] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];
export const DEFAULT_IMAGE_MODEL: ImageModel = "Vivid";

export const MOOD_AXIS_DELTA_RANGES: Record<
	Difficulty,
	{ positive: string; negative: string; summary: string }
> = {
	easy: {
		positive: "+5 to +10",
		negative: "-5 to -10",
		summary:
			"Mood shifts visibly each reply; 10-20 exchanges can move an axis from low to high.",
	},
	medium: {
		positive: "+3 to +7",
		negative: "-3 to -7",
		summary:
			"Gradual per-reply progression; 20-35 exchanges for meaningful axis change.",
	},
	hard: {
		positive: "+2 to +4",
		negative: "-3 to -6",
		summary:
			"Slow climbs, sharper drops when pushed. 40-60 exchanges for real movement.",
	},
	extreme: {
		positive: "+1 to +2",
		negative: "-3 to -8",
		summary:
			"Glacial climb, severe drops. 60-100 exchanges for axis transformation.",
	},
};

export const DIFFICULTY_META: Record<
	Difficulty,
	{ label: string; description: string }
> = {
	easy: {
		label: "Easy",
		description:
			"Openly flirtatious and receptive, quick to warm up with low resistance",
	},
	medium: {
		label: "Medium",
		description:
			"Moderate boundaries, needs some rapport before showing romantic interest",
	},
	hard: {
		label: "Hard",
		description:
			"Guarded and resistant, requires significant trust-building and patience",
	},
	extreme: {
		label: "Extreme",
		description:
			"Deeply closed off, only genuine emotional connection over many exchanges can break through",
	},
};

export const POST_INTIMACY_BEHAVIORS = [
	"regretful",
	"guilty",
	"awkward",
	"tender",
	"satisfied",
	"detached",
	"clingy",
	"anxious",
	"empowered",
	"conflicted",
] as const;
export type PostIntimacyBehavior = (typeof POST_INTIMACY_BEHAVIORS)[number];

function flattenScoreReasoningPairs(input: unknown): unknown {
	if (!input || typeof input !== "object" || Array.isArray(input)) return input;
	const obj = input as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(obj)) {
		if (
			val &&
			typeof val === "object" &&
			!Array.isArray(val) &&
			("value" in val || "score" in val)
		) {
			const nested = val as {
				value?: unknown;
				score?: unknown;
				reasoning?: unknown;
			};
			out[key] = nested.value ?? nested.score;
			const reasoningKey = `${key}Reasoning`;
			if (nested.reasoning !== undefined && !(reasoningKey in obj)) {
				out[reasoningKey] = nested.reasoning;
			}
		} else {
			out[key] = val;
		}
	}
	return out;
}

export const difficultyProfileSchema = z.preprocess(
	flattenScoreReasoningPairs,
	z.object({
		moodResistance: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"How resistant the character is to mood changes (1=shifts easily, 10=almost impossible to shift)",
			),
		trustThreshold: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"How difficult it is to earn the character's trust (1=trusts immediately, 10=extremely guarded)",
			),
		personalityRigidity: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"How rigid the personality is (1=very adaptable, 10=completely fixed)",
			),
		moodResistanceReasoning: z
			.string()
			.describe(
				"Brief explanation of why this character has this mood resistance level",
			),
		trustThresholdReasoning: z
			.string()
			.describe("Brief explanation of the character's trust patterns"),
		personalityRigidityReasoning: z
			.string()
			.describe("Brief explanation of the character's personality rigidity"),
	}),
);

export type DifficultyProfile = z.infer<typeof difficultyProfileSchema>;

export const intimacyProfileSchema = z.preprocess(
	flattenScoreReasoningPairs,
	z.object({
		escalationSpeed: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"How fast the character moves from distant to sexually active (1=very slow, 10=immediate)",
			),
		sexualConfidence: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"How experienced and confident during intimate moments (1=inexperienced, 10=very confident)",
			),
		emotionalDetachment: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"Can have sex without deep emotional connection (1=impossible without love, 10=fully detached)",
			),
		postIntimacyBehavior: z
			.enum(POST_INTIMACY_BEHAVIORS)
			.describe("Primary emotional response after sexual activity"),
		circumstantialTriggers: z
			.string()
			.describe(
				"Situations that can lower inhibitions — alcohol, vulnerability, loneliness, adrenaline, etc.",
			),
		personalityConsistency: z
			.number()
			.min(1)
			.max(10)
			.describe(
				"How much sexual behavior matches baseline personality (1=completely different, 10=fully consistent)",
			),
		escalationSpeedReasoning: z.string(),
		sexualConfidenceReasoning: z.string(),
		emotionalDetachmentReasoning: z.string(),
		postIntimacyBehaviorReasoning: z.string(),
		personalityConsistencyReasoning: z.string(),
	}),
);

export type IntimacyProfile = z.infer<typeof intimacyProfileSchema>;

export const moodAxisSchema = z.object({
	label: z
		.string()
		.min(1)
		.describe(
			"Short noun label for this mood axis (e.g. 'Openness', 'Warmth', 'Composure', 'Trust', 'Playfulness'). 1-2 words.",
		),
	lowDescriptor: z
		.string()
		.min(1)
		.describe(
			"Single-word descriptor for the 0-end of this axis (e.g. 'Guarded', 'Cold', 'Agitated')",
		),
	highDescriptor: z
		.string()
		.min(1)
		.describe(
			"Single-word descriptor for the 100-end of this axis (e.g. 'Open', 'Warm', 'Calm')",
		),
	startingValue: z
		.number()
		.int()
		.min(0)
		.max(100)
		.describe(
			"Integer 0-100 at which this axis begins on first interaction. Must reflect the chosen difficulty (Extreme 0-15, Hard 10-25, Medium 25-50, Easy 40-60).",
		),
	reasoning: z
		.string()
		.min(1)
		.describe(
			"Brief explanation of why this axis was picked for this character and why the starting value fits.",
		),
});

export type MoodAxis = z.infer<typeof moodAxisSchema>;

export const moodAxesSchema = z.object({
	primary: moodAxisSchema,
	secondary: moodAxisSchema,
});

export type MoodAxes = z.infer<typeof moodAxesSchema>;

export const measurementsSchema = z.object({
	heightCm: z
		.number()
		.int()
		.min(140)
		.max(210)
		.describe("Height in centimeters"),
	bustCm: z
		.number()
		.int()
		.min(60)
		.max(140)
		.describe("Bust circumference in centimeters"),
	cupSize: z
		.string()
		.min(1)
		.max(6)
		.describe("Bra cup size, e.g. 'A', 'B', 'C', 'D', 'DD', 'DDD+'"),
	waistCm: z
		.number()
		.int()
		.min(45)
		.max(120)
		.describe("Waist circumference in centimeters"),
	hipsCm: z
		.number()
		.int()
		.min(60)
		.max(150)
		.describe("Hip circumference in centimeters"),
});

export type Measurements = z.infer<typeof measurementsSchema>;

// === Profile preview (inferred before generation, editable in the review screen) ===

export const characterProfilePreviewSchema = z.object({
	measurements: measurementsSchema,
	difficultyProfile: difficultyProfileSchema,
	intimacyProfile: intimacyProfileSchema,
	moodAxes: moodAxesSchema,
});

export type CharacterProfilePreview = z.infer<
	typeof characterProfilePreviewSchema
>;

// Confirmed profile passed back to character generation after user review.
// Score fields are the user-confirmed integers; *Reasoning fields are optional —
// when omitted (because the user changed the score and did NOT manually edit
// the reasoning), the light prompt regenerates fresh reasoning that justifies
// the confirmed score. When provided, they are used verbatim.

export const confirmedDifficultyProfileSchema = z.object({
	moodResistance: z.number().int().min(1).max(10),
	trustThreshold: z.number().int().min(1).max(10),
	personalityRigidity: z.number().int().min(1).max(10),
	moodResistanceReasoning: z.string().optional(),
	trustThresholdReasoning: z.string().optional(),
	personalityRigidityReasoning: z.string().optional(),
});

export type ConfirmedDifficultyProfile = z.infer<
	typeof confirmedDifficultyProfileSchema
>;

export const confirmedIntimacyProfileSchema = z.object({
	escalationSpeed: z.number().int().min(1).max(10),
	sexualConfidence: z.number().int().min(1).max(10),
	emotionalDetachment: z.number().int().min(1).max(10),
	personalityConsistency: z.number().int().min(1).max(10),
	postIntimacyBehavior: z.enum(POST_INTIMACY_BEHAVIORS),
	circumstantialTriggers: z.string(),
	escalationSpeedReasoning: z.string().optional(),
	sexualConfidenceReasoning: z.string().optional(),
	emotionalDetachmentReasoning: z.string().optional(),
	personalityConsistencyReasoning: z.string().optional(),
	postIntimacyBehaviorReasoning: z.string().optional(),
});

export type ConfirmedIntimacyProfile = z.infer<
	typeof confirmedIntimacyProfileSchema
>;

export const confirmedMoodAxisSchema = z.object({
	label: z.string().min(1),
	lowDescriptor: z.string().min(1),
	highDescriptor: z.string().min(1),
	startingValue: z.number().int().min(0).max(100),
	reasoning: z.string().optional(),
});

export type ConfirmedMoodAxis = z.infer<typeof confirmedMoodAxisSchema>;

export const confirmedMoodAxesSchema = z.object({
	primary: confirmedMoodAxisSchema,
	secondary: confirmedMoodAxisSchema,
});

export type ConfirmedMoodAxes = z.infer<typeof confirmedMoodAxesSchema>;

export const confirmedProfileSchema = z.object({
	difficultyProfile: confirmedDifficultyProfileSchema,
	intimacyProfile: confirmedIntimacyProfileSchema,
	moodAxes: confirmedMoodAxesSchema,
});

export type ConfirmedProfile = z.infer<typeof confirmedProfileSchema>;

export const characterSchema = z.object({
	firstName: z
		.string()
		.min(1)
		.describe("The character's first (given) name. REQUIRED — never empty."),
	lastName: z
		.string()
		.min(1)
		.describe(
			"The character's last (family) name. REQUIRED — never empty. A character without a last name is invalid.",
		),
	baseGenerationPrompt: z
		.string()
		.describe(
			"Detailed generation prompt with exhaustive body and face details: ethnicity, body type/build, breast size/shape, bust size, butt shape/size, waist/hip proportions, height, skin tone, hair colour/length/style, eye colour, facial structure, and personality essence. Written as a natural flowing description.",
		),
	customPhysicalDetails: z
		.string()
		.describe(
			"A concise listing of all physical details: body type, height, skin tone, hair color/style, etc.",
		),
	customFaceDetails: z
		.string()
		.describe(
			"A concise listing of face-specific details: eye color/shape, lip shape, nose, jawline, freckles, etc.",
		),
	publicDescription: z
		.string()
		.describe(
			"A short public-facing description for users browsing AI characters",
		),
	greetingMessage: z
		.string()
		.describe(
			"The character's greeting message using the format: Location/Date/Time/Outfit/Mood header, then *actions* in asterisks, then plain dialogue or text: lines (e.g. text: hey there)",
		),
	firstReplySuggestion: z
		.string()
		.max(100)
		.describe(
			"A short suggested first reply the user could send to start the conversation (max 100 characters)",
		),
	scenario: z
		.string()
		.describe(
			"A very descriptive scenario (~2000 chars max). Must include a narrative section and a [FORMAT RULES] block at the end instructing the model to use Location/Date/Time/Outfit/Mood metadata headers, optional text: lines for speech, and asterisks for extra context",
		),
	additionalPersonalityDetails: z.string(),
	extraDetails: z.string(),
	baseImagePrompt: z
		.string()
		.describe(
			"Natural-language image prompt for the character's default scene. MUST include physical appearance (body type, skin tone, hair, eye color, facial features) woven into the prompt. Flowing comma-separated sentence describing appearance, scene, pose, outfit, lighting, mood, atmosphere, ending with 'photorealistic' and a style descriptor",
		),
	personalityLabel: z.string(),
	occupationLabel: z.string(),
	relationshipLabel: z.string(),
	hobbyLabel: z.string(),
	fetishLabel: z.string(),
	difficultyProfile: difficultyProfileSchema.describe(
		"AI-determined difficulty profile analyzing how this character behaves in interactions",
	),
	intimacyProfile: intimacyProfileSchema.describe(
		"AI-determined intimacy profile analyzing how this character behaves during and after intimate encounters",
	),
	moodAxes: moodAxesSchema
		.optional()
		.describe(
			"Two fixed mood dimensions tracked on a 0-100 scale during conversation. Legacy characters created before this field existed may omit it.",
		),
	confirmedMeasurements: measurementsSchema
		.optional()
		.describe(
			"User-confirmed body measurements (height/bust/cup/waist/hips). Optional for backwards compatibility with characters created before the measurement-review step existed.",
		),
});

export type Character = z.infer<typeof characterSchema>;

export const getFullName = (
	c: Pick<Character, "firstName" | "lastName">,
): string => `${c.firstName} ${c.lastName}`.trim();

export const characterVisualSchema = characterSchema.pick({
	customPhysicalDetails: true,
	customFaceDetails: true,
	baseGenerationPrompt: true,
	baseImagePrompt: true,
});

export type CharacterVisual = z.infer<typeof characterVisualSchema>;

export const characterCoreSchema = characterSchema.omit({
	customPhysicalDetails: true,
	customFaceDetails: true,
	baseGenerationPrompt: true,
	baseImagePrompt: true,
});

export type CharacterCore = z.infer<typeof characterCoreSchema>;

export const scenarioOnlySchema = characterSchema.pick({ scenario: true });
export type ScenarioOnly = z.infer<typeof scenarioOnlySchema>;

export const personalityOnlySchema = characterSchema.pick({
	additionalPersonalityDetails: true,
});
export type PersonalityOnly = z.infer<typeof personalityOnlySchema>;

export const extraDetailsOnlySchema = characterSchema.pick({
	extraDetails: true,
});
export type ExtraDetailsOnly = z.infer<typeof extraDetailsOnlySchema>;

export const characterLightSchema = characterSchema
	.pick({
		firstName: true,
		lastName: true,
		publicDescription: true,
		greetingMessage: true,
		firstReplySuggestion: true,
		personalityLabel: true,
		occupationLabel: true,
		relationshipLabel: true,
		hobbyLabel: true,
		fetishLabel: true,
		difficultyProfile: true,
		intimacyProfile: true,
	})
	.extend({
		moodAxes: moodAxesSchema.describe(
			"Two fixed mood axes tracked on 0-100 during conversation — generated fresh each light run.",
		),
	});
export type CharacterLight = z.infer<typeof characterLightSchema>;

export const sceneSchema = z.object({
	sceneName: z
		.string()
		.describe("Short name for the scene (e.g. 'Lounge Bar Evening')"),
	prompt: z
		.string()
		.describe(
			"Image prompt for this scene. Format depends on the chosen image model — Vivid 1 uses sectioned `Break.`-separated prose with weighted parens; Vivid 2 uses short comma- or period-separated tag-like sentences; Vivid 3 uses fully natural descriptive prose with no tags or weights; Dreamy uses comma-separated tags.",
		),
	negativePrompt: z
		.string()
		.optional()
		.describe(
			"ONLY for Dreamy model: comma-separated tags describing what the image MUST avoid. Leave omitted for Vivid / Vivid 2.",
		),
});

export type Scene = z.infer<typeof sceneSchema>;

export const MIN_SCENE_COUNT = 1;
export const MAX_SCENE_COUNT = 16;
export const DEFAULT_SCENE_COUNT = 4;

export function clampSceneCount(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_SCENE_COUNT;
	const i = Math.round(n);
	return Math.max(MIN_SCENE_COUNT, Math.min(MAX_SCENE_COUNT, i));
}

export const scenesOutputSchema = z.object({
	scenes: z
		.array(sceneSchema)
		.min(MIN_SCENE_COUNT)
		.max(MAX_SCENE_COUNT)
		.describe("Scene image prompts (count derived from gathering selection)"),
});

export const singleSceneOutputSchema = z.object({
	scene: sceneSchema,
});

export interface StoredCharacter {
	id: string;
	createdAt: string;
	character: Character;
	scenes: Scene[];
	difficulty: Difficulty;
	messageLength?: MessageLength;
	imageModel?: ImageModel;
	ourdreamUrl?: string;
	profileImageUrl?: string;
	gatheringSummary?: string;
	confirmedProfile?: ConfirmedProfile;
	gatheringMessages?: UIMessage[];
	sceneGatheringMessages?: UIMessage[];
}

export function getStoredMessageLength(
	stored: Pick<StoredCharacter, "messageLength">,
): MessageLength {
	return stored.messageLength ?? DEFAULT_MESSAGE_LENGTH;
}

export function getStoredImageModel(
	stored: Pick<StoredCharacter, "imageModel">,
): ImageModel {
	return stored.imageModel ?? DEFAULT_IMAGE_MODEL;
}

export const CHARACTER_STEP_IDS = [
	"light",
	"scenario",
	"personality",
	"extras",
	"visual",
] as const;
export type CharacterStepId = (typeof CHARACTER_STEP_IDS)[number];

export const GENERATION_MODELS = ["opus", "sonnet"] as const;
export type GenerationModel = (typeof GENERATION_MODELS)[number];
export const DEFAULT_GENERATION_MODEL: GenerationModel = "opus";

export const GENERATION_MODEL_META: Record<
	GenerationModel,
	{ label: string; description: string }
> = {
	opus: {
		label: "Claude Opus",
		description:
			"Highest quality and most nuanced output. Slower and more expensive — the default for character work.",
	},
	sonnet: {
		label: "Claude Sonnet",
		description:
			"Faster and cheaper than Opus with strong quality. A good pick when iterating quickly.",
	},
};

export const appSettingsSchema = z.object({
	superAdmin: z.boolean().default(false),
	generationModel: z.enum(GENERATION_MODELS).default(DEFAULT_GENERATION_MODEL),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
	superAdmin: false,
	generationModel: DEFAULT_GENERATION_MODEL,
};
