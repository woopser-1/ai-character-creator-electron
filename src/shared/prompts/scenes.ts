import type { Character, ImageModel, Scene } from "../schemas";
import { DEFAULT_IMAGE_MODEL, getFullName } from "../schemas";
import {
	ADULT_FICTION_BASELINE,
	applySuperAdminOverride,
	characterPhysicalAnchorBlock,
	EMPHASIS_SYNTAX_BLOCK,
	NO_PHYSICAL_TRAITS_BLOCK,
	REEMBED_PHYSICAL_TRAITS_BLOCK,
} from "../prompts";

export function buildSceneGenerationPrompt(
	character: Character,
	imageModel: ImageModel = DEFAULT_IMAGE_MODEL,
	count: number = 4,
): string {
	return dispatchScenesPrompt(character, imageModel, count, null);
}

export function buildSingleSceneGenerationPrompt(
	character: Character,
	existingScenes: Scene[],
	imageModel: ImageModel = DEFAULT_IMAGE_MODEL,
): string {
	const existingList = existingScenes.length
		? existingScenes.map((s, i) => `${i + 1}. ${s.sceneName}`).join("\n")
		: null;
	return dispatchScenesPrompt(character, imageModel, 1, existingList);
}

function dispatchScenesPrompt(
	character: Character,
	imageModel: ImageModel,
	count: number,
	existingList: string | null,
): string {
	if (imageModel === "Dreamy")
		return buildDreamyScenesPrompt(character, count, existingList);
	if (imageModel === "Vivid 2")
		return buildVivid2ScenesPrompt(character, count, existingList);
	if (imageModel === "Vivid 3")
		return buildVivid3ScenesPrompt(character, count, existingList);
	return buildVivid1ScenesPrompt(character, count, existingList);
}

function characterIntro(character: Character, count: number): string {
	const subject =
		count === 0
			? `generate one image prompt per scene listed in the gathering summary for the character "${getFullName(character)}"`
			: count > 1
				? `generate ${count} image prompts for the character "${getFullName(character)}"`
				: `generate a single image prompt for the character "${getFullName(character)}"`;
	return `${subject} (${character.occupationLabel}, ${character.personalityLabel}).`;
}

function existingScenesBlock(existingList: string | null): string {
	if (!existingList) return "";
	return `## Existing scenes (do NOT reuse a sceneName from this list)\n${existingList}\n\n`;
}

function sceneNameRule(count: number, existingList: string | null): string {
	const distinct =
		count === 1 && existingList
			? " Must be distinct from the existing scene names listed above."
			: "";
	return `### sceneName (REQUIRED, string)
A short, descriptive name for the scene (3-6 words, e.g. "Lounge Bar Evening", "Morning Coffee Routine", "Bookstore First Meeting"). Derive it from the scene concept confirmed in the gathering conversation.${distinct}`;
}

/**
 * Negative-prompt rule shared by every image model (Vivid 1/2/3 and Dreamy).
 * ourdream.ai accepts a negative prompt on all of them, expressed as a short
 * tag list regardless of whether the positive prompt is prose or tag-style.
 */
const NEGATIVE_PROMPT_RULE = `### negativePrompt (REQUIRED, string — tag style)
A comma-separated list of **8 to 15 short tags** describing what the image must AVOID. Tag-style applies to all models — even when the positive prompt is natural prose, the negative prompt stays a flat comma-separated list. Combine generic quality-artifact tags with a few scene-specific exclusions that make sense for the setting/pose.

Generic quality tags to include most of the time (pick 4-6): \`blurry, low quality, deformed hands, extra fingers, extra limbs, bad anatomy, watermark, text, cropped, jpeg artifacts, out of frame, disfigured\`.

Scene-specific exclusions should rule out elements the positive prompt does NOT want (e.g. for an outdoor beach scene: \`indoor, rain, crowd\`; for a nude pose: \`heavy clothing, winter jacket\`; for a close-up: \`wide shot, distant camera\`).

Never leave \`negativePrompt\` empty or as a single word.`;

