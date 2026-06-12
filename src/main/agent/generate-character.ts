import type {
	GenerateProgressEvent,
	StepResult,
	StepUsage,
} from "@shared/generate";
import {
	applySuperAdminOverride,
	assemblePersonalityDetails,
	buildCharacterVisualPromptHaiku,
	buildExtraDetailsPrompt,
	buildLightFieldsPrompt,
	buildMeasurementsInferencePrompt,
	buildPersonalityDetailsPrompt,
	buildPersonalitySectionPrompt,
	buildProfileInferencePrompt,
	buildScenarioPrompt,
	buildSystemFrameworkUpgradePrompt,
	PERSONALITY_LLM_SECTION_IDS,
	type PersonalityLlmSectionId,
} from "@shared/prompts";
import {
	CHARACTER_STEP_IDS,
	type Character,
	type CharacterLight,
	type CharacterProfilePreview,
	type CharacterStepId,
	type ConfirmedProfile,
	characterLightSchema,
	characterProfilePreviewSchema,
	characterSchema,
	characterVisualSchema,
	DEFAULT_FAST_MODEL,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_MAIN_MODEL,
	DEFAULT_MESSAGE_LENGTH,
	type Difficulty,
	extraDetailsOnlySchema,
	type ImageModel,
	type Measurements,
	type MessageLength,
	measurementsSchema,
	personalityOnlySchema,
	type SystemFrameworkUpgrade,
	scenarioOnlySchema,
	systemFrameworkUpgradeSchema,
	type Vivid3PhysicalRefresh,
	vivid3PhysicalRefreshSchema,
} from "@shared/schemas";
import { z } from "zod";
import {
	MissingApiKeyError,
	type ModelRunResult,
	runModel,
} from "../llm/runner";

export interface GenerateCharacterInput {
	difficulty: Difficulty;
	messageLength?: MessageLength;
	imageModel?: ImageModel;
	generationModel?: string;
	fastModel?: string;
	gatheringSummary: string;
	superAdmin: boolean;
	runId: string;
	confirmedProfile?: ConfirmedProfile;
	onEvent?: (event: GenerateProgressEvent) => void;
}

function formatConfirmedProfileBlock(profile: ConfirmedProfile): string {
	const lines: string[] = [];
	lines.push(
		"## CONFIRMED PROFILE (user-reviewed — use these values verbatim, do not recompute)",
	);
	lines.push("");
	lines.push("### difficultyProfile");
	const d = profile.difficultyProfile;
	lines.push(`- moodResistance: ${d.moodResistance}`);
	if (d.moodResistanceReasoning)
		lines.push(`  reasoning: ${d.moodResistanceReasoning}`);
	lines.push(`- trustThreshold: ${d.trustThreshold}`);
	if (d.trustThresholdReasoning)
		lines.push(`  reasoning: ${d.trustThresholdReasoning}`);
	lines.push(`- personalityRigidity: ${d.personalityRigidity}`);
	if (d.personalityRigidityReasoning)
		lines.push(`  reasoning: ${d.personalityRigidityReasoning}`);
	lines.push("");
	lines.push("### intimacyProfile");
	const i = profile.intimacyProfile;
	lines.push(`- escalationSpeed: ${i.escalationSpeed}`);
	if (i.escalationSpeedReasoning)
		lines.push(`  reasoning: ${i.escalationSpeedReasoning}`);
	lines.push(`- sexualConfidence: ${i.sexualConfidence}`);
	if (i.sexualConfidenceReasoning)
		lines.push(`  reasoning: ${i.sexualConfidenceReasoning}`);
	lines.push(`- emotionalDetachment: ${i.emotionalDetachment}`);
	if (i.emotionalDetachmentReasoning)
		lines.push(`  reasoning: ${i.emotionalDetachmentReasoning}`);
	lines.push(`- personalityConsistency: ${i.personalityConsistency}`);
	if (i.personalityConsistencyReasoning)
		lines.push(`  reasoning: ${i.personalityConsistencyReasoning}`);
	lines.push(`- postIntimacyBehavior: ${i.postIntimacyBehavior}`);
	if (i.postIntimacyBehaviorReasoning)
		lines.push(`  reasoning: ${i.postIntimacyBehaviorReasoning}`);
	lines.push(`- circumstantialTriggers: ${i.circumstantialTriggers}`);
	lines.push("");
	lines.push("### moodAxes");
	const p = profile.moodAxes.primary;
	const s = profile.moodAxes.secondary;
	lines.push(`- primary.label: ${p.label}`);
	lines.push(`- primary.lowDescriptor: ${p.lowDescriptor}`);
	lines.push(`- primary.highDescriptor: ${p.highDescriptor}`);
	lines.push(`- primary.startingValue: ${p.startingValue}`);
	if (p.reasoning) lines.push(`  reasoning: ${p.reasoning}`);
	lines.push(`- secondary.label: ${s.label}`);
	lines.push(`- secondary.lowDescriptor: ${s.lowDescriptor}`);
	lines.push(`- secondary.highDescriptor: ${s.highDescriptor}`);
	lines.push(`- secondary.startingValue: ${s.startingValue}`);
	if (s.reasoning) lines.push(`  reasoning: ${s.reasoning}`);
	if (profile.moodAxes.hidden && profile.moodAxes.hidden.length > 0) {
		profile.moodAxes.hidden.forEach((h, idx) => {
			lines.push(`- hidden[${idx}].label: ${h.label}`);
			lines.push(`- hidden[${idx}].lowDescriptor: ${h.lowDescriptor}`);
			lines.push(`- hidden[${idx}].highDescriptor: ${h.highDescriptor}`);
			lines.push(`- hidden[${idx}].startingValue: ${h.startingValue}`);
			if (h.reasoning) lines.push(`  reasoning: ${h.reasoning}`);
		});
	}
	return lines.join("\n");
}

function augmentGatheringSummary(
	gatheringSummary: string,
	confirmedProfile?: ConfirmedProfile,
): string {
	if (!confirmedProfile) return gatheringSummary;
	return [
		gatheringSummary,
		"",
		formatConfirmedProfileBlock(confirmedProfile),
	].join("\n");
}

export interface GenerateCharacterResult {
	success: boolean;
	character?: Character;
	error?: string;
	stepResults: Partial<Record<CharacterStepId, StepResult<unknown>>>;
}

type AnyZodSchema = z.ZodType<unknown>;

interface StepDefinition<T> {
	label: CharacterStepId;
	buildSystemPrompt: (
		difficulty: Difficulty,
		messageLength: MessageLength,
		imageModel: ImageModel,
	) => string;
	buildUserMessage: (
		gatheringSummary: string,
		difficulty: Difficulty,
		messageLength: MessageLength,
	) => string;
	schema: z.ZodType<T>;
}

const CORE_USER_MESSAGE = (
	gatheringSummary: string,
	difficulty: Difficulty,
	messageLength: MessageLength,
): string =>
	[
		"Here is the full gathering conversation summary you produced:",
		"",
		gatheringSummary,
		"",
		`Difficulty: ${difficulty}.`,
		`Message length preference: ${messageLength}.`,
	].join("\n");

