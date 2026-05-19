import type { UIMessage } from "@shared/chat";
import {
	BookOpen,
	Brain,
	Eye,
	Gauge,
	Heart,
	Image,
	MessageSquare,
	MessagesSquare,
	Palette,
	PenLine,
	RotateCcw,
	Shield,
	Tag,
	User,
	Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { ChatMessage } from "@/components/chat/chat-message";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleField } from "@/components/ui/collapsible-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type {
	Measurements,
	MoodAxis,
	OurDreamFields,
	StoredCharacter,
} from "@/lib/types";
import {
	DIFFICULTY_META,
	getFullName,
	getStoredImageModel,
	IMAGE_MODEL_META,
	MESSAGE_LENGTH_META,
	OUR_DREAM_FIELD_KEYS,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type GatheringPhase = "character" | "scenes";

interface CharacterReviewProps {
	data: StoredCharacter;
	actions?: ReactNode;
	onRefineScene?: (sceneIndex: number) => void;
	onRestartFromMessage?: (params: {
		phase: GatheringPhase;
		messageId: string;
	}) => void;
	onRegenerateFromMessage?: (params: { messageId: string }) => void;
}

interface CharacterIdentityProps {
	data: StoredCharacter;
}

const POST_INTIMACY_LABELS: Record<string, { label: string }> = {
	regretful: { label: "Regretful" },
	guilty: { label: "Guilty" },
	awkward: { label: "Awkward" },
	tender: { label: "Tender" },
	satisfied: { label: "Satisfied" },
	detached: { label: "Detached" },
	clingy: { label: "Clingy" },
	anxious: { label: "Anxious" },
	empowered: { label: "Empowered" },
	conflicted: { label: "Conflicted" },
};

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

function formatLongDate(iso: string | number | Date): string {
	return new Date(iso).toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function Field({
	label,
	value,
	icon,
	mono,
}: {
	label: string;
	value: string;
	icon?: React.ReactNode;
	mono?: boolean;
}) {
	const { copied, copy } = useCopyToClipboard();

	return (
		<div className="group">
			{label && (
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-center gap-1.5 eyebrow">
						{icon}
						{label}
						{copied && (
							<span className="font-medium text-[10px] text-primary normal-case tracking-normal">
								Copied
							</span>
						)}
					</div>
					<CopyButton
						className="opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
						value={value}
					/>
				</div>
			)}
			<button
				aria-label={`Copy ${label || "value"}`}
				className={cn(
					"block w-full cursor-pointer whitespace-pre-wrap text-left text-sm leading-relaxed outline-none transition-shadow duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
					mono
						? "rounded-xl bg-muted p-3.5 font-mono text-[12px] text-foreground/90 leading-relaxed ring-1 ring-foreground/10 transition-colors hover:bg-secondary"
						: "-mx-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted",
					copied && "ring-1 ring-primary/40",
				)}
				onClick={() => void copy(value)}
				type="button"
			>
				{value}
			</button>
		</div>
	);
}

// Editorial section header: small mono section number, headline, hairline rule.
// Replaces the previous icon-in-rounded-square + card-wrapped pattern. The
// section content sits open beneath, free of card chrome.
function Section({
	index,
	title,
	icon,
	tag,
	children,
}: {
	index: number;
	title: string;
	icon: React.ReactNode;
	tag?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="group/section relative" data-section-index={index}>
			<header className="flex items-baseline gap-4 pb-3">
				<span
					aria-hidden
					className="display-figure mt-0.5 inline-block min-w-[2ch] text-[0.875rem] text-foreground/40 leading-none"
				>
					{String(index).padStart(2, "0")}
				</span>
				<div className="flex flex-1 items-baseline gap-3 border-b border-foreground/10 pb-3">
					<span
						aria-hidden
						className="inline-flex h-5 w-5 items-center justify-center text-primary/80"
					>
						{icon}
					</span>
					<h2 className="-tracking-[0.005em] font-semibold text-[1.05rem] text-foreground leading-tight">
						{title}
					</h2>
					{tag && (
						<span className="ml-auto eyebrow text-foreground/55">{tag}</span>
					)}
				</div>
			</header>
			<div className="pt-5 pl-[calc(2ch+1rem)]">{children}</div>
		</section>
	);
}

function InstrumentMeter({
	label,
	value,
	max,
	reasoning,
	endpoints,
}: {
	label: string;
	value: number;
	max: number;
	reasoning?: string;
	endpoints?: { low: string; high: string };
}) {
	const percentage = Math.max(0, Math.min(100, (value / max) * 100));
	return (
		<div className="group/meter">
			<div className="mb-1.5 flex items-baseline justify-between gap-3">
				<span className="eyebrow text-foreground/70">{label}</span>
				<span className="font-semibold text-foreground text-sm tabular-nums">
					{value}
					<span className="text-foreground/35 text-xs"> / {max}</span>
				</span>
			</div>
			<div className="meter-rail">
				<div
					aria-hidden
					className="meter-scale"
					style={{
						justifyContent: max <= 10 ? "space-between" : "space-between",
					}}
				>
					{Array.from({ length: max <= 10 ? max + 1 : 11 }).map((_, i) => (
						<span key={`scale-${label}-${String(i)}`} />
					))}
				</div>
				<span
					aria-hidden
					className="meter-tick"
					style={{ left: `${percentage}%` }}
				/>
			</div>
			{endpoints && (
				<div className="mt-1.5 flex items-center justify-between font-medium text-[10px] text-foreground/40 uppercase tracking-[0.15em] tabular-nums">
					<span>0 · {endpoints.low}</span>
					<span>{endpoints.high} · {max}</span>
				</div>
			)}
			{reasoning && (
				<p className="mt-2 max-w-prose text-[0.8125rem] text-muted-foreground leading-relaxed">
					{reasoning}
				</p>
			)}
		</div>
	);
}

function MoodAxisMeter({ axis }: { axis: MoodAxis }) {
	return (
		<InstrumentMeter
			endpoints={{ low: axis.lowDescriptor, high: axis.highDescriptor }}
			label={axis.label}
			max={100}
			reasoning={axis.reasoning}
			value={Math.max(0, Math.min(100, axis.startingValue))}
		/>
	);
}

const OUR_DREAM_FIELD_LABELS: Record<keyof OurDreamFields, string> = {
	ethnicity: "Ethnicity",
	skinColor: "Skin color",
	bodyType: "Body type",
	breastSize: "Breast size",
	buttSize: "Butt size",
	hairColor: "Hair color",
	hairStyle: "Hair style",
	eyeColor: "Eye color",
};

function OurDreamFieldsGrid({ fields }: { fields: OurDreamFields }) {
	return (
		<div className="space-y-4">
			<div className="eyebrow text-foreground/55">
				Atomic values for the OurDream creation form
			</div>
			<dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
				{OUR_DREAM_FIELD_KEYS.map((key) => (
					<Field
						key={key}
						label={OUR_DREAM_FIELD_LABELS[key]}
						mono
						value={fields[key]}
					/>
				))}
			</dl>
		</div>
	);
}

function MeasurementsGrid({ measurements }: { measurements: Measurements }) {
	const items: { label: string; value: string }[] = [
		{ label: "Height", value: `${measurements.heightCm} cm` },
		{ label: "Bust", value: `${measurements.bustCm} cm` },
		{ label: "Cup", value: measurements.cupSize },
		{ label: "Waist", value: `${measurements.waistCm} cm` },
		{ label: "Hips", value: `${measurements.hipsCm} cm` },
	];
	return (
		<div>
			<div className="mb-3 eyebrow text-foreground/55">Confirmed measurements</div>
			<dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5 sm:gap-x-4">
				{items.map((item) => (
					<div key={item.label} className="flex flex-col gap-1">
						<dt className="eyebrow text-foreground/45">{item.label}</dt>
						<dd className="-tracking-[0.005em] font-semibold text-foreground text-[1.05rem] tabular-nums">
							{item.value}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

export function CharacterIdentity({ data }: CharacterIdentityProps) {
	const { character } = data;
	const fullName = getFullName(character);
	const initialsStr = initials(fullName) || "·";
	const messageLengthMeta =
		data.messageLength && MESSAGE_LENGTH_META[data.messageLength];
	const imageModel = getStoredImageModel(data);
	const imageModelMeta = IMAGE_MODEL_META[imageModel];

	return (
		<div className="flex flex-col gap-6">
			<div className="relative">
				{data.profileImageUrl ? (
					<div className="overflow-hidden rounded-3xl ring-1 ring-foreground/10 [box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.22),0_0_32px_oklch(0.72_0.25_305_/_0.16)]">
						<img
							alt={fullName}
							className="aspect-[4/5] w-full object-cover"
							src={data.profileImageUrl}
						/>
					</div>
				) : (
					<div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 [box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.22),0_0_32px_oklch(0.72_0.25_305_/_0.16)]">
						<span
							aria-hidden
							className="display-figure pointer-events-none select-none text-[7rem] text-foreground/10 leading-none"
						>
							{initialsStr}
						</span>
						<div className="absolute bottom-4 left-5 eyebrow text-foreground/55">
							Unillustrated
						</div>
					</div>
				)}
			</div>

			<div>
				<div className="eyebrow text-foreground/55">
					Character profile · {formatLongDate(data.createdAt)}
				</div>
				<h1 className="-tracking-[0.025em] mt-3 font-semibold text-[2.25rem] text-foreground leading-[1.02] sm:text-[2.5rem]">
					{fullName}
				</h1>
				<p className="mt-3 max-w-[28ch] text-[0.875rem] text-muted-foreground leading-relaxed">
					{character.publicDescription}
				</p>
			</div>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-foreground/10 border-t pt-4">
				<DefItem label="Personality" value={character.personalityLabel} />
				<DefItem label="Occupation" value={character.occupationLabel} />
				<DefItem label="Relationship" value={character.relationshipLabel} />
				<DefItem label="Hobby" value={character.hobbyLabel} />
				{data.difficulty && (
					<DefItem
						label="Difficulty"
						value={DIFFICULTY_META[data.difficulty].label}
					/>
				)}
				{messageLengthMeta && (
					<DefItem
						label="Reply length"
						value={`${messageLengthMeta.label} · ${messageLengthMeta.sentenceRange}`}
					/>
				)}
				<DefItem label="Image model" value={imageModelMeta.label} />
				<DefItem label="Fetish" value={character.fetishLabel} muted />
			</dl>
		</div>
	);
}

function DefItem({
	label,
	value,
	muted,
}: {
	label: string;
	value: string;
	muted?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1 min-w-0">
			<dt className="eyebrow text-foreground/45">{label}</dt>
			<dd
				className={cn(
					"truncate text-[0.875rem]",
					muted ? "text-muted-foreground" : "text-foreground",
				)}
				title={value}
			>
				{value}
			</dd>
		</div>
	);
}

export function CharacterReview({
	actions,
	data,
	onRefineScene,
	onRestartFromMessage,
	onRegenerateFromMessage,
}: CharacterReviewProps) {
	const { character, scenes } = data;
	const imageModel = getStoredImageModel(data);
	const imageModelMeta = IMAGE_MODEL_META[imageModel];
	const hasAnyGathering =
		(data.gatheringMessages && data.gatheringMessages.length > 0) ||
		(data.sceneGatheringMessages && data.sceneGatheringMessages.length > 0) ||
		!!data.gatheringSummary;

	return (
		<Tabs defaultValue="appearance">
			{actions && (
				<div className="mb-6 flex justify-end">{actions}</div>
			)}
			<div className="mb-8 flex justify-start">
				<TabsList>
					<TabsTrigger value="appearance">
						<User className="h-3.5 w-3.5" />
						Appearance
					</TabsTrigger>
					<TabsTrigger value="personality">
						<Brain className="h-3.5 w-3.5" />
						Personality
					</TabsTrigger>
					<TabsTrigger value="scenes">
						<Image className="h-3.5 w-3.5" />
						Scenes
						<span className="ml-1 text-foreground/40 tabular-nums">
							{String(scenes.length).padStart(2, "0")}
						</span>
					</TabsTrigger>
					{hasAnyGathering && (
						<TabsTrigger value="gathering">
							<MessagesSquare className="h-3.5 w-3.5" />
							Gathering
						</TabsTrigger>
					)}
				</TabsList>
			</div>

			<TabsContent value="appearance">
				<div className="space-y-12">
					<Section
						icon={<PenLine className="h-4 w-4" />}
						index={1}
						title="Base generation prompt"
					>
						<Field
							label="Generation prompt"
							mono
							value={character.baseGenerationPrompt}
						/>
					</Section>

					<Section
						icon={<User className="h-4 w-4" />}
						index={2}
						title="Body and physical details"
					>
						<div className="space-y-7">
							{character.confirmedMeasurements && (
								<MeasurementsGrid
									measurements={character.confirmedMeasurements}
								/>
							)}
							<CollapsibleField
								label="Body and physical details"
								value={character.customPhysicalDetails}
							/>
						</div>
					</Section>

					<Section
						icon={<Eye className="h-4 w-4" />}
						index={3}
						title="Face details"
					>
						<CollapsibleField
							label="Face details"
							value={character.customFaceDetails}
						/>
					</Section>

					{character.ourDreamFields && (
						<Section
							icon={<Palette className="h-4 w-4" />}
							index={4}
							title="OurDream atomic fields"
						>
							<OurDreamFieldsGrid fields={character.ourDreamFields} />
						</Section>
					)}

					<Section
						icon={<Eye className="h-4 w-4" />}
						index={character.ourDreamFields ? 5 : 4}
						title="Public description"
					>
						<CollapsibleField label="" value={character.publicDescription} />
					</Section>

					<Section
						icon={<Image className="h-4 w-4" />}
						index={character.ourDreamFields ? 6 : 5}
						title="Image generation prompt"
					>
						<Field
							label="Image prompt"
							mono
							value={character.baseImagePrompt}
						/>
					</Section>
				</div>
			</TabsContent>

			<TabsContent value="personality">
				<div className="space-y-12">
					<Section
						icon={<Tag className="h-4 w-4" />}
						index={1}
						title="Labels"
					>
						<div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
							<Field label="Personality" value={character.personalityLabel} />
							<Field label="Occupation" value={character.occupationLabel} />
							<Field
								label="Relationship status"
								value={character.relationshipLabel}
							/>
							<Field label="Hobby" value={character.hobbyLabel} />
							<Field label="Fetish" value={character.fetishLabel} />
						</div>
					</Section>

					{character.moodAxes && (
						<Section
							icon={<Gauge className="h-4 w-4" />}
							index={2}
							tag="0 → 100"
							title="Mood axes"
						>
							<div className="space-y-8">
								<MoodAxisMeter axis={character.moodAxes.primary} />
								<MoodAxisMeter axis={character.moodAxes.secondary} />
							</div>
						</Section>
					)}

					<Section
						icon={<MessageSquare className="h-4 w-4" />}
						index={character.moodAxes ? 3 : 2}
						title="Greeting"
					>
						<Field
							label="Greeting message"
							mono
							value={character.greetingMessage}
						/>
					</Section>

					<Section
						icon={<MessageSquare className="h-4 w-4" />}
						index={character.moodAxes ? 4 : 3}
						title="First reply suggestion"
					>
						<CollapsibleField
							label=""
							value={character.firstReplySuggestion}
						/>
					</Section>

					<Section
						icon={<BookOpen className="h-4 w-4" />}
						index={character.moodAxes ? 5 : 4}
						title="Scenario"
					>
						<CollapsibleField
							label="Scenario"
							mono
							value={character.scenario}
						/>
					</Section>

					<Section
						icon={<PenLine className="h-4 w-4" />}
						index={character.moodAxes ? 6 : 5}
						title="Personality and background"
					>
						<div className="space-y-6">
							<CollapsibleField
								label="Additional personality details"
								value={character.additionalPersonalityDetails}
							/>
							<CollapsibleField
								label="Extra details"
								value={character.extraDetails}
							/>
						</div>
					</Section>

					<Section
						icon={<Shield className="h-4 w-4" />}
						index={character.moodAxes ? 7 : 6}
						tag="0 → 10"
						title="Difficulty profile"
					>
						<div className="space-y-7">
							<InstrumentMeter
								label="Mood resistance"
								max={10}
								reasoning={character.difficultyProfile.moodResistanceReasoning}
								value={character.difficultyProfile.moodResistance}
							/>
							<InstrumentMeter
								label="Trust threshold"
								max={10}
								reasoning={character.difficultyProfile.trustThresholdReasoning}
								value={character.difficultyProfile.trustThreshold}
							/>
							<InstrumentMeter
								label="Personality rigidity"
								max={10}
								reasoning={
									character.difficultyProfile.personalityRigidityReasoning
								}
								value={character.difficultyProfile.personalityRigidity}
							/>
						</div>
					</Section>

					<Section
						icon={<Heart className="h-4 w-4" />}
						index={character.moodAxes ? 8 : 7}
						tag="0 → 10"
						title="Intimacy profile"
					>
						<div className="space-y-7">
							<InstrumentMeter
								label="Escalation speed"
								max={10}
								reasoning={
									character.intimacyProfile.escalationSpeedReasoning
								}
								value={character.intimacyProfile.escalationSpeed}
							/>
							<InstrumentMeter
								label="Sexual confidence"
								max={10}
								reasoning={
									character.intimacyProfile.sexualConfidenceReasoning
								}
								value={character.intimacyProfile.sexualConfidence}
							/>
							<InstrumentMeter
								label="Emotional detachment"
								max={10}
								reasoning={
									character.intimacyProfile.emotionalDetachmentReasoning
								}
								value={character.intimacyProfile.emotionalDetachment}
							/>
							<InstrumentMeter
								label="Personality consistency"
								max={10}
								reasoning={
									character.intimacyProfile.personalityConsistencyReasoning
								}
								value={character.intimacyProfile.personalityConsistency}
							/>
							<div>
								<div className="mb-2 flex items-baseline justify-between gap-3">
									<span className="eyebrow text-foreground/70">
										Post-intimacy behavior
									</span>
									<Badge variant="secondary">
										{POST_INTIMACY_LABELS[
											character.intimacyProfile.postIntimacyBehavior
										]?.label ??
											character.intimacyProfile.postIntimacyBehavior}
									</Badge>
								</div>
								<p className="max-w-prose text-[0.8125rem] text-muted-foreground leading-relaxed">
									{character.intimacyProfile.postIntimacyBehaviorReasoning}
								</p>
							</div>
							<CollapsibleField
								label="Circumstantial triggers"
								value={character.intimacyProfile.circumstantialTriggers}
							/>
						</div>
					</Section>
				</div>
			</TabsContent>

			<TabsContent value="scenes">
				<div className="space-y-12">
					<Section
						icon={<Image className="h-4 w-4" />}
						index={1}
						tag={imageModelMeta.label}
						title={`Scene image prompts (${scenes.length})`}
					>
						{scenes.length === 0 ? (
							<div className="rounded-2xl border border-foreground/10 border-dashed px-5 py-8 text-center">
								<div className="eyebrow text-foreground/55">No scenes yet</div>
								<p className="mt-2 text-muted-foreground text-sm">
									Use the Add scene action to draft the first one.
								</p>
							</div>
						) : (
							<div className="space-y-10">
								{scenes.map((scene, i) => (
									<article
										className="relative"
										key={scene.sceneName}
									>
										<header className="mb-3 flex items-center justify-between gap-3">
											<h3 className="flex items-baseline gap-3 font-semibold text-[0.95rem] text-foreground">
												<span
													aria-hidden
													className="display-figure text-[0.8125rem] text-foreground/40 leading-none"
												>
													{String(i + 1).padStart(2, "0")}
												</span>
												{scene.sceneName}
											</h3>
											{onRefineScene && (
												<Button
													className="text-muted-foreground hover:text-primary"
													onClick={() => onRefineScene(i)}
													size="sm"
													variant="ghost"
												>
													<Wand2 className="h-3.5 w-3.5" />
													Refine
												</Button>
											)}
										</header>
										<div className="space-y-4">
											<Field label="Prompt" mono value={scene.prompt} />
											{scene.negativePrompt && (
												<Field
													icon={<Palette className="h-3 w-3" />}
													label="Negative prompt"
													mono
													value={scene.negativePrompt}
												/>
											)}
										</div>
									</article>
								))}
							</div>
						)}
					</Section>
				</div>
			</TabsContent>

			{hasAnyGathering && (
				<TabsContent value="gathering">
					<GatheringTab
						characterMessages={data.gatheringMessages}
						sceneMessages={data.sceneGatheringMessages}
						gatheringSummary={data.gatheringSummary}
						onRegenerateFromMessage={onRegenerateFromMessage}
						onRestartFromMessage={onRestartFromMessage}
					/>
				</TabsContent>
			)}
		</Tabs>
	);
}

interface GatheringTabProps {
	characterMessages?: UIMessage[];
	sceneMessages?: UIMessage[];
	gatheringSummary?: string;
	onRestartFromMessage?: (params: {
		phase: GatheringPhase;
		messageId: string;
	}) => void;
	onRegenerateFromMessage?: (params: { messageId: string }) => void;
}

function GatheringTab({
	characterMessages,
	sceneMessages,
	gatheringSummary,
	onRestartFromMessage,
	onRegenerateFromMessage,
}: GatheringTabProps) {
	const hasCharacterMessages =
		characterMessages && characterMessages.length > 0;
	const hasSceneMessages = sceneMessages && sceneMessages.length > 0;
	const showLegacySummary =
		!hasCharacterMessages && !hasSceneMessages && !!gatheringSummary;

	return (
		<div className="space-y-12">
			{hasCharacterMessages && (
				<Section
					icon={<MessagesSquare className="h-4 w-4" />}
					index={1}
					tag={`${String(characterMessages.length).padStart(2, "0")} turns`}
					title="Character gathering"
				>
					<GatheringTranscript
						messages={characterMessages}
						onRegenerateFromMessage={
							onRegenerateFromMessage
								? (id) => onRegenerateFromMessage({ messageId: id })
								: undefined
						}
						onRestartFromMessage={
							onRestartFromMessage
								? (id) =>
										onRestartFromMessage({ phase: "character", messageId: id })
								: undefined
						}
					/>
				</Section>
			)}

			{hasSceneMessages && (
				<Section
					icon={<MessagesSquare className="h-4 w-4" />}
					index={hasCharacterMessages ? 2 : 1}
					tag={`${String(sceneMessages.length).padStart(2, "0")} turns`}
					title="Scene gathering"
				>
					<GatheringTranscript
						messages={sceneMessages}
						onRestartFromMessage={
							onRestartFromMessage
								? (id) =>
										onRestartFromMessage({ phase: "scenes", messageId: id })
								: undefined
						}
					/>
				</Section>
			)}

			{showLegacySummary && (
				<Section
					icon={<MessagesSquare className="h-4 w-4" />}
					index={1}
					tag="legacy"
					title="Gathering summary"
				>
					<div className="rounded-2xl border border-foreground/10 border-dashed px-5 py-4">
						<p className="mb-3 text-muted-foreground text-xs leading-relaxed">
							This character was created before per-message history was
							saved. The full transcript is unavailable; the summary used for
							generation is shown below.
						</p>
						<pre className="whitespace-pre-wrap rounded-xl bg-muted p-3.5 font-mono text-[12px] text-foreground/90 leading-relaxed ring-1 ring-foreground/10">
							{gatheringSummary}
						</pre>
					</div>
				</Section>
			)}
		</div>
	);
}

function noopAddToolOutput() {}

function GatheringTranscript({
	messages,
	onRestartFromMessage,
	onRegenerateFromMessage,
}: {
	messages: UIMessage[];
	onRestartFromMessage?: (messageId: string) => void;
	onRegenerateFromMessage?: (messageId: string) => void;
}) {
	// For assistant messages we walk back to find the prior user turn — if none
	// exists (e.g. the very first message is an assistant greeting), restart
	// can't fork there, so we skip the Restart button on those messages.
	const hasPriorUserMessage = (idx: number): boolean => {
		for (let i = idx - 1; i >= 0; i--) {
			if (messages[i].role === "user") return true;
		}
		return false;
	};

	return (
		<div className="flex flex-col gap-4">
			{messages.map((msg, idx) => {
				const canRestart =
					!!onRestartFromMessage &&
					(msg.role === "user" || hasPriorUserMessage(idx));
				// Regenerate works at any message because it skips the chat entirely
				// — it just snapshots the transcript up to and including this message
				// and goes straight to profile review.
				const canRegenerate = !!onRegenerateFromMessage;
				const showRow = canRestart || canRegenerate;
				const alignRight = msg.role === "user";
				return (
					<div className="group/turn relative" key={msg.id}>
						<ChatMessage addToolOutput={noopAddToolOutput} message={msg} />
						{showRow && (
							<div
								className={cn(
									"mt-1 flex flex-wrap items-center gap-1",
									alignRight ? "justify-end pr-10" : "justify-start pl-10",
								)}
							>
								{canRegenerate && (
									<Button
										className="text-muted-foreground hover:text-primary"
										onClick={() => onRegenerateFromMessage?.(msg.id)}
										size="sm"
										title="Skip the chat and go straight to profile review using the gathering up to this point"
										variant="ghost"
									>
										<Wand2 className="h-3 w-3" />
										Regenerate from here
									</Button>
								)}
								{canRestart && (
									<Button
										className="text-muted-foreground hover:text-primary"
										onClick={() => onRestartFromMessage?.(msg.id)}
										size="sm"
										title="Restart the gathering chat from this point"
										variant="ghost"
									>
										<RotateCcw className="h-3 w-3" />
										Restart chat from here
									</Button>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

// Backwards-compatible export. Some callers may still reach for the original
// monolithic component; render Identity + Review stacked for narrow contexts.
export function CharacterDetail({ data, onRefineScene }: CharacterReviewProps) {
	return (
		<div className="space-y-10">
			<CharacterIdentity data={data} />
			<CharacterReview data={data} onRefineScene={onRefineScene} />
		</div>
	);
}