function outputShapeRule(count: number, withNegative: boolean): string {
	const fields = withNegative
		? "`sceneName`, `prompt` AND `negativePrompt`"
		: "BOTH `sceneName` and `prompt`";
	if (count === 0) {
		return `You MUST output a JSON object with a \`scenes\` array containing EXACTLY one entry per scene finalized in the gathering summary (count derived from the summary — could be 1, 3, 7, or any number up to 16). Each item MUST contain ${fields} — omitting any required field is a schema violation. Each scene MUST have a distinct \`sceneName\`. Do not invent extra scenes or drop any.`;
	}
	if (count > 1) {
		return `You MUST output a JSON object with a \`scenes\` array of exactly ${count} items (not more, not fewer). Each item MUST contain ${fields} — omitting any required field is a schema violation. Each scene MUST have a distinct \`sceneName\`.`;
	}
	return `You MUST output a JSON object with a single \`scene\` field (NOT an array). The scene MUST contain ${fields} — omitting any required field is a schema violation.`;
}

function buildVivid2ScenesPrompt(
	character: Character,
	count: number,
	existingList: string | null,
): string {
	return `${ADULT_FICTION_BASELINE}
You are an expert scene designer for the **Vivid 2** image model on ourdream.ai. Based on the gathering conversation, ${characterIntro(character, count)}

The Vivid 2 model uses a **simple tag-style** prompt format. Tags are short and either comma-separated, or written as short period-separated declarative sentences. Do NOT use weighted parentheses like \`((...))\`. Do NOT use \`Break.\` separators (those are reserved for Vivid 1). Do NOT end with "photorealistic" — the model handles realism.

${existingScenesBlock(existingList)}${REEMBED_PHYSICAL_TRAITS_BLOCK}

${characterPhysicalAnchorBlock(character)}

## Output Format (STRICT — Vivid 2)

${outputShapeRule(count, true)}

${sceneNameRule(count, existingList)}

${NEGATIVE_PROMPT_RULE}

### prompt (REQUIRED, string — Vivid 2 tag style)
**12 to 20 short tags or short declarative sentences.** Pick ONE separator style per prompt:
- **Comma style:** lowercase short tags separated by commas.
- **Period style:** short declarative sentences separated by periods (each sentence is a single visual fact).

Cover, in roughly this order:
- Camera framing (e.g. "close-up pov", "medium shot", "wide shot", "from partner's POV")
- Pose / action (e.g. "kneeling on white carpet", "leaning forward", "tying hair into ponytail")
- Outfit / clothing / accessories (e.g. "black panties, gray hoodie sweatshirt", "golden hoop earrings, black choker")
- Scene-state body description if relevant to the action (e.g. "tits popping out", "oiled body", "naked")
- Setting / environment (e.g. "dirty college apartment, messy", "dim bedroom")
- Time of day / lighting (e.g. "nighttime, dark, ambient light from single blue LED light strip")
- Expression (e.g. "shy smile", "smiling horny", "eyes locked with camera", "lustful gaze")
- Optional focus/mood tags (e.g. "face focus, eyes focus")

Two reference examples (different valid styles — do NOT copy literally, adapt to each scene):

Example 1 (comma-separated, action-focused):
\`close-up pov, kneeling on white carpet, black panties, gray hoodie sweatshirt, dirty college apartment, messy, tying hair into ponytail with red scrunchie, nighttime, dark, ambient light from single blue LED light strip, face focus, eyes focus, shy smile\`

Example 2 (period-separated, explicit):
\`Wearing golden hoop earrings. Black choker. Tits popping out. Oiled body. Big dick in front of face. Girls eyes locked with camera smiling horny.\`

Notice: the reference examples above show scene-specific content ONLY — they pre-date the anchor rule. For YOUR Vivid 2 output, you MUST PREPEND the persona anchor sentence (drawn from the "Character physical anchor" block above) before the scene-specific tags. The anchor goes first as plain prose ("A 21-year-old Caucasian woman with…"), then the comma-separated scene tags follow.`;
}