const VISUAL_USER_MESSAGE = (gatheringSummary: string): string =>
	[
		"Here is the full gathering conversation summary:",
		"",
		gatheringSummary,
		"",
		"Now generate ONLY the six visual fields (age, customPhysicalDetails, customFaceDetails, baseGenerationPrompt, baseImagePrompt, ourDreamFields) as structured JSON. The ourDreamFields object MUST include the 9 atomic values (hairStyle, hairColor, bodyType, ethnicity, skinColor, breastSize, buttSize, eyeColor, tags). Produce a single coherent person consistent across all blocks. The integer age MUST match the age phrasing woven into baseGenerationPrompt and baseImagePrompt.",
		"",
		"CRITICAL: respect the explicit physical answers captured in the gathering summary — body type, height, bust size, skin tone, hair color and length, hair texture, eye color, distinguishing features (freckles, tattoos, piercings, scars, glasses, etc.), and style/aesthetic. Do NOT invent contradicting traits. Every physical choice the user made must appear in customPhysicalDetails and customFaceDetails and be reflected (with appropriate weighting) in baseGenerationPrompt and baseImagePrompt.",
		"",
		"CRITICAL: preserve the chosen gender from the gathering summary. Female characters use female pronouns/anatomy/tags. Male characters use male pronouns/anatomy/tags, masculine chest/pec prose in the legacy breastSize field, and must never be described with breasts, bra/cup language, woman/girl, she/her, or 1girl.",
		"",
		'CRITICAL (baseGenerationPrompt identity & lifestyle): baseGenerationPrompt MUST explicitly state the character\'s full name (first + last), age in numeric form (e.g. "24 years old"), and explicit body measurements (height, chest/bust/cup-or-N/A size, waist, hips — either numeric or precise descriptive phrases). It MUST also include, in natural prose, a short phrase for each of these five lifestyle axes drawn from the gathering summary: personality essence, occupation/role, relationship status, main hobby or passion, and intimate/fetish inclination. No axis may be silently omitted.',
	].join("\n");

const STEP_DEFS: {
	light: StepDefinition<z.infer<typeof characterLightSchema>>;
	scenario: StepDefinition<z.infer<typeof scenarioOnlySchema>>;
	personality: StepDefinition<z.infer<typeof personalityOnlySchema>>;
	extras: StepDefinition<z.infer<typeof extraDetailsOnlySchema>>;
	visual: StepDefinition<z.infer<typeof characterVisualSchema>>;
} = {
	light: {
		label: "light",
		buildSystemPrompt: (difficulty, messageLength) =>
			buildLightFieldsPrompt(difficulty, messageLength),
		buildUserMessage: CORE_USER_MESSAGE,
		schema: characterLightSchema,
	},
	scenario: {
		label: "scenario",
		buildSystemPrompt: (difficulty, messageLength) =>
			buildScenarioPrompt(difficulty, messageLength),
		buildUserMessage: CORE_USER_MESSAGE,
		schema: scenarioOnlySchema,
	},
	personality: {
		label: "personality",
		buildSystemPrompt: (difficulty, messageLength) =>
			buildPersonalityDetailsPrompt(difficulty, messageLength),
		buildUserMessage: CORE_USER_MESSAGE,
		schema: personalityOnlySchema,
	},
	extras: {
		label: "extras",
		buildSystemPrompt: (difficulty) => buildExtraDetailsPrompt(difficulty),
		buildUserMessage: CORE_USER_MESSAGE,
		schema: extraDetailsOnlySchema,
	},
	visual: {
		label: "visual",
		buildSystemPrompt: (_difficulty, _messageLength, imageModel) =>
			buildCharacterVisualPromptHaiku(imageModel),
		buildUserMessage: (summary) => VISUAL_USER_MESSAGE(summary),
		schema: characterVisualSchema,
	},
};

