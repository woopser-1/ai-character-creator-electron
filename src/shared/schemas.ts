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

export const CHARACTER_GENDERS = ["female", "male"] as const;
export type CharacterGender = (typeof CHARACTER_GENDERS)[number];

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

export const TRACKED_MOOD_AXIS_LABELS = [
	"Composure",
	"Openness",
	"Trust",
	"Warmth",
	"Confidence",
	"Playfulness",
	"Curiosity",
	"Vulnerability",
	"Guardedness",
	"Attraction",
	"Affection",
	"Independence",
	"Dominance",
	"Patience",
	"Honesty",
	"Jealousy",
	"Anxiety",
	"Desire",
] as const;
export type TrackedMoodAxisLabel = (typeof TRACKED_MOOD_AXIS_LABELS)[number];

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
			"Integer 0-100 at which this axis begins on first interaction. Must reflect the chosen difficulty (Extreme 0-15, Hard 10-25, Medium 25-50, Easy 40-60) AND the nature of the axis (a 'Loyalty' axis may start high; a 'Trust' axis may start low).",
		),
	reasoning: z
		.string()
		.min(1)
		.describe(
			"Brief explanation of why this axis was picked for this character and why the starting value fits.",
		),
});

export type MoodAxis = z.infer<typeof moodAxisSchema>;

export const generatedVisibleMoodAxisSchema = moodAxisSchema.extend({
	label: z
		.enum(TRACKED_MOOD_AXIS_LABELS)
		.describe(
			"Canonical visible mood/personality trait label. Must be one of the predefined generic tracked labels; never invent a context-specific label.",
		),
});

export type GeneratedVisibleMoodAxis = z.infer<
	typeof generatedVisibleMoodAxisSchema
>;

// MoodAxes uses a fixed visible primary + secondary (which appear in the
// metadata header) plus an OPTIONAL `hidden` array of 1-3 additional axes that
// evolve silently in the background and condition behavior without surfacing in
// the visible header. Hidden axes still mutate per reply.
export const moodAxesSchema = z.object({
	primary: moodAxisSchema.describe(
		"The first visible axis — appears in the metadata header. Should be the axis MOST influenced by the user's behavior in the context of this specific character.",
	),
	secondary: moodAxisSchema.describe(
		"The second visible axis — appears in the metadata header. Should be the axis that creates the most dramatic tension with the primary axis.",
	),
	hidden: z
		.array(moodAxisSchema)
		.min(1)
		.max(3)
		.optional()
		.describe(
			"1-3 ADDITIONAL hidden axes that evolve silently in the background. They DO NOT appear in the metadata header but still mutate per reply and shape narrative behavior (e.g. 'Loyalty to clique', 'Inner doubt', 'Public persona'). Pick hidden axes that capture nuances specific to this character — internal tensions, social obligations, private fears, secret cravings. Hidden axes MUST NOT duplicate or trivially mirror the visible primary/secondary.",
		),
});

export type MoodAxes = z.infer<typeof moodAxesSchema>;

export const generatedMoodAxesSchema = moodAxesSchema
	.extend({
		primary: generatedVisibleMoodAxisSchema.describe(
			"The first visible axis. Its label MUST be chosen from the predefined tracked label enum.",
		),
		secondary: generatedVisibleMoodAxisSchema.describe(
			"The second visible axis. Its label MUST be chosen from the predefined tracked label enum and must not duplicate primary.label.",
		),
	})
	.refine((axes) => axes.primary.label !== axes.secondary.label, {
		message: "primary.label and secondary.label must be different",
		path: ["secondary", "label"],
	});

export type GeneratedMoodAxes = z.infer<typeof generatedMoodAxesSchema>;

// Helper — flat list of all axes (visible + hidden).
export function getAllMoodAxes(m: MoodAxes): MoodAxis[] {
	return [m.primary, m.secondary, ...(m.hidden ?? [])];
}

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
		.describe(
			"Chest/bust circumference in centimeters. For male characters, this is chest circumference.",
		),
	cupSize: z
		.string()
		.min(1)
		.max(6)
		.describe(
			"Bra cup size for female characters, e.g. 'A', 'B', 'C', 'D', 'DD', 'DDD+'. Use 'N/A' for male characters.",
		),
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

// === OurDream atomic form fields ===
// Eight prose-rich strings that mirror customPhysicalDetails / customFaceDetails
// and feed OurDream's atomic creation form. Each value is a coherent descriptive
// phrase (gold-standard format: "very slim lean athletic build, slim narrow hips,
// subtle thigh gap"), not a single enum label. Generated by the visual Haiku pass
// alongside the prose fields — all blocks must describe the same coherent person.