function buildVivid3ScenesPrompt(
	character: Character,
	count: number,
	existingList: string | null,
): string {
	return `${ADULT_FICTION_BASELINE}
You are an expert scene designer for the **Vivid 3** image model on ourdream.ai. Based on the gathering conversation, ${characterIntro(character, count)}

The Vivid 3 model is a **natural-language** image model. It reads prose the way a human reader does. Your scene prompt MUST be flowing descriptive English — the way a novelist sets a scene — never tags, keyword lists, or weighted syntax.

Do NOT use:
- comma-separated tag lists (e.g. "bedroom, close-up, lustful gaze, naked")
- weighted parentheses like \`((cowgirl position))\`, \`(((kissing)))\`, or \`(keyword:1.2)\`
- \`Break.\` separators or \`_underscore_glued_phrases_\`
- trailing style descriptors like "photorealistic", "fashion editorial style", "cinematic style"
- bullet points, numbered lists, or bracketed labels

DO write:
- continuous English sentences that describe the scene as a moment unfolding
- weave camera framing, pose, action, outfit, expression, lighting, and setting into the prose naturally
- be vivid and specific, like good cinematic writing — but always grammatical, always sentences

${existingScenesBlock(existingList)}${REEMBED_PHYSICAL_TRAITS_BLOCK}

${characterPhysicalAnchorBlock(character)}

## Output Format (STRICT — Vivid 3)

${outputShapeRule(count, true)}

${sceneNameRule(count, existingList)}

${NEGATIVE_PROMPT_RULE}

## Vivid 3 Aesthetic Vocabulary

Vivid 3 reliably recognizes these named aesthetics. If the scene's mood/setting matches one, **invoke it by its canonical name** somewhere in the prose ("the scene leans into a Gothic Macabre atmosphere…", "the room reads as Luxury / High Fashion…"). Do NOT force one if it doesn't fit.

- **Gothic / Macabre** — dark tones, black fabrics, lace details, ornate textures, moody and dramatic, low lighting, deep shadows, slightly eerie undertone.
- **Cyberpunk** — neon lighting, high-contrast colors, advanced tech meeting urban environments, glowing accents against darker surroundings.
- **Luxury / High Fashion** — clean composition, high-end materials, polished presentation, soft controlled lighting highlighting premium textures.
- **Streetwear / Urban** — modern streetwear, candid lifestyle feel, natural or slightly harsh lighting, urban environment.
- **Fantasy / Ethereal** — ethereal otherworldly mood, soft lighting, glowing elements, dreamlike atmosphere, softly blended colors with subtle diffusion.
- **Tropical / Island** — warm sun-soaked palette, bright ocean tones, golden light, relaxed atmosphere.
- **Dark Fantasy** — grounded in dark fantasy themes, muted colors, heavy shadows, somber atmosphere, materials feeling aged and worn.
- **Soft Life / Cozy** — soft and comforting, gentle lighting, warm tones, calm environment.
- **Pin-up / Retro Glam** — polished presentation, bold styling, playful tone, retro glamour cues.
- **Sci-fi Clean / Futuristic** — sleek and futuristic, clean lines, minimal clutter, bright controlled lighting.

## Framing Vocabulary

Vivid 3 understands these framing/lighting cues well — use them when relevant:
"medium-shot portrait", "close-up portrait", "wide shot", "low angle shot", "overhead angle", "shot from her partner's point of view", "late afternoon golden hour", "warm direct sunlight casting a long shadow", "soft natural lighting", "ambient blue LED glow", "neon blue and lavender wash".

## Distinguishing-feature visibility (MANDATORY — Vivid 3 is stateless per render)

Vivid 3 does NOT remember the character between scenes. Every tattoo, piercing, scar, stretch mark, freckle pattern, beauty mark, dimple, or birthmark mentioned in customPhysicalDetails / customFaceDetails MUST be addressed in each scene prompt — either named as visible, or named as hidden by the framing / outfit / pose. Silence is NOT acceptable: a feature not named is a feature Vivid 3 may render in the wrong place, or omit when it should be visible.

For each scene, run this checklist before writing the prose:

1. **List every distinguishing feature** mentioned in customPhysicalDetails / customFaceDetails (tattoos with placement, piercings with placement, freckle patterns with placement, scars, stretch marks, beauty marks, dimples, birthmarks).
2. **For each feature, decide visibility** given the scene's framing (close-up vs wide), pose (back turned, lying down, etc.), outfit (covered vs uncovered), and lighting.
3. **Visible features** — name each one with placement, woven into the scene prose. Examples: "the small line-work moth tattoo low on her right ribcage just visible above the bikini bottom", "the silver hoop in her left nostril catching the warm light", "the constellation of freckles across her cheekbones picked up by the morning sun", "faint silvery stretch marks tracing the outer curve of her hips, visible where the towel slips".
4. **Hidden features** — name them as hidden, with the reason, in a short clause. Examples: "her Japanese sleeve tattoo hidden under the long sleeve of her black turtleneck", "the septum piercing tucked out of view as she looks down", "the under-chest tattoo concealed by the cropped sweater". This stops Vivid 3 from inventing the feature in the wrong place or forgetting it exists. A single closing clause like "her tattoos all covered by the long-sleeve top and high-waisted jeans" is acceptable when many features are uniformly hidden.

A scene prompt that names ZERO distinguishing features is incomplete unless the character truly has none. If the customPhysicalDetails / customFaceDetails blocks list no tattoos/piercings/freckles/scars/marks at all, skip this checklist.

Visibility examples (Vivid 3):
- ✅ Close-up portrait, character has "septum piercing", "small moth tattoo on right ribcage", "freckles across cheekbones": "...her face fills the frame, the silver septum hoop catching the soft window light, a faint constellation of freckles dusting the high points of her cheekbones; her ribcage tattoo is outside the frame."
- ✅ Bikini beach shot, character has "floral sleeve on left arm", "bellybutton piercing", "tan-line stretch marks on hips": "...her floral sleeve tattoo bright against the sun on her left arm, the small gold barbell at her navel glinting, and the faint silvery stretch marks at the outer curve of her hips catching the late afternoon light."
- ✅ Fully clothed business setting, same character: "...her floral sleeve tattoo hidden under the long sleeve of her white blouse, the navel piercing concealed beneath her tailored skirt, the stretch marks not visible in this framing."

## Anti-patterns

- **Do not reintroduce anatomical hyperboles at scene level.** Phrases like "beach ball breasts", "absurdly massive", "comically huge" distort the rendering even when the body type was clean at character level. Stay realistic.
- **Do not describe inherent body morphology** (see the section above). Outfit behavior, scene-state body details, and what's currently visible are allowed.
- **Do not silently drop distinguishing features.** See the visibility checklist above — every tattoo / piercing / scar / stretch mark / freckle pattern / beauty mark / dimple MUST be addressed as visible or hidden.

### prompt (REQUIRED, string — Vivid 3 natural prose)
**3 to 6 flowing sentences** of natural English describing the scene as it would be filmed. Across the prose, cover (in whatever order reads best):
- Camera framing / POV (e.g. "shot from her partner's point of view", "a slow close-up on her face", "wide overhead angle")
- Pose / action — what she is doing in this moment
- Outfit / clothing state — what she is wearing or how it has shifted
- Scene-state body details tied to the action (e.g. "her hair coming loose from its tie", "skin slick with oil", "bare under the half-open robe") — describing what's visible IN this scene, NOT inherent body morphology
- **Distinguishing-feature visibility** — for every tattoo / piercing / freckle pattern / scar / stretch mark / beauty mark / dimple in customPhysicalDetails or customFaceDetails, name it as visible (with placement) or as hidden (with the reason — out of frame, covered by outfit, in shadow). See the "Distinguishing-feature visibility" section above for the checklist and examples.
- Setting / environment
- Lighting and time of day
- Expression and mood
- Any partner / secondary subject's position and action, when present
- Optionally a canonical aesthetic label from the Aesthetic Vocabulary section when it fits naturally

Five reference examples (different valid moods — do NOT copy literally, adapt to each scene's gathered concept):

Example 1 (intimate, solo, indoor):
"In the hush of late afternoon, she kneels on the pale carpet of her cluttered college apartment, lit only by the cool blue glow of a single LED strip behind the bed. She is tying her hair into a quick ponytail with a red scrunchie, head tilted slightly forward, eyes flicking up to meet the camera with a small, shy half-smile. A worn grey hoodie hangs loose from her shoulders over plain black panties, the sleeves bunched at her wrists. The frame holds tight on her face and the line of her shoulders, the rest of the messy room blurred behind her into soft, lived-in dimness."

Example 2 (with partner, nightclub, Luxury / High Fashion adjacent):
"The camera lingers low on the dancefloor of a crowded nightclub, neon blue and lavender light sliding across her body as she leans into her partner with quiet, knowing pleasure. She is bent slightly at the waist in a sheer navy bodycon dress, the thin straps of a black thong just visible where they wrap around her hips, her hair styled high and elegant, her lips parted in a slow seductive smile. Behind her, her partner stands shirtless in black dress pants, one hand extended to caress the curve of her hip, the other braced at the small of her back as he leans in to kiss her neck. The whole scene shimmers with pre-night-out tension and glamorous, slightly frantic energy."

Example 3 (outdoor, contemplative, late-afternoon natural light):
"She is sitting alone on a flat mossy rock at the edge of a creek, her knees pulled up to her chest, staring intently at the swirling water. Her hair is plastered to her neck and forehead by humidity, and the creek water rushes over smooth stones just beyond her feet. The background is a creek bank with mossy boulders and a thick tree line, the atmosphere humid and still. Soft natural lighting of late afternoon filters through the canopy, giving the whole frame a quiet, lived-in calm."

Example 4 (Soft Life / Cozy aesthetic, suburban golden hour, narrative beat):
"She stands at a shared wooden fence line in a suburban front yard, her arms wrapped around herself, one hand gently touching her cheek where she was just pinched, watching the viewer walk away with a soft, wistful expression. The scene takes place during late afternoon golden hour, with warm, direct sunlight casting a long shadow behind her, a modest house with a porch visible behind her. The whole frame leans into a Soft Life / Cozy aesthetic — comfortably ordinary, approachable, grounded in realism with authentic, casual intimacy."

Example 5 (private self-shot smartphone snap, dawn light):
"She is sitting on rumpled ivory sheets in her bedroom, dawn light spilling across the bed in soft golden bars. She wears a torn lace garter belt and silk stockings, one bare thigh lifted, her fingers tracing the dampness between her legs. Her lip is caught between her teeth, her gaze distant and lost in the moment. The phone is held low in her palm, capturing a private self-shot smartphone snap framed from her own perspective. The whole image carries a hushed, hyper-realistic intimacy, with natural skin texture and the unguarded warmth of a stolen private moment."

Notice: the reference examples above show scene-specific prose ONLY — they pre-date the anchor rule. For YOUR Vivid 3 output, you MUST PREPEND the persona anchor sentence as the FIRST sentence of the prompt (drawn from the "Character physical anchor" block above, e.g. "A 21-year-old Caucasian woman with warm golden sun-kissed tan skin, honey blonde hair, long wavy voluminous hair, and large sparkling vivid bright blue eyes. She has a very slim lean athletic build."). After that anchor, continue with the scene-specific prose in the style shown by the examples. Examples 2 and 4 invoke canonical aesthetics; you may do the same. All five read as continuous prose, never as tag lists.`;
}