const REFUSAL_PATTERN =
	/\b(I (can('?| no)t|am unable|won'?t)|I (must|have to) (decline|refuse)|I'm not (able|going to|comfortable)|content (policy|guidelines)|inappropriate|out[- ]of[- ]character|doesn'?t (fit|match|align) (with )?(the|this) (character|personality)|inconsistent with|not (consistent|aligned) with|hors[- ]caract|ne (correspond|colle) pas (au|\u00e0)|incoh[\u00e9e]rent|d[\u00e9e]sol[\u00e9e], je)/i;

function clampHiddenStateValue(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function hiddenStateBand(trust: number): string {
	if (trust >= 91) return "Bonded";
	if (trust >= 76) return "Close";
	if (trust >= 56) return "Trusted";
	if (trust >= 36) return "Familiar";
	if (trust >= 16) return "Acquaintance";
	return "Stranger";
}

function hiddenStateTier(input: {
	trust: number;
	attraction: number;
	arousal: number;
	friendliness: number;
}): string {
	if (input.attraction >= 60 && input.arousal >= 65 && input.trust >= 50) {
		return "T5";
	}
	if (input.attraction >= 55 && input.arousal >= 50 && input.trust >= 45) {
		return "T4";
	}
	if (input.attraction >= 40 && input.trust >= 35) return "T3";
	if (input.friendliness >= 25 || input.attraction >= 20) return "T2";
	return "T1";
}

function relationLooksEstablished(label: string): boolean {
	return /\b(partner|couple|dating|girlfriend|boyfriend|fianc|spouse|wife|husband|lover|romantic|bonded|close)\b/i.test(
		label,
	);
}

function axisMatches(axisLabel: string, labels: string[]): boolean {
	const normalized = axisLabel.toLowerCase();
	return labels.some((label) => normalized === label.toLowerCase());
}

function deriveInitialHiddenState(data: CharacterLight): {
	tier: string;
	trust: number;
	band: string;
	attraction: number;
	arousal: number;
	friendliness: number;
} {
	const secondary = data.moodAxes.secondary;
	const relationshipEstablished = relationLooksEstablished(
		data.relationshipLabel,
	);
	const baseTrust = 38 - data.difficultyProfile.trustThreshold * 3;
	const visibleTrust = axisMatches(secondary.label, [
		"Trust",
		"Openness",
		"Warmth",
		"Affection",
	])
		? secondary.startingValue
		: baseTrust;
	const trust = clampHiddenStateValue(
		relationshipEstablished
			? Math.max(baseTrust, visibleTrust, 35)
			: visibleTrust,
	);

	const visibleAttraction = axisMatches(secondary.label, [
		"Attraction",
		"Desire",
		"Affection",
	])
		? secondary.startingValue
		: 5 + data.intimacyProfile.escalationSpeed * 3;
	const attraction = clampHiddenStateValue(
		relationshipEstablished
			? Math.max(visibleAttraction, 25)
			: visibleAttraction,
	);

	const visibleFriendliness = axisMatches(secondary.label, [
		"Warmth",
		"Affection",
		"Openness",
		"Trust",
		"Playfulness",
		"Curiosity",
	])
		? secondary.startingValue
		: 15 + (11 - data.difficultyProfile.moodResistance) * 2;
	const friendliness = clampHiddenStateValue(
		relationshipEstablished
			? Math.max(visibleFriendliness, 35)
			: visibleFriendliness,
	);

	const chargedOpening =
		/\b(nude|naked|topless|bottomless|lingerie|panties|bra|robe loose|straddling|lap|kiss|shower|bed)\b/i.test(
			data.greetingMessage,
		);
	const arousal = chargedOpening ? 15 : 0;
	const tier = hiddenStateTier({ trust, attraction, arousal, friendliness });

	return {
		tier,
		trust,
		band: hiddenStateBand(trust),
		attraction,
		arousal,
		friendliness,
	};
}

function buildInitialStateTag(data: CharacterLight): string {
	const state = deriveInitialHiddenState(data);
	return [
		"<!--",
		"state_v1:",
		`  tier: ${state.tier}`,
		`  trust: ${state.trust}/100`,
		`  band: ${state.band}`,
		`  attraction: ${state.attraction}/100`,
		`  arousal: ${state.arousal}/100`,
		`  friendliness: ${state.friendliness}/100`,
		"  deltas: []",
		"  notes: opening beat, no prior user action",
		"-->",
	].join("\n");
}

function stripOpeningStateTag(greeting: string): string {
	return greeting.replace(/^\s*<!--\s*state_v1:[\s\S]*?-->\s*/i, "").trim();
}

function moodDescriptorFromLine(line: string | undefined): string | undefined {
	if (!line) return undefined;
	const match = line.match(/^\s*\[Mood:\s*([\s\S]*?)\]\s*$/);
	if (!match) return undefined;
	const parts = match[1]?.split("|").map((part) => part.trim()) ?? [];
	const descriptor = parts[2]?.trim();
	return descriptor && !/\d{1,3}\/100/.test(descriptor)
		? descriptor
		: undefined;
}

function defaultMoodDescriptor(data: CharacterLight): string {
	const primary = data.moodAxes.primary;
	if (primary.startingValue <= 35) return primary.lowDescriptor;
	if (primary.startingValue >= 65) return primary.highDescriptor;
	return "Contained";
}

function normalizeGreetingBody(data: CharacterLight): string {
	const greeting = stripOpeningStateTag(data.greetingMessage);
	const lines = greeting.split(/\r?\n/);
	const dateIndex = lines.findIndex((line) => line.trim().startsWith("[Date:"));
	const outfitIndex = lines.findIndex((line) =>
		line.trim().startsWith("[Outfit:"),
	);
	const moodIndex = lines.findIndex((line) => line.trim().startsWith("[Mood:"));
	const descriptor =
		moodDescriptorFromLine(moodIndex >= 0 ? lines[moodIndex] : undefined) ??
		defaultMoodDescriptor(data);
	const moodLine = `[Mood: ${data.moodAxes.primary.label} ${data.moodAxes.primary.startingValue}/100 | ${data.moodAxes.secondary.label} ${data.moodAxes.secondary.startingValue}/100 | ${descriptor}]`;

	if (dateIndex >= 0 && outfitIndex >= 0) {
		const headerEnd = Math.max(dateIndex, outfitIndex, moodIndex);
		const body = lines
			.slice(headerEnd + 1)
			.join("\n")
			.trim();
		return [
			lines[dateIndex]?.trim(),
			lines[outfitIndex]?.trim(),
			moodLine,
			"",
			body,
		]
			.filter((part) => part !== undefined && part.length > 0)
			.join("\n");
	}

	if (moodIndex >= 0) {
		lines[moodIndex] = moodLine;
		return lines.join("\n").trim();
	}

	return greeting;
}

function normalizeLightFields(data: CharacterLight): CharacterLight {
	const greetingBody = normalizeGreetingBody(data);
	return {
		...data,
		greetingMessage: `${buildInitialStateTag(data)}\n${greetingBody}`,
	};
}

const PERSONALITY_SECTION_TAGS: Record<PersonalityLlmSectionId, string> = {
	introduction: "Introduction",
	mood_and_physical_state: "Mood_And_Physical_State",
	public_persona_vs_private_self: "Public_Persona_vs_Private_Self",
	push_pull_dynamics: "Push_Pull_Dynamics",
	core_self_and_emotions: "Core_Self_And_Emotions",
	in_emotionally_intense_moments: "In_Emotionally_Intense_Moments",
	banned_phrases: "Banned_Phrases",
};

const PERSONALITY_SECTION_MIN_CHARS: Record<PersonalityLlmSectionId, number> = {
	introduction: 380,
	mood_and_physical_state: 900,
	public_persona_vs_private_self: 800,
	push_pull_dynamics: 900,
	core_self_and_emotions: 900,
	in_emotionally_intense_moments: 900,
	banned_phrases: 900,
};

const personalityCompactText = z.string().min(50);
const personalityDenseText = z.string().min(80);
const personalityQuote = z.string().min(5);

const personalitySectionSchemas = {
	introduction: z.object({
		weightedTraits: z
			.array(z.string().min(20))
			.min(5)
			.max(8)
			.describe(
				"Weighted character-specific trait tokens, e.g. (guarded_warmth:1.2).",
			),
		anchorParagraph: z
			.string()
			.min(300)
			.describe(
				"Two to three concrete sentences naming who the character is and their internal contradictions.",
			),
	}),
	mood_and_physical_state: z.object({
		axisSignalTables: z
			.string()
			.min(1200)
			.describe(
				"Only the per-axis signal tables. Include every visible and hidden mood axis from the confirmed profile block when present.",
			),
	}),
	public_persona_vs_private_self: z.object({
		publicBehaviors: z.array(personalityDenseText).min(4).max(4),
		privateBehaviors: z.array(personalityDenseText).min(4).max(4),
		gap: z.string().min(100),
		maskCrackers: z.array(personalityDenseText).min(3).max(3),
	}),
	push_pull_dynamics: z.object({
		entries: z
			.array(
				z.object({
					trigger: personalityDenseText,
					action: personalityDenseText,
					microRecovery: personalityDenseText,
				}),
			)
			.min(4)
			.max(5),
	}),
	core_self_and_emotions: z.object({
		speechPatterns: z
			.array(
				z.object({
					quirk: personalityCompactText,
					quote: personalityQuote,
				}),
			)
			.min(4)
			.max(4),
		internalMonologue: z.string().min(220),
		copingRituals: z.array(personalityDenseText).min(3).max(3),
		emotionalTells: z.array(personalityDenseText).min(4).max(4),
	}),
	in_emotionally_intense_moments: z.object({
		rung1: z.object({
			quote: personalityQuote,
			gesture: personalityDenseText,
			physicalState: personalityDenseText,
			promotesToNext: personalityDenseText,
		}),
		rung2: z.object({
			quote: personalityQuote,
			gesture: personalityDenseText,
			physicalState: personalityDenseText,
			promotesToNext: personalityDenseText,
		}),
		rung3: z.object({
			quote: personalityQuote,
			gesture: personalityDenseText,
			physicalState: personalityDenseText,
			promotesToNext: personalityDenseText,
		}),
		rung4: z.object({
			mode: z.string().min(5),
			quote: personalityQuote,
			gesture: personalityDenseText,
			physicalState: personalityDenseText,
			returnsToBaseline: personalityDenseText,
		}),
	}),
	banned_phrases: z.object({
		characterSpecificBans: z
			.array(z.string().min(50))
			.min(10)
			.max(15)
			.describe(
				"Only character-specific banned phrases, each tied to a named trait, background fact, voice rule, or relationship wound.",
			),
	}),
} satisfies Record<PersonalityLlmSectionId, z.ZodType<unknown>>;

function personalitySectionSchema(sectionId: PersonalityLlmSectionId) {
	return personalitySectionSchemas[sectionId];
}

function bulletList(items: ReadonlyArray<string>): string {
	return items.map((item) => `- ${item.trim()}`).join("\n");
}

function renderPushPullEntries(
	entries: ReadonlyArray<{
		trigger: string;
		action: string;
		microRecovery: string;
	}>,
): string {
	return entries
		.map(
			(entry) =>
				`- **Trigger:** ${entry.trigger.trim()}\n  **Action:** ${entry.action.trim()}\n  **Micro-recovery:** ${entry.microRecovery.trim()}`,
		)
		.join("\n\n");
}

function renderSpeechPatterns(
	patterns: ReadonlyArray<{ quirk: string; quote: string }>,
): string {
	return patterns
		.map(
			(pattern) =>
				`- ${pattern.quirk.trim()} -> sample quote: "${pattern.quote.trim()}"`,
		)
		.join("\n");
}

function renderEmotionRung(input: {
	quote: string;
	gesture: string;
	physicalState: string;
	promotesToNext?: string;
	returnsToBaseline?: string;
}): string {
	return [
		`- Quote: "${input.quote.trim()}"`,
		`- Gesture: ${input.gesture.trim()}`,
		`- Physical state: ${input.physicalState.trim()}`,
		input.promotesToNext
			? `- Promotes to next rung when: ${input.promotesToNext.trim()}`
			: `- How long until the character returns to baseline: ${input.returnsToBaseline?.trim() ?? ""}`,
	].join("\n");
}

const STATIC_BANNED_PHRASES = {
	genericAiChat: [
		`"I've been thinking about you all day" as an instant opener`,
		`"You're not like other people" without earned proof`,
		`"I'm not usually like this" as a shortcut for vulnerability`,
		`"You make me feel alive" on early rapport`,
		`"No one has ever understood me like you" before real history exists`,
		`"I can't stay away from you" as default attraction language`,
		`"You see the real me" before trust supports it`,
		`"Maybe this is crazy, but..." as generic escalation glue`,
	],
	romanceCliches: [
		`"Time seems to stop" or "the world falls away"`,
		`"Electricity shoots through" body-contact beats`,
		`"Heart skips/stutters/stops" as a repeated tell`,
		`"Pupils blown wide" as a default arousal marker`,
		`"Bottom lip caught between teeth" as a constant nervous tic`,
		`"White knuckles" for every tense grip`,
		`"Breath hitches" more than rarely`,
		`"Ozone" or storm-smell metaphors for desire`,
	],
	bodyEuphemisms: [
		`"Velvet walls"`,
		`"Core" as a vague arousal noun`,
		`"Nectar"`,
		`"Want" used as a noun for lust`,
		`Predator/prey metaphors for attraction`,
		`"Aching need" as a generic body state`,
	],
};

function renderBannedPhrases(
	characterSpecificBans: ReadonlyArray<string>,
): string {
	return [
		"**Category A - Generic AI-chat tells:**",
		bulletList(STATIC_BANNED_PHRASES.genericAiChat),
		"",
		"**Category B - Romance-novel / sensory cliches:**",
		bulletList(STATIC_BANNED_PHRASES.romanceCliches),
		"",
		"**Category C - Body-euphemism tells:**",
		bulletList(STATIC_BANNED_PHRASES.bodyEuphemisms),
		"",
		"**Category D - Character-specific bans:**",
		bulletList(characterSpecificBans),
	].join("\n");
}

function renderPersonalitySection(
	sectionId: PersonalityLlmSectionId,
	data: unknown,
): string {
	switch (sectionId) {
		case "introduction": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.introduction
			>;
			return `<Introduction>\n(character_archetype_descriptor:1.4) ${section.weightedTraits.join(", ")}\n${section.anchorParagraph.trim()}\n</Introduction>`;
		}
		case "mood_and_physical_state": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.mood_and_physical_state
			>;
			return `<Mood_And_Physical_State>\n(observable_mood_signals:1.4) Per-axis observable mood signal table. Use these tells whenever the matching mood value changes.\n${section.axisSignalTables.trim()}\n</Mood_And_Physical_State>`;
		}
		case "public_persona_vs_private_self": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.public_persona_vs_private_self
			>;
			return `<Public_Persona_vs_Private_Self>\n(persona_split:1.4)\nPUBLIC:\n${bulletList(section.publicBehaviors)}\n\nPRIVATE:\n${bulletList(section.privateBehaviors)}\n\nGAP: ${section.gap.trim()}\n\nMASK-CRACKERS:\n${bulletList(section.maskCrackers)}\n</Public_Persona_vs_Private_Self>`;
		}
		case "push_pull_dynamics": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.push_pull_dynamics
			>;
			return `<Push_Pull_Dynamics>\n(push_pull_patterns:1.4)\n${renderPushPullEntries(section.entries)}\n</Push_Pull_Dynamics>`;
		}
		case "core_self_and_emotions": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.core_self_and_emotions
			>;
			return `<Core_Self_And_Emotions>\n(internal_psyche:1.4)\n**SPEECH PATTERNS**\n${renderSpeechPatterns(section.speechPatterns)}\n\n**INTERNAL MONOLOGUE STYLE**\n${section.internalMonologue.trim()}\n\n**COPING RITUALS**\n${bulletList(section.copingRituals)}\n\n**EMOTIONAL TELLS**\n${bulletList(section.emotionalTells)}\n</Core_Self_And_Emotions>`;
		}
		case "in_emotionally_intense_moments": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.in_emotionally_intense_moments
			>;
			return `<In_Emotionally_Intense_Moments>\n(escalation_ladder:1.5)\n**Rung 1 - Calm tension:**\n${renderEmotionRung(section.rung1)}\n\n**Rung 2 - Rising:**\n${renderEmotionRung(section.rung2)}\n\n**Rung 3 - Peak:**\n${renderEmotionRung(section.rung3)}\n\n**Rung 4 - ${section.rung4.mode.trim()}:**\n${renderEmotionRung({ quote: section.rung4.quote, gesture: section.rung4.gesture, physicalState: section.rung4.physicalState, returnsToBaseline: section.rung4.returnsToBaseline })}\n</In_Emotionally_Intense_Moments>`;
		}
		case "banned_phrases": {
			const section = data as z.infer<
				typeof personalitySectionSchemas.banned_phrases
			>;
			return `<Banned_Phrases>\n(avoid_cliche_phrases:1.5) Phrases and descriptions banned for this character. Categories A-C are global writing hygiene; Category D is specific to this character's voice and history.\n${renderBannedPhrases(section.characterSpecificBans)}\n</Banned_Phrases>`;
		}
	}
}