export const ourDreamFieldsSchema = z.object({
	hairStyle: z
		.string()
		.min(1)
		.describe(
			"Hair style as prose or parenthesised tags. Gold-standard examples: '(long_wavy_hair), (voluminous_hair), (loose_waves_hair)' or in natural prose 'long wavy voluminous hair worn loose past the shoulders'. Must match the hair style described in customPhysicalDetails and baseGenerationPrompt.",
		),
	hairColor: z
		.string()
		.min(1)
		.describe(
			"Hair color as rich prose, e.g. 'honey blonde hair with lighter face-framing highlights and warm golden roots'. Must match the colour written in customPhysicalDetails.",
		),
	bodyType: z
		.string()
		.min(1)
		.describe(
			"Body build as concrete proportion prose, e.g. 'very slim lean athletic build, slim narrow hips, subtle thigh gap'. Must match the body type used in customPhysicalDetails / baseGenerationPrompt.",
		),
	ethnicity: z
		.string()
		.min(1)
		.describe(
			"Specific ethnicity preset (Korean, Hispanic-Colombiana, Scandinavian, Mexican-American, etc.) — NEVER broad labels alone. Match exactly what was written in baseGenerationPrompt.",
		),
	skinColor: z
		.string()
		.min(1)
		.describe(
			"Skin tone + finish descriptor, e.g. 'warm golden sun-kissed tan skin with a natural dewy glow'. Must match the skin description in customPhysicalDetails.",
		),
	breastSize: z
		.string()
		.min(1)
		.describe(
			"Chest/breast shape + size as prose. For female characters, describe breasts, e.g. 'medium firm perky natural breasts, youthful lift'. For male characters, describe the masculine chest/pectorals, e.g. 'broad masculine chest with defined pectorals'. Must be proportional to bodyType.",
		),
	buttSize: z
		.string()
		.min(1)
		.describe(
			"Butt shape + size as prose, e.g. 'small skinny rounded perky butt, high lift'. Must be proportional to bodyType.",
		),
	eyeColor: z
		.string()
		.min(1)
		.describe(
			"Eye color + qualifier as prose, e.g. 'large sparkling vivid bright blue eyes'. Must match the eye colour in customFaceDetails.",
		),
	tags: z
		.array(z.string().min(1))
		.min(8)
		.max(15)
		.describe(
			"8-15 categorical tags in Title Case (1-3 words each) used for character discovery on OurDream. Mix categories — aim for: 1-2 physical descriptors (e.g. 'Blonde', 'Tan', 'Athletic'), 1-2 personality traits (e.g. 'Bubbly', 'Brat', 'Shy'), 1-3 context/scenario tags (e.g. 'College', 'Sorority', 'Step Daughter'), 1-2 narrative arc tags (e.g. 'Slow Burn', 'Romance', 'Forbidden'), and 1 quality/style tag (e.g. 'Realistic', 'Earned'). Tags must be coherent with the character's actual physical traits, personality, and scenario — never generic filler.",
		),
});

export type OurDreamFields = z.infer<typeof ourDreamFieldsSchema>;

export const OUR_DREAM_FIELD_KEYS = [
	"hairStyle",
	"hairColor",
	"bodyType",
	"ethnicity",
	"skinColor",
	"breastSize",
	"buttSize",
	"eyeColor",
] as const satisfies readonly (keyof OurDreamFields)[];

// === Profile preview (inferred before generation, editable in the review screen) ===