function buildVivid1ScenesPrompt(
	character: Character,
	count: number,
	existingList: string | null,
): string {
	return `${ADULT_FICTION_BASELINE}
You are an expert scene designer for the **Vivid 1** image model on ourdream.ai. Based on the gathering conversation, ${characterIntro(character, count)}

The Vivid 1 model is a **photo-editorial natural-language** image model. It expects flowing photographic prose with comma-separated descriptive phrases — the way a fashion photographer or cinematographer would describe a shot. It does NOT understand tags, booru \`((keyword))\` emphasis, weighted parens like \`(keyword:1.2)\`, \`Break.\` separators, or \`_underscore_glued_phrases_\`.

Open every scene with a photographic style preface — one of:
- "Photorealistic candid moment …"
- "Vivid photorealistic candid …"
- "Hyper realistic photorealistic full body shot of …"
- "Cinematic photorealistic editorial scene of …"

Close every scene with photo-style descriptors picked from:
- camera/depth: "cinematic depth of field", "shallow depth of field", "softly blurred background"
- texture: "natural skin texture", "realistic fabric details", "high detail", "sharp focus", "8k resolution"
- style: "fashion editorial style", "professional lifestyle photography style", "candid lifestyle photography", "cinematic style"

Do NOT use:
- \`((...))\`, \`(((...)))\`, or \`(keyword:1.2)\` weighted parens
- \`Break.\` or \`BREAK\` separators
- \`_underscore_glued_phrases_\`
- \`score_9\` / \`score_8_up\` boosters (those belong to Dreamy)
- tag-only lists like "bedroom, close-up, naked, lustful"
- a bare trailing "photorealistic" with no style descriptor

DO write:
- a single paragraph of flowing photo prose, comma-separated phrases
- a clear photographic preface at the start
- a sequence of small visual facts (pose, outfit, framing, light, setting)
- a photo-style close (depth + texture + style descriptors)

${existingScenesBlock(existingList)}${REEMBED_PHYSICAL_TRAITS_BLOCK}

${characterPhysicalAnchorBlock(character)}

## Output Format (STRICT — Vivid 1)

${outputShapeRule(count, true)}

${sceneNameRule(count, existingList)}

${NEGATIVE_PROMPT_RULE}

### prompt (REQUIRED, string — Vivid 1 photo-editorial prose)
A **single flowing paragraph** of photographic prose (typically 6-12 comma-separated phrases or 2-4 short sentences). Across the paragraph, cover (in whatever order reads best for the scene):
- a **photographic preface** (Photorealistic / Vivid photorealistic / Hyper realistic …)
- **camera framing / POV** (full body shot, medium shot, close-up, low angle, over-the-shoulder, partner's POV)
- **pose / action** — what the character is doing in this moment
- **outfit / clothing state** — what she's wearing, what is shifted / sheer / undone
- **scene-state body details** tied to the action (e.g. "hair coming loose from its tie", "skin slick with sweat", "bare under the half-open robe") — describing what's visible IN this scene, NOT inherent body morphology
- **setting / environment**
- **lighting and time of day**
- **expression and mood**
- **partner or secondary subject** if present, with their position, outfit, and action
- a **photo-style close** (at least two descriptors from the camera/depth, texture, and style lists above)

Three reference examples (different valid moods — do NOT copy literally, adapt to each scene's gathered concept):

Example 1 (nightlife candid, dive bar, with off-camera dialogue):
"Vivid photorealistic candid moment inside a crowded neighborhood dive bar at night, Riley leans forward over the wooden bar counter with her chin resting in one hand, teasing grin on her face as she talks to someone just off camera, one eyebrow slightly raised like she is delivering a sarcastic comeback, wearing a tight black crop tank and high-waisted ripped jeans, neon beer signs glowing on the walls, liquor bottles lined up behind her, a coworker rushing past carrying a metal bucket of ice, blurred customers crowding the bar trying to flag her down, a bottle of tequila in her other hand as she reaches back toward the rail, warm amber bar lighting mixed with neon highlights reflecting off glass bottles and polished wood, cinematic lifestyle photography, shallow depth of field, natural skin texture, candid nightlife energy, high detail."

Example 2 (outdoor golden hour, campus, full-body):
"Hyper realistic photorealistic full body shot of a confident college woman standing outdoors on campus during golden hour sunset, warm natural golden light casting a soft glow across her face, relaxed poised posture with a slight hip tilt and natural stance, a wide bright genuine smile showing cute dimples, wearing a fitted blouse and high-waisted jeans with a light cardigan and ankle boots, a worn leather messenger bag slung over one shoulder, soft breeze lifting strands across her cheek, ivy-covered campus building blurred behind her with students walking past, professional lifestyle photography style, cinematic depth of field softly blurring the background, natural skin texture realistic fabric details, 8k resolution."

Example 3 (intimate, indoor, with partner, over-the-shoulder framing):
"Cinematic photorealistic editorial scene of a slow morning inside a sunlit minimalist loft, the camera framed over the partner's bare shoulder so the woman fills the rest of the frame, she is wrapped in a half-open cream silk robe loosely tied at the waist, leaning in with her hand resting on his chest, lips just brushing his jaw, her gaze drifting closed, the bedsheets behind her tangled and sun-warm, soft natural lighting spilling through sheer curtains, a single ceramic mug steaming on the side table, quiet intimate atmosphere, shallow depth of field, natural skin texture, candid lifestyle photography, high detail."

Notice: the reference examples above show photographic preface + scene-specific prose ONLY — they pre-date the anchor rule. For YOUR Vivid 1 output, weave the persona anchor (drawn from the "Character physical anchor" block above) into the opening of the prompt — typically right after the photographic preface (e.g. "Vivid photorealistic candid moment of a 21-year-old Caucasian woman with warm golden sun-kissed tan skin, honey blonde hair, long wavy voluminous hair, and large sparkling vivid bright blue eyes, very slim lean athletic build — she leans forward over the dive-bar counter…"). After that, continue with the scene-specific photo-editorial phrases shown by the examples, and close with at least two photo-style descriptors.`;
}