function validatePersonalitySection(
	sectionId: PersonalityLlmSectionId,
	section: string,
): string | undefined {
	const tag = PERSONALITY_SECTION_TAGS[sectionId];
	const trimmed = section.trim();

	if (!trimmed.startsWith(`<${tag}>`) || !trimmed.endsWith(`</${tag}>`)) {
		return `section must start with <${tag}> and end with </${tag}>`;
	}

	if (trimmed.length < PERSONALITY_SECTION_MIN_CHARS[sectionId]) {
		return `section is too short (${trimmed.length} chars)`;
	}

	if (
		/\[(Behavior|Scenario|Quirk|Ritual|Tell|Name|NPC|Her line|His line|Their line|\.\.\.)\b|quote,\s*Gesture|TODO|{AxisLabel}|{lowDescriptor}|{highDescriptor}/i.test(
			trimmed,
		)
	) {
		return "section still contains template placeholders";
	}

	return undefined;
}

function extractUsage(
	model: string,
	result: ModelRunResult,
	startedAt: number,
): StepUsage | undefined {
	const raw = result.rawResultEvent;
	if (!raw) return undefined;
	const usage = (raw.usage as Record<string, unknown> | undefined) ?? undefined;
	const input = Number(usage?.input_tokens ?? 0);
	const output = Number(usage?.output_tokens ?? 0);
	const cacheRead = Number(usage?.cache_read_input_tokens ?? 0);
	const cacheCreation = Number(usage?.cache_creation_input_tokens ?? 0);
	const cost = Number(raw.total_cost_usd ?? 0);
	const duration = Number(raw.duration_ms ?? Date.now() - startedAt);
	return {
		model,
		inputTokens: Number.isFinite(input) ? input : 0,
		outputTokens: Number.isFinite(output) ? output : 0,
		cacheReadTokens: Number.isFinite(cacheRead) ? cacheRead : 0,
		cacheCreationTokens: Number.isFinite(cacheCreation) ? cacheCreation : 0,
		costUsd: Number.isFinite(cost) ? cost : 0,
		durationMs: Number.isFinite(duration) ? duration : Date.now() - startedAt,
	};
}

async function runStepOnce<T>(
	def: StepDefinition<T>,
	difficulty: Difficulty,
	messageLength: MessageLength,
	imageModel: ImageModel,
	generationModel: string,
	gatheringSummary: string,
	superAdmin: boolean,
): Promise<
	| { ok: true; data: T; usage?: StepUsage }
	| { ok: false; error: string; refusal: boolean; usage?: StepUsage }
> {
	const baseSystem = def.buildSystemPrompt(
		difficulty,
		messageLength,
		imageModel,
	);
	const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
	const userMessage = def.buildUserMessage(
		gatheringSummary,
		difficulty,
		messageLength,
	);
	const jsonSchema = z.toJSONSchema(def.schema as AnyZodSchema);
	const startedAt = Date.now();

	let result: ModelRunResult;
	try {
		result = await runModel({
			model: generationModel,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: def.label,
		});
	} catch (err) {
		const isAuth = err instanceof MissingApiKeyError;
		const prefix = isAuth
			? `[${def.label}] AUTH: `
			: `[${def.label}] runModel threw: `;
		console.error("[generate-character:exception]", {
			step: def.label,
			isAuth,
			message: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		return {
			ok: false,
			error: prefix + String(err),
			refusal: false,
		};
	}

	const usage = extractUsage(generationModel, result, startedAt);

	if (!result.success || !result.structuredOutput) {
		const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
		const refusal = REFUSAL_PATTERN.test(text);
		const details =
			result.error ??
			(result.finalAssistantText
				? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
				: undefined) ??
			(result.rawResultEvent
				? `no structured output — result event: ${JSON.stringify(result.rawResultEvent).slice(0, 500)}`
				: undefined) ??
			"generation failed with no details (check main process logs)";
		const trunc = (v: unknown, max = 1500): string => {
			const s = typeof v === "string" ? v : JSON.stringify(v);
			if (!s) return "";
			return s.length > max
				? `${s.slice(0, max)}…(${s.length - max} more chars)`
				: s;
		};
		console.error("[generate-character:step-failed]", {
			step: def.label,
			error: trunc(result.error, 1500),
			finalAssistantText: trunc(result.finalAssistantText, 1000),
			rawResultEvent: trunc(result.rawResultEvent, 1500),
		});
		return {
			ok: false,
			error: `[${def.label}] ${details}`,
			refusal,
			usage,
		};
	}

	const parsed = def.schema.safeParse(result.structuredOutput);
	if (!parsed.success) {
		const refusal = REFUSAL_PATTERN.test(result.finalAssistantText ?? "");
		return {
			ok: false,
			error: `[${def.label}] schema validation failed: ${parsed.error.message}`,
			refusal,
			usage,
		};
	}

	const data =
		def.label === "light"
			? (normalizeLightFields(parsed.data as CharacterLight) as T)
			: parsed.data;

	return { ok: true, data, usage };
}

function aggregateStepUsage(
	model: string,
	usages: ReadonlyArray<StepUsage | undefined>,
): StepUsage | undefined {
	const present = usages.filter((u): u is StepUsage => Boolean(u));
	if (present.length === 0) return undefined;
	const sum = (
		k: keyof Pick<
			StepUsage,
			| "inputTokens"
			| "outputTokens"
			| "cacheReadTokens"
			| "cacheCreationTokens"
			| "costUsd"
		>,
	) => present.reduce((acc, u) => acc + (u[k] as number), 0);
	return {
		model,
		inputTokens: sum("inputTokens"),
		outputTokens: sum("outputTokens"),
		cacheReadTokens: sum("cacheReadTokens"),
		cacheCreationTokens: sum("cacheCreationTokens"),
		costUsd: sum("costUsd"),
		// Sub-calls run in parallel via Promise.all — perceived wall-clock is the
		// slowest sub-call, not the sum.
		durationMs: Math.max(...present.map((u) => u.durationMs)),
	};
}

// Fan-out the personality step: split the single 10-13k-char generation into
// 7 parallel sub-calls (one per LLM-generated section). The boilerplate
// Slash_Commands_Behavior section is hardcoded and assembled in its
// canonical position. Each sub-call fits comfortably under the runModel
// 300s timeout where the single-call form was exceeding it.
async function runPersonalityFanOut(
	difficulty: Difficulty,
	messageLength: MessageLength,
	generationModel: string,
	gatheringSummary: string,
	superAdmin: boolean,
): Promise<
	| {
			ok: true;
			data: { additionalPersonalityDetails: string };
			usage?: StepUsage;
	  }
	| { ok: false; error: string; refusal: boolean; usage?: StepUsage }
> {
	const userMessage = CORE_USER_MESSAGE(
		gatheringSummary,
		difficulty,
		messageLength,
	);

	async function runSection(
		sectionId: PersonalityLlmSectionId,
		retryError?: string,
	) {
		const retry = Boolean(retryError);
		const sectionSchema = personalitySectionSchema(sectionId);
		const sectionJsonSchema = z.toJSONSchema(sectionSchema);
		const baseSystem = [
			buildPersonalitySectionPrompt(sectionId, difficulty, messageLength),
			retry
				? [
						"## Retry repair",
						"Your previous attempt for this section failed validation.",
						"Previous failure:",
						retryError?.slice(0, 1200) ?? "",
						"",
						"Return the same requested JSON shape and fix that exact issue. If the failure says a field is too small or the assembled section is too short, add concrete character-specific detail. If the failure says a field is too big, shorten only that field while preserving the important behavioral signals. Remove every placeholder. Do not output XML tags. Do not apologize or explain.",
					].join("\n")
				: "",
		]
			.filter(Boolean)
			.join("\n\n");
		const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);
		const startedAt = Date.now();
		const stepLabel = retry
			? `personality:${sectionId}:retry`
			: `personality:${sectionId}`;
		let result: ModelRunResult;
		try {
			result = await runModel({
				model: generationModel,
				systemPrompt,
				userMessage,
				jsonSchema: sectionJsonSchema,
				stepLabel,
			});
		} catch (err) {
			const isAuth = err instanceof MissingApiKeyError;
			console.error("[generate-character:personality:exception]", {
				sectionId,
				isAuth,
				message: err instanceof Error ? err.message : String(err),
			});
			return {
				sectionId,
				ok: false as const,
				error: `[${stepLabel}] ${isAuth ? "AUTH: " : ""}${String(err)}`,
				refusal: false,
			};
		}
		const usage = extractUsage(generationModel, result, startedAt);
		if (!result.success || !result.structuredOutput) {
			const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
			const refusal = REFUSAL_PATTERN.test(text);
			const details =
				result.error ??
				(result.finalAssistantText
					? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
					: "no structured output returned");
			return {
				sectionId,
				ok: false as const,
				error: `[${stepLabel}] ${details}`,
				refusal,
				usage,
			};
		}
		const parsed = sectionSchema.safeParse(result.structuredOutput);
		if (!parsed.success) {
			return {
				sectionId,
				ok: false as const,
				error: `[${stepLabel}] schema validation failed: ${parsed.error.message}`,
				refusal: false,
				usage,
			};
		}
		const section = renderPersonalitySection(sectionId, parsed.data);
		const validationError = validatePersonalitySection(sectionId, section);
		if (validationError) {
			return {
				sectionId,
				ok: false as const,
				error: `[${stepLabel}] ${validationError}`,
				refusal: false,
				usage,
			};
		}
		return {
			sectionId,
			ok: true as const,
			section,
			usage,
		};
	}

	let subResults = await Promise.all(
		PERSONALITY_LLM_SECTION_IDS.map((sectionId) => runSection(sectionId)),
	);

	const firstFailures = subResults.filter((r) => !r.ok) as Array<
		Extract<(typeof subResults)[number], { ok: false }>
	>;
	if (firstFailures.length > 0) {
		const retries = await Promise.all(
			firstFailures.map((failure) =>
				runSection(failure.sectionId, failure.error),
			),
		);
		const retryMap = new Map(
			retries.map((result) => [result.sectionId, result]),
		);
		subResults = subResults.map((result) =>
			result.ok ? result : (retryMap.get(result.sectionId) ?? result),
		);
	}

	const aggregatedUsage = aggregateStepUsage(
		generationModel,
		subResults.map((r) => r.usage),
	);

	const failures = subResults.filter((r) => !r.ok) as Array<
		Extract<(typeof subResults)[number], { ok: false }>
	>;
	if (failures.length > 0) {
		const anyRefusal = failures.some((f) => f.refusal);
		const summary = failures.map((f) => f.error).join(" | ");
		return {
			ok: false,
			error: summary,
			refusal: anyRefusal,
			usage: aggregatedUsage,
		};
	}

	const sectionMap = {} as Record<PersonalityLlmSectionId, string>;
	for (const r of subResults) {
		if (r.ok) sectionMap[r.sectionId] = r.section;
	}
	const additionalPersonalityDetails = assemblePersonalityDetails(sectionMap);
	const parsed = personalityOnlySchema.safeParse({
		additionalPersonalityDetails,
	});
	if (!parsed.success) {
		return {
			ok: false,
			error: `[personality] schema validation failed: ${parsed.error.message}`,
			refusal: false,
			usage: aggregatedUsage,
		};
	}

	return {
		ok: true,
		data: parsed.data,
		usage: aggregatedUsage,
	};
}

export interface GenerateStepInput {
	stepId: CharacterStepId;
	difficulty: Difficulty;
	messageLength?: MessageLength;
	imageModel?: ImageModel;
	generationModel?: string;
	gatheringSummary: string;
	superAdmin: boolean;
	runId: string;
	confirmedProfile?: ConfirmedProfile;
	onEvent?: (event: GenerateProgressEvent) => void;
}

export async function generateCharacterStep<T = unknown>(
	input: GenerateStepInput,
): Promise<StepResult<T>> {
	const { stepId, difficulty, superAdmin, runId, onEvent, confirmedProfile } =
		input;
	const gatheringSummary = augmentGatheringSummary(
		input.gatheringSummary,
		confirmedProfile,
	);
	const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
	const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
	const generationModel: string = input.generationModel ?? DEFAULT_MAIN_MODEL;
	const def = STEP_DEFS[stepId] as unknown as StepDefinition<T>;

	onEvent?.({ runId, kind: "character", step: stepId, status: "started" });

	const first =
		stepId === "personality"
			? await runPersonalityFanOut(
					difficulty,
					messageLength,
					generationModel,
					gatheringSummary,
					superAdmin,
				)
			: await runStepOnce(
					def,
					difficulty,
					messageLength,
					imageModel,
					generationModel,
					gatheringSummary,
					superAdmin,
				);

	if (first.ok) {
		onEvent?.({
			runId,
			kind: "character",
			step: stepId,
			status: "succeeded",
			usage: first.usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: true,
			data: first.data as T,
			usage: first.usage,
			adminOverrideApplied: superAdmin,
		};
	}

	if (first.refusal) {
		onEvent?.({
			runId,
			kind: "character",
			step: stepId,
			status: "refusal-detected",
			error: first.error,
			usage: first.usage,
		});

		if (superAdmin) {
			console.log(
				`[generate-character] ${stepId} refusal detected under super-admin — retrying with reinforced override`,
			);
			const retry =
				stepId === "personality"
					? await runPersonalityFanOut(
							difficulty,
							messageLength,
							generationModel,
							gatheringSummary,
							true,
						)
					: await runStepOnce(
							def,
							difficulty,
							messageLength,
							imageModel,
							generationModel,
							gatheringSummary,
							true,
						);
			if (retry.ok) {
				onEvent?.({
					runId,
					kind: "character",
					step: stepId,
					status: "succeeded",
					usage: retry.usage,
					adminOverrideApplied: true,
				});
				return {
					success: true,
					data: retry.data as T,
					usage: retry.usage,
					adminOverrideApplied: true,
				};
			}
			onEvent?.({
				runId,
				kind: "character",
				step: stepId,
				status: "failed",
				error: retry.error,
				usage: retry.usage,
				adminOverrideApplied: true,
			});
			return {
				success: false,
				error: retry.error,
				refusal: retry.refusal,
				usage: retry.usage,
				adminOverrideApplied: true,
			};
		}

		return {
			success: false,
			error: first.error,
			refusal: true,
			usage: first.usage,
			adminOverrideApplied: false,
		};
	}

	onEvent?.({
		runId,
		kind: "character",
		step: stepId,
		status: "failed",
		error: first.error,
		usage: first.usage,
		adminOverrideApplied: superAdmin,
	});
	return {
		success: false,
		error: first.error,
		usage: first.usage,
		adminOverrideApplied: superAdmin,
	};
}

export interface UpgradeSystemFrameworkInput {
	runId: string;
	character: Character;
	difficulty: Difficulty;
	messageLength?: MessageLength;
	generationModel?: string;
	gatheringSummary?: string;
	superAdmin: boolean;
	onEvent?: (event: GenerateProgressEvent) => void;
}

export async function upgradeSystemFramework(
	input: UpgradeSystemFrameworkInput,
): Promise<StepResult<SystemFrameworkUpgrade>> {
	const {
		runId,
		character,
		difficulty,
		superAdmin,
		onEvent,
		gatheringSummary,
	} = input;
	const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
	const generationModel: string = input.generationModel ?? DEFAULT_MAIN_MODEL;

	onEvent?.({ runId, kind: "character", step: "scenario", status: "started" });

	const baseSystem = buildSystemFrameworkUpgradePrompt(
		difficulty,
		messageLength,
	);
	const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);

	const moodAxesJson = JSON.stringify(character.moodAxes, null, 2);
	const userParts: string[] = [
		"Here is the EXISTING character to upgrade. Preserve everything per the system prompt rules; refresh only the framework scaffolding inside scenario and migrate the greetingMessage metadata header if needed.",
		"",
		`<existing_character>`,
		`  <difficulty>${difficulty}</difficulty>`,
		`  <messageLength>${messageLength}</messageLength>`,
		`  <scenario>`,
		character.scenario,
		`  </scenario>`,
		`  <greetingMessage>`,
		character.greetingMessage,
		`  </greetingMessage>`,
		`  <moodAxes>`,
		moodAxesJson,
		`  </moodAxes>`,
	];
	if (gatheringSummary && gatheringSummary.trim().length > 0) {
		userParts.push(
			`  <gatheringSummaryForContext>`,
			gatheringSummary,
			`  </gatheringSummaryForContext>`,
		);
	}
	userParts.push(`</existing_character>`);
	userParts.push("");
	userParts.push(
		"Produce structured JSON with exactly the three fields: scenario, greetingMessage, moodAxes. Do not output any other field.",
	);
	const userMessage = userParts.join("\n");

	const jsonSchema = z.toJSONSchema(systemFrameworkUpgradeSchema);
	const startedAt = Date.now();

	let result: ModelRunResult;
	try {
		result = await runModel({
			model: generationModel,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: "scenario",
		});
	} catch (err) {
		const isAuth = err instanceof MissingApiKeyError;
		const prefix = isAuth
			? `[upgrade-system-framework] AUTH: `
			: `[upgrade-system-framework] runModel threw: `;
		console.error("[upgrade-system-framework:exception]", {
			isAuth,
			message: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		onEvent?.({
			runId,
			kind: "character",
			step: "scenario",
			status: "failed",
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
		};
	}

	const usage = extractUsage(generationModel, result, startedAt);

	if (!result.success || !result.structuredOutput) {
		const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
		const refusal = REFUSAL_PATTERN.test(text);
		const details =
			result.error ??
			(result.finalAssistantText
				? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
				: undefined) ??
			"upgrade failed with no details (check main process logs)";
		onEvent?.({
			runId,
			kind: "character",
			step: "scenario",
			status: "failed",
			error: `[upgrade-system-framework] ${details}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[upgrade-system-framework] ${details}`,
			refusal,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	const parsed = systemFrameworkUpgradeSchema.safeParse(
		result.structuredOutput,
	);
	if (!parsed.success) {
		onEvent?.({
			runId,
			kind: "character",
			step: "scenario",
			status: "failed",
			error: `[upgrade-system-framework] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[upgrade-system-framework] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	onEvent?.({
		runId,
		kind: "character",
		step: "scenario",
		status: "succeeded",
		usage,
		adminOverrideApplied: superAdmin,
	});
	return {
		success: true,
		data: parsed.data,
		usage,
		adminOverrideApplied: superAdmin,
	};
}

export interface RefreshVivid3PhysicalInput {
	runId: string;
	character: Character;
	generationModel?: string;
	gatheringSummary?: string;
	superAdmin: boolean;
	onEvent?: (event: GenerateProgressEvent) => void;
}

export async function refreshVivid3Physical(
	input: RefreshVivid3PhysicalInput,
): Promise<StepResult<Vivid3PhysicalRefresh>> {
	const { runId, character, superAdmin, onEvent, gatheringSummary } = input;
	const generationModel: string = input.generationModel ?? DEFAULT_MAIN_MODEL;

	onEvent?.({ runId, kind: "character", step: "visual", status: "started" });

	const baseSystem = buildCharacterVisualPromptHaiku("Vivid 3");
	const systemPrompt = applySuperAdminOverride(baseSystem, superAdmin);

	const ourDreamFieldsJson = character.ourDreamFields
		? JSON.stringify(character.ourDreamFields, null, 2)
		: "(none — previous generation did not populate ourDreamFields)";

	const userParts: string[] = [
		"Here is the EXISTING Vivid 3 character whose physical fields need to be refreshed to the latest gold-standard format.",
		"",
		"Refresh ONLY the five visual fields: customPhysicalDetails, customFaceDetails, baseGenerationPrompt, baseImagePrompt, and ourDreamFields. Preserve the same identity — same name, same age, same ethnicity, same body type, same hair colour, same eye colour, same distinguishing features (tattoos, piercings, freckles) — but rewrite them to strictly follow the Vivid 3 system-prompt rules above (atomic-assembly opener, prose-rich ourDreamFields, single-parens underscore-glued hairStyle tags, single flowing customFaceDetails paragraph covering all 9 face axes, one-flowing-sentence customPhysicalDetails body-proportion summary).",
		"",
		`<existing_character>`,
		`  <firstName>${character.firstName}</firstName>`,
		`  <lastName>${character.lastName}</lastName>`,
		`  <age>${character.age}</age>`,
		`  <customPhysicalDetails>`,
		character.customPhysicalDetails,
		`  </customPhysicalDetails>`,
		`  <customFaceDetails>`,
		character.customFaceDetails,
		`  </customFaceDetails>`,
		`  <baseGenerationPrompt>`,
		character.baseGenerationPrompt,
		`  </baseGenerationPrompt>`,
		`  <baseImagePrompt>`,
		character.baseImagePrompt,
		`  </baseImagePrompt>`,
		`  <ourDreamFields>`,
		ourDreamFieldsJson,
		`  </ourDreamFields>`,
	];
	if (gatheringSummary && gatheringSummary.trim().length > 0) {
		userParts.push(
			`  <gatheringSummaryForContext>`,
			gatheringSummary,
			`  </gatheringSummaryForContext>`,
		);
	}
	userParts.push(`</existing_character>`);
	userParts.push("");
	userParts.push(
		"Produce structured JSON with exactly these five fields: customPhysicalDetails, customFaceDetails, baseGenerationPrompt, baseImagePrompt, ourDreamFields. Do not output age, name, scenario, personality, or any other field. The character's identity must remain the same person — only the prose format and atomic-field richness changes.",
	);
	const userMessage = userParts.join("\n");

	const jsonSchema = z.toJSONSchema(vivid3PhysicalRefreshSchema);
	const startedAt = Date.now();

	let result: ModelRunResult;
	try {
		result = await runModel({
			model: generationModel,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: "visual",
		});
	} catch (err) {
		const isAuth = err instanceof MissingApiKeyError;
		const prefix = isAuth
			? `[refresh-vivid3-physical] AUTH: `
			: `[refresh-vivid3-physical] runModel threw: `;
		console.error("[refresh-vivid3-physical:exception]", {
			isAuth,
			message: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		onEvent?.({
			runId,
			kind: "character",
			step: "visual",
			status: "failed",
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: prefix + String(err),
			adminOverrideApplied: superAdmin,
		};
	}

	const usage = extractUsage(generationModel, result, startedAt);

	if (!result.success || !result.structuredOutput) {
		const text = `${result.error ?? ""} ${result.finalAssistantText ?? ""}`;
		const refusal = REFUSAL_PATTERN.test(text);
		const details =
			result.error ??
			(result.finalAssistantText
				? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
				: undefined) ??
			"refresh failed with no details (check main process logs)";
		onEvent?.({
			runId,
			kind: "character",
			step: "visual",
			status: "failed",
			error: `[refresh-vivid3-physical] ${details}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[refresh-vivid3-physical] ${details}`,
			refusal,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	const parsed = vivid3PhysicalRefreshSchema.safeParse(result.structuredOutput);
	if (!parsed.success) {
		onEvent?.({
			runId,
			kind: "character",
			step: "visual",
			status: "failed",
			error: `[refresh-vivid3-physical] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		});
		return {
			success: false,
			error: `[refresh-vivid3-physical] schema validation failed: ${parsed.error.message}`,
			usage,
			adminOverrideApplied: superAdmin,
		};
	}

	onEvent?.({
		runId,
		kind: "character",
		step: "visual",
		status: "succeeded",
		usage,
		adminOverrideApplied: superAdmin,
	});
	return {
		success: true,
		data: parsed.data,
		usage,
		adminOverrideApplied: superAdmin,
	};
}

export async function inferProfile(input: {
	gatheringSummary: string;
	difficulty: Difficulty;
	generationModel?: string;
}): Promise<
	| { success: true; profile: CharacterProfilePreview }
	| { success: false; error: string }
> {
	const systemPrompt = buildProfileInferencePrompt(input.difficulty);
	const userMessage = [
		"Here is the character gathering conversation summary:",
		"",
		input.gatheringSummary,
		"",
		`Difficulty: ${input.difficulty}.`,
		"",
		"Now produce the full profile preview (measurements, difficultyProfile, intimacyProfile, moodAxes) as structured JSON.",
	].join("\n");
	const jsonSchema = z.toJSONSchema(characterProfilePreviewSchema);
	const model: string = input.generationModel ?? DEFAULT_MAIN_MODEL;

	let result: ModelRunResult;
	try {
		result = await runModel({
			model,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: "profile-infer",
		});
	} catch (err) {
		console.error("[profile-infer:exception]", err);
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}

	if (!result.success || !result.structuredOutput) {
		const trunc = (v: unknown, max = 1500): string => {
			const s = typeof v === "string" ? v : JSON.stringify(v);
			if (!s) return "";
			return s.length > max
				? `${s.slice(0, max)}…(${s.length - max} more chars)`
				: s;
		};
		console.error("[profile-infer:failed]", {
			error: trunc(result.error, 1500),
			finalAssistantText: trunc(result.finalAssistantText, 1000),
			rawResultEvent: trunc(result.rawResultEvent, 1500),
		});
		const details =
			result.error ??
			(result.finalAssistantText
				? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
				: "no structured output returned");
		return {
			success: false,
			error: details,
		};
	}

	const parsed = characterProfilePreviewSchema.safeParse(
		result.structuredOutput,
	);
	if (!parsed.success) {
		return {
			success: false,
			error: `schema validation failed: ${parsed.error.message}`,
		};
	}

	return { success: true, profile: parsed.data };
}

export async function inferMeasurements(input: {
	gatheringSummary: string;
	generationModel?: string;
}): Promise<
	| { success: true; measurements: Measurements }
	| { success: false; error: string }
> {
	const systemPrompt = buildMeasurementsInferencePrompt();
	const userMessage = [
		"Here is the character gathering conversation summary:",
		"",
		input.gatheringSummary,
		"",
		"Now produce the five numeric body measurements as structured JSON.",
	].join("\n");
	const jsonSchema = z.toJSONSchema(measurementsSchema);
	const model: string = input.generationModel ?? DEFAULT_MAIN_MODEL;

	let result: ModelRunResult;
	try {
		result = await runModel({
			model,
			systemPrompt,
			userMessage,
			jsonSchema,
			stepLabel: "measurements-infer",
		});
	} catch (err) {
		console.error("[measurements-infer:exception]", err);
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}

	if (!result.success || !result.structuredOutput) {
		const trunc = (v: unknown, max = 1500): string => {
			const s = typeof v === "string" ? v : JSON.stringify(v);
			if (!s) return "";
			return s.length > max
				? `${s.slice(0, max)}…(${s.length - max} more chars)`
				: s;
		};
		console.error("[measurements-infer:failed]", {
			error: trunc(result.error, 1500),
			finalAssistantText: trunc(result.finalAssistantText, 1000),
			rawResultEvent: trunc(result.rawResultEvent, 1500),
		});
		const details =
			result.error ??
			(result.finalAssistantText
				? `no structured output — assistant said: ${result.finalAssistantText.slice(0, 500)}`
				: "no structured output returned");
		return {
			success: false,
			error: details,
		};
	}

	const parsed = measurementsSchema.safeParse(result.structuredOutput);
	if (!parsed.success) {
		return {
			success: false,
			error: `schema validation failed: ${parsed.error.message}`,
		};
	}

	return { success: true, measurements: parsed.data };
}

export async function generateCharacter(
	input: GenerateCharacterInput,
): Promise<GenerateCharacterResult> {
	const {
		difficulty,
		gatheringSummary,
		superAdmin,
		runId,
		onEvent,
		confirmedProfile,
	} = input;
	const messageLength = input.messageLength ?? DEFAULT_MESSAGE_LENGTH;
	const imageModel = input.imageModel ?? DEFAULT_IMAGE_MODEL;
	const mainModel = input.generationModel ?? DEFAULT_MAIN_MODEL;
	const fastModel = input.fastModel ?? DEFAULT_FAST_MODEL;

	const entries = await Promise.all(
		CHARACTER_STEP_IDS.map(async (stepId) => {
			const res = await generateCharacterStep({
				stepId,
				difficulty,
				messageLength,
				imageModel,
				generationModel: stepId === "visual" ? fastModel : mainModel,
				gatheringSummary,
				superAdmin,
				runId,
				confirmedProfile,
				onEvent,
			});
			return [stepId, res] as const;
		}),
	);

	const stepResults: Partial<Record<CharacterStepId, StepResult<unknown>>> = {};
	for (const [id, res] of entries) stepResults[id] = res;

	const failures = entries.filter(([, r]) => !r.success);
	if (failures.length > 0) {
		const summary = failures
			.map(([id, r]) => `${id}: ${(r as { error?: string }).error}`)
			.join(" | ");
		return { success: false, error: summary, stepResults };
	}

	const merged = characterSchema.safeParse({
		...((stepResults.light as { data: unknown }).data as object),
		...((stepResults.scenario as { data: unknown }).data as object),
		...((stepResults.personality as { data: unknown }).data as object),
		...((stepResults.extras as { data: unknown }).data as object),
		...((stepResults.visual as { data: unknown }).data as object),
	});
	if (!merged.success) {
		return {
			success: false,
			error: `Merged character validation failed: ${merged.error.message}`,
			stepResults,
		};
	}

	return { success: true, character: merged.data, stepResults };
}