export const characterProfilePreviewSchema = z.object({
	measurements: measurementsSchema,
	difficultyProfile: difficultyProfileSchema,
	intimacyProfile: intimacyProfileSchema,
	moodAxes: generatedMoodAxesSchema,
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
	hidden: z.array(confirmedMoodAxisSchema).min(1).max(3).optional(),
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
	age: z
		.number()
		.int()
		.min(18)
		.max(99)
		.optional()
		.describe(
			"The character's age in years (integer 18-99). Optional for backwards compatibility with characters created before this field existed — but required for all new generations (enforced in characterVisualSchema). Must match the age woven into baseGenerationPrompt and any image prompts.",
		),
	gender: z
		.enum(CHARACTER_GENDERS)
		.optional()
		.describe(
			"The character's gender presentation. Optional for backwards compatibility; required for new generated characters.",
		),
	baseGenerationPrompt: z
		.string()
		.describe(
			"Detailed generation prompt with exhaustive body and face details: ethnicity, body type/build, chest/breast shape, chest/bust size, butt shape/size, waist/hip proportions, height, skin tone, hair colour/length/style, eye colour, facial structure, and personality essence. Written as a natural flowing description.",
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
			"The character's greeting message starting with a hidden state_v1 HTML comment, then the 3-line Date/Loc, Outfit/State, Mood header, then *actions* in asterisks, then plain dialogue or text: lines (e.g. text: hey there)",
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
			"A complete scenario with narrative setup, behavioral systems, metadata header rules, optional text: lines for remote speech, and asterisks for extra context",
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
	ourDreamFields: ourDreamFieldsSchema
		.optional()
		.describe(
			"Atomic OurDream form fields (hairStyle, hairColor, bodyType, ethnicity, skinColor, breastSize, buttSize, eyeColor) — prose-rich values that mirror customPhysicalDetails/customFaceDetails. The legacy breastSize key stores chest/breast prose depending on gender. Optional for backwards compatibility with characters created before this field existed.",
		),
});

export type Character = z.infer<typeof characterSchema>;

export const getFullName = (
	c: Pick<Character, "firstName" | "lastName">,
): string => `${c.firstName} ${c.lastName}`.trim();

export const characterVisualSchema = characterSchema
	.pick({
		customPhysicalDetails: true,
		customFaceDetails: true,
		baseGenerationPrompt: true,
		baseImagePrompt: true,
	})
	.extend({
		age: z
			.number()
			.int()
			.min(18)
			.max(99)
			.describe(
				"The character's age (integer 18-99) — REQUIRED on visual generation. Must match the age woven into baseGenerationPrompt and baseImagePrompt.",
			),
		ourDreamFields: ourDreamFieldsSchema.describe(
			"Required on visual generation: the 9 atomic OurDream fields (8 physical + tags array), prose-rich and coherent with the other visual prose blocks.",
		),
	});

export type CharacterVisual = z.infer<typeof characterVisualSchema>;

export const characterCoreSchema = characterSchema.omit({
	customPhysicalDetails: true,
	customFaceDetails: true,
	baseGenerationPrompt: true,
	baseImagePrompt: true,
	ourDreamFields: true,
});

export type CharacterCore = z.infer<typeof characterCoreSchema>;

export const scenarioOnlySchema = z.object({
	scenario: z
		.string()
		.min(1500)
		.describe(
			"Complete scenario field with narrative setup, romance/intimacy pacing, hidden trust system, scene progression, wardrobe state, and format rules.",
		),
});
export type ScenarioOnly = z.infer<typeof scenarioOnlySchema>;

export const personalityOnlySchema = z.object({
	additionalPersonalityDetails: z
		.string()
		.min(6000)
		.describe(
			"Complete XML-tagged behavioral personality spec. Must include all required personality sections in order.",
		),
});
export type PersonalityOnly = z.infer<typeof personalityOnlySchema>;

export const extraDetailsOnlySchema = z.object({
	extraDetails: z
		.string()
		.min(1000)
		.describe(
			"Complete XML-tagged lore and memory spec including Setting, Backstory, Relationship_And_Intimacy_History, Key_NPCs, NPC_Voice_Guidance, and Core_Behavior_And_Memory.",
		),
});
export type ExtraDetailsOnly = z.infer<typeof extraDetailsOnlySchema>;

export const systemFrameworkUpgradeSchema = characterSchema
	.pick({ scenario: true, greetingMessage: true })
	.extend({
		moodAxes: moodAxesSchema.describe(
			"The upgraded moodAxes — preserved verbatim if the existing primary is intrinsic and secondary is relational, otherwise swapped/adjusted per the intrinsic/relational convention.",
		),
	});
export type SystemFrameworkUpgrade = z.infer<
	typeof systemFrameworkUpgradeSchema
>;

export const vivid3PhysicalRefreshSchema = characterSchema.pick({
	customPhysicalDetails: true,
	customFaceDetails: true,
	baseGenerationPrompt: true,
	baseImagePrompt: true,
	ourDreamFields: true,
});
export type Vivid3PhysicalRefresh = z.infer<typeof vivid3PhysicalRefreshSchema>;

export const characterLightSchema = characterSchema
	.pick({
		firstName: true,
		lastName: true,
		gender: true,
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
		publicDescription: z.string().min(120).max(600),
		gender: z.enum(CHARACTER_GENDERS),
		greetingMessage: z.string().min(80).max(3500),
		firstReplySuggestion: z.string().min(1).max(100),
		personalityLabel: z.string().min(2).max(60),
		occupationLabel: z.string().min(2).max(60),
		relationshipLabel: z.string().min(2).max(60),
		hobbyLabel: z.string().min(2).max(60),
		fetishLabel: z.string().min(2).max(60),
		moodAxes: generatedMoodAxesSchema.describe(
			"Two fixed visible mood axes tracked on 0-100 during conversation. Visible labels must come from the predefined tracked label enum.",
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
			"Comma-separated tag list of things the image MUST avoid. Supported by all image models (Vivid 1, Vivid 2, Vivid 3, Dreamy). Optional only for backwards compatibility with scenes created before negative prompts were supported on Vivid; new scenes should always include it.",
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
	/** When this character was forked from another via Rewind from a completed character. */
	sourceCharacterId?: string;
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

export interface ModelPreset {
	id: string;
	label: string;
	description: string;
}

export const OPENROUTER_MODEL_PRESETS: readonly ModelPreset[] = [
	{
		id: "deepseek/deepseek-v4-flash",
		label: "DeepSeek V4 Flash",
		description:
			"Fast and very cheap with a 1M-token context. Recommended default for character work.",
	},
	{
		id: "deepseek/deepseek-v4-pro",
		label: "DeepSeek V4 Pro",
		description:
			"Highest-quality DeepSeek with a 1M-token context. Slower and more expensive — use as the main model when quality matters most.",
	},
	{
		id: "deepseek/deepseek-v3.2",
		label: "DeepSeek V3.2",
		description: "Strong quality with a 131K-token context.",
	},
	{
		id: "deepseek/deepseek-chat-v3.1",
		label: "DeepSeek V3.1",
		description: "Previous-generation chat model with a 164K-token context.",
	},
];

export const DEFAULT_MAIN_MODEL = "deepseek/deepseek-v4-flash";
export const DEFAULT_FAST_MODEL = "deepseek/deepseek-v4-flash";

export interface ModelTiers {
	/** Heavy steps: light/scenario/personality/extras, scenes, group chats. */
	main: string;
	/** Light steps: visual, measurements, profile inference. */
	fast: string;
}

export const groupChatGreetingSchema = z.object({
	speakerFirstName: z
		.string()
		.min(1)
		.describe(
			"First name of the speaking character. MUST match the firstName of ONE of the chosen characters verbatim — no nicknames, no last names, no characters outside the cast.",
		),
	message: z
		.string()
		.min(1)
		.describe(
			"The character's opening message body. MUST start with the standard 3-line bracketed metadata header (line 1: `[Date: …] [Loc: …]`, line 2: `[Outfit: …] [State: …]`, line 3: `[Mood: …]`), then a blank line, then the body. The body uses *asterisks* for action beats and spoken dialogue on plain lines. Group chats are IN-PERSON scenes — do NOT use the `text:` or `call:` prefixes (those are for SMS / phone-call single-character scenarios). Length should respect the group chat's messageLength preference. Speaker identity is captured by the sibling `speakerFirstName` field; do not encode it inside the body.",
		),
});

export type GroupChatGreeting = z.infer<typeof groupChatGreetingSchema>;

export const MIN_GROUP_CHAT_GREETINGS = 1;
export const MAX_GROUP_CHAT_GREETINGS = 5;

export const singleGroupChatGreetingOutputSchema = z.object({
	greeting: groupChatGreetingSchema,
});
export type SingleGroupChatGreetingOutput = z.infer<
	typeof singleGroupChatGreetingOutputSchema
>;

export const groupChatSchema = z.object({
	title: z
		.string()
		.min(1)
		.describe(
			"Short, evocative title naming this multi-character chat scenario (e.g. 'Late-night studio session with Mira & Soren', '48 hours in Lisbon — Astrid, Cal and Reza'). Plain text, no quotes.",
		),
	publicDescription: z
		.string()
		.describe(
			"Public-facing one-paragraph description that introduces the scene and the chosen characters as a group. Reads as a story-blurb the user could paste publicly — names the characters and the setup without exposing the dynamic mechanics from privateDetails.",
		),
	scenario: z
		.string()
		.describe(
			"Detailed narrative setup (~1800-2400 chars) of the group chat scene followed by a [FORMAT RULES] block. The narrative establishes location, time of day, why these specific characters are together, and what is happening when the conversation opens. The trailing [FORMAT RULES] block defines the 3-line metadata-header convention — [Date: …] [Loc: …] / [Outfit: …] [State: …] / [Mood: …] — and how speakers rotate, how the user is addressed, and how *asterisk-wrapped* actions + plain-line dialogue work. Group chats are in-person scenes; no `text:` or `call:` prefixes.",
		),
	privateDetails: z
		.string()
		.describe(
			"Director's-cut full system spec (~1800-2800 chars) — NOT public. Structured as XML-tagged behavioral sections (same convention as a Character's additionalPersonalityDetails). MUST include, in this exact order, these top-level tags with their exact names: <Cast_Roster>, <Per_Character_Stance> (with nested per-character <{FirstName}> sub-blocks), <Alliance_Tension_Map>, <Message_Header_Template> (containing the literal 3-line [Date: …] / [Outfit: …] / [Mood: …] template the downstream chat must prepend to every assistant turn), <Speaker_Rotation>, <Pacing_And_Escalation>, <User_Integration>, <Hidden_Group_Trust_System>. Use weighted notation (label:1.X) inside sections for high-priority directives.",
		),
	greetingMessages: z
		.array(groupChatGreetingSchema)
		.min(MIN_GROUP_CHAT_GREETINGS)
		.max(MAX_GROUP_CHAT_GREETINGS)
		.describe(
			"REQUIRED. 1-5 opening messages in chronological order — these are the literal first turns the downstream chat starts the conversation with, before the user has typed anything. Each entry pairs a speakerFirstName (matching one of the cast's first names verbatim) with the message body in the multi-speaker metadata-header format. Not every cast member must speak — a 4-character group chat might open with just 2 of them exchanging dialogue while the others observe — but the array MUST contain at least one entry. The first message in the array is the very first thing the downstream chat says; subsequent messages are interjections / responses building the opening beat. Length tracks the messageLength preference.",
		),
	tags: z
		.array(z.string().min(1))
		.min(6)
		.max(12)
		.describe(
			"6-12 categorical tags in Title Case (1-3 words each) used for group chat discovery and at-a-glance browsing. Mix categories — aim for: 1-2 setting tags (e.g. 'Dinner Party', 'Layover', 'After Hours', 'Beach House'), 1-2 ensemble dynamic tags (e.g. 'Love Triangle', 'Old Friends', 'Rivalry', 'Found Family'), 1-2 tone tags (e.g. 'Chill Banter', 'Simmering Tension', 'Slow Burn', 'Comedy'), 1-2 narrative arc tags (e.g. 'Reunion', 'Confrontation', 'Secret Revealed', 'Power Shift'), and 1-2 user-POV tags (e.g. 'POV Host', 'Outsider', 'Romantic Triangle'). Tags must be coherent with this specific scenario — never generic filler.",
		),
});

export type GroupChat = z.infer<typeof groupChatSchema>;

export interface StoredGroupChat {
	id: string;
	createdAt: string;
	groupChat: GroupChat;
	/** References to existing StoredCharacter.id — 2..6 entries. */
	characterIds: string[];
	messageLength: MessageLength;
	gatheringSummary?: string;
	gatheringMessages?: UIMessage[];
}

export const MIN_GROUP_CHAT_CHARACTERS = 2;
export const MAX_GROUP_CHAT_CHARACTERS = 6;

export const appSettingsSchema = z.object({
	superAdmin: z.boolean().default(false),
	/** OpenRouter model used for heavy generation steps and interactive gathering. */
	mainModel: z.string().min(1).default(DEFAULT_MAIN_MODEL),
	/** OpenRouter model used for light steps (visual, measurements, profile inference). */
	fastModel: z.string().min(1).default(DEFAULT_FAST_MODEL),
	/** Last difficulty the user picked in a /create session; reused as the default next time. */
	lastDifficulty: z.enum(DIFFICULTIES).optional(),
	/** Last reply-length preference the user picked; reused as the default next time. */
	lastMessageLength: z.enum(MESSAGE_LENGTHS).optional(),
	/** Last image model the user picked; reused as the default next time. */
	lastImageModel: z.enum(IMAGE_MODELS).optional(),
	/** ISO timestamp of the last successful profile-image refresh pass. */
	lastImageRefreshAt: z.string().optional(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
	superAdmin: false,
	mainModel: DEFAULT_MAIN_MODEL,
	fastModel: DEFAULT_FAST_MODEL,
};

export function resolveModelTiers(
	settings: Pick<AppSettings, "mainModel" | "fastModel">,
): ModelTiers {
	return { main: settings.mainModel, fast: settings.fastModel };
}