function buildDreamyScenesPrompt(
	character: Character,
	count: number,
	existingList: string | null,
): string {
	return `${ADULT_FICTION_BASELINE}
You are an expert scene designer for the **Dreamy** image model on ourdream.ai. Based on the gathering conversation, ${characterIntro(character, count)}

The Dreamy model uses a **booru-style tag** prompt format (comma-separated short tags), NOT flowing sentences. It supports weighted emphasis with \`((tag))\` for moderate emphasis and \`(tag)\` for slight emphasis. It is paired with a **negative prompt** listing things the image must avoid.

Dreamy supports **two scene sub-formats**:
- **Format A — Solo POV (default)**: opens with \`((pov solo)), 1girl,\` then comma-separated scene tags. The character's appearance is auto-prepended server-side by ourdream from her base character prompt, so you MUST NOT include inherent physical traits here.
- **Format B — Multi-character with BREAK sections**: opens with \`(((1girl,1boy))) ,\` then \` , BREAK \` (space-comma-space-BREAK-space, all caps) separators between logical sections. Each subject's full description goes inside parentheses with their gender + \`score_9,score_8_up,score_7_up,\` boosters + age + ethnicity + hair + eyes + skin + body + pose + mood + outfit. Use Format B ONLY when the scene involves a partner / second subject the user must perceive directly.

When to pick which sub-format:
- Solo, POV from a single perspective → **Format A**
- Two characters in frame, partner-driven interaction, or scene that names a specific partner → **Format B**

${existingScenesBlock(existingList)}${NO_PHYSICAL_TRAITS_BLOCK}

(For Format B specifically, the no-physical-traits rule above does NOT apply — multi-character scenes MUST embed each subject's physical description because ourdream cannot auto-prepend two characters. Format A still obeys the no-physical-traits rule strictly.)

## Output Format (STRICT — Dreamy)

${outputShapeRule(count, true)}

${sceneNameRule(count, existingList)}

### prompt (REQUIRED, string — Dreamy tag style, Format A or B)

#### Format A — Solo POV (default)
A comma-separated list of **10 to 18 short tags** (most tags are 1-6 words). Do NOT write a flowing sentence. Do NOT end with "photorealistic". Use \`((...))\` to emphasize the most defining tags (pose, key action, framing). Cover these aspects, roughly in this order:
- Composition / framing (e.g. \`((pov solo))\`, \`1girl\`, \`close-up\`, \`from partner's POV\`)
- Setting / environment (e.g. \`bedroom\`, \`sandy beach shoreline\`, \`dim candlelit room\`)
- Pose / position (often emphasized — e.g. \`((cowgirl position))\`, \`lying on towel\`, \`leaning against wall\`)
- Action / what's happening (often emphasized — e.g. \`((penis in vagina, riding partner slow and deep))\`, \`hands on partner's chest\`)
- Clothing or nudity state (e.g. \`(naked)\`, \`red silk dress\`, \`bikini\`)
- Expression / mood (e.g. \`lustful\`, \`aroused\`, \`moaning\`, \`eyes locked with partner's with raw need\`)
- Sensory / scene-state body details (e.g. \`breasts bouncing\`, \`bare breasts\`, \`nipples grazing partner's skin\`)
- Background / secondary detail (e.g. \`ocean waves background\`, \`city lights visible\`)

Reference example (Format A — do NOT copy literally, adapt to each scene):

\`((pov solo)), 1girl, bedroom, close-up, from partner's POV, ((cowgirl position)), ((penis in vagina, riding partner slow and deep, hips circling)), riding partner, hands on partner's chest, nails raking lightly, breasts bouncing, (naked), lustful, aroused, moaning, eyes locked with partner's with raw need, cock deep inside vagina, stretching soaked walls, clenching around cock, slick heat, bare breasts, nipples grazing partner's skin\`

Two more solo examples (different moods):

\`((pov solo)), 1girl, Marie's small personal condo bedroom, on the bed with rumpled sheets, kneeling on the bed, sitting back on her heels, hands resting in her lap, gaze traveling from user's face down to her own body, fingertips brushing user's knee, (naked), thoughtful, slightly overwhelmed, shy, curious, vulnerable, with a faint blush\`

\`((pov solo)), 1girl, airport arrival gate interior, polished floors, fluorescent lighting, warm Manila air, full body, from slightly above to emphasize height difference, standing, hands tucked behind back, looking up at taller person, turning slightly toward exit, quick light steps, (pink dress, sandals), shy, nervous, with a warm real smile forming, cheeks flushed\`

Notice: Format A examples describe pose, action, what's visible, expression, lighting — never inherent traits like skin tone, eye color, or body type.

#### Format B — Multi-character with BREAK sections
A single string built from these ordered sections, each separated by \` , BREAK \` (space-comma-space-BREAK-space, BREAK in all caps):

1. Opening count tag with strong emphasis: \`(((1girl,1boy)))\` (or matching counts).
2. **Setting + ambiance** — 1-2 short descriptive phrases of the room/place/time/mood.
3. **Framing / camera** — 1 short phrase (e.g. "Medium shot from the side", "Close-up POV from partner's perspective").
4. **Female subject block** wrapped in a single paren: \`([Name] is Female, score_9,score_8_up,score_7_up, [age], [ethnicity], [hair color + style], [eyes], [skin tone], [body type], [breasts size], [butt shape], ((pose)), [mood/expression], [outfit + nudity state], [position relative to partner])\`. The \`score_9,score_8_up,score_7_up\` boosters MUST appear inside the female block (no spaces between them). Wrap the key pose in \`((...))\` for emphasis.
5. **Partner / user subject block** wrapped in a single paren: \`(User is Male, [body description], ((pose)), [mood], [clothing or nudity state], [position])\`. May reference the user's stored body description from the gathering summary if provided.
6. Optional final closing comma / segment if there is an action detail tying the two together.

Reference example (Format B — do NOT copy literally, adapt to each scene):

\`(((1girl,1boy))) , BREAK Living room interior at night, dimly lit by the glow of a television screen playing a movie, comfortable couch as the central piece of furniture with a blanket draped over part of it, quiet intimate relaxed ambiance with a warm muted color palette dominated by shadows and soft screen light , BREAK Medium shot from the side, capturing the couch and the two characters in an intimate domestic moment , BREAK (Jessa Starr is Female, score_9,score_8_up,score_7_up, 25 year old, brazilian-caucasian woman, blonde hair, half-up long hair that comes down to the top of her shoulder blades, blue eyes, tan skin, slim body, large breasts, athletic butt, ((Lying on the couch with her head resting on the user's lap)), peaceful drowsy with eyes closed and a soft content smile, naked with a blanket draped over her body, curled up on the couch body relaxed and boneless) , BREAK (User is Male, a white male with a fit muscular athletic body not bulky, defined chest abs and back, deep v from abs down to pelvis, larger than average penis, short hair on the sides a little longer on top with a stylish messy look parted on the side, ((Sitting on the couch with Jessa's head on his lap)), protective affectionate looking down at Jessa with a warm gaze, clothed, sitting upright on the couch one hand gently combing through Jessa's hair) ,\`

Notice: Format B reintroduces the physical descriptions of BOTH subjects explicitly because ourdream cannot auto-prepend two characters. The female block always carries \`score_9,score_8_up,score_7_up,\` boosters. The key pose for each subject is wrapped in \`((...))\` for emphasis.

${NEGATIVE_PROMPT_RULE}
${EMPHASIS_SYNTAX_BLOCK}`;
}
