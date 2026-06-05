import type { UIMessage } from "@shared/chat";
import {
	BookOpen,
	Brain,
	Check,
	Eye,
	Gauge,
	Heart,
	Image,
	Loader2,
	MessageSquare,
	MessagesSquare,
	Palette,
	Pencil,
	PenLine,
	RotateCcw,
	Shield,
	Tag,
	User,
	Users,
	Wand2,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
	StoredGroupChat,
} from "@/lib/types";
import {
	DIFFICULTY_META,
	getFullName,
	getStoredImageModel,
	IMAGE_MODEL_META,
	MESSAGE_LENGTH_META,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type GatheringPhase = "character" | "scenes";

interface CharacterReviewProps {
	data: StoredCharacter;
	actions?: ReactNode;
	onRefineScene?: (sceneIndex: number) => void;
	/**
	 * Fork the conversation from the given message. The character phase forks
	 * into a brand-new character; the scenes phase re-runs scene gathering on
	 * the same character. The chat naturally resumes from this point.
	 */
	onRewindFromMessage?: (params: {
		phase: GatheringPhase;
		messageId: string;
	}) => void;
	/**
	 * Called after an inline field edit persists successfully. The parent should
	 * replace its character state with the returned StoredCharacter so the
	 * detail view re-renders with the new value. Omitting this disables inline
	 * editing for every Field / CollapsibleField in the tree.
	 */
	onCharacterUpdated?: (next: StoredCharacter) => void;
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

export type FieldSaveResult = { success: true } | { success: false; error: string };

function Field({
	label,
	value,
	icon,
	mono,
	onSave,
}: {
	label: string;
	value: string;
	icon?: React.ReactNode;
	mono?: boolean;
	onSave?: (next: string) => Promise<FieldSaveResult>;
}) {
	const { copied, copy } = useCopyToClipboard();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const startEdit = () => {
		setDraft(value);
		setError(null);
		setEditing(true);
	};
	const cancelEdit = () => {
		setEditing(false);
		setError(null);
		setSaving(false);
	};
	const submitEdit = async () => {
		if (!onSave) return;
		if (draft.trim().length === 0) {
			setError("Value cannot be empty");
			return;
		}
		if (draft === value) {
			setEditing(false);
			return;
		}
		setSaving(true);
		setError(null);
		const res = await onSave(draft);
		setSaving(false);
		if (res.success) {
			setEditing(false);
		} else {
			setError(res.error);
		}
	};

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
					{!editing && (
						<div
							className={cn(
								"flex items-center gap-1 transition-opacity duration-150 ease-out",
								"opacity-0 group-hover:opacity-100 focus-within:opacity-100",
							)}
						>
							{onSave && (
								<button
									aria-label={`Edit ${label || "value"}`}
									className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									onClick={startEdit}
									type="button"
								>
									<Pencil className="h-3 w-3" />
								</button>
							)}
							<CopyButton value={value} />
						</div>
					)}
				</div>
			)}
			{editing ? (
				<EditPanel
					draft={draft}
					error={error}
					mono={mono}
					onCancel={cancelEdit}
					onChange={setDraft}
					onSubmit={() => void submitEdit()}
					saving={saving}
				/>
			) : (
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
			)}
		</div>
	);
}

function EditPanel({
	draft,
	error,
	mono,
	onCancel,
	onChange,
	onSubmit,
	saving,
}: {
	draft: string;
	error: string | null;
	mono?: boolean;
	onCancel: () => void;
	onChange: (next: string) => void;
	onSubmit: () => void;
	saving: boolean;
}) {
	// Rough line count for sizing — short values get small textareas, long ones grow.
	const approxRows = Math.min(20, Math.max(3, draft.split("\n").length + 1));
	return (
		<div
			className={cn(
				"rounded-xl ring-1 ring-primary/30 transition-colors",
				mono ? "bg-muted" : "bg-background",
			)}
		>
			<textarea
				autoFocus
				className={cn(
					"block w-full resize-y rounded-t-xl bg-transparent p-3.5 text-sm leading-relaxed outline-none",
					mono
						? "font-mono text-[12px] text-foreground/90"
						: "text-foreground",
				)}
				disabled={saving}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						onCancel();
					}
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						onSubmit();
					}
				}}
				rows={approxRows}
				value={draft}
			/>
			<div className="flex items-center justify-between gap-3 border-foreground/10 border-t px-2.5 py-2">
				<span className="pl-1 text-[11px] text-muted-foreground">
					{error ? (
						<span className="text-destructive">{error}</span>
					) : (
						<>
							<kbd className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[10px]">⌘</kbd>
							<kbd className="ml-0.5 rounded bg-foreground/8 px-1 py-0.5 font-mono text-[10px]">↵</kbd>
							<span className="ml-1">save · </span>
							<kbd className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[10px]">esc</kbd>
							<span className="ml-1">cancel</span>
						</>
					)}
				</span>
				<div className="flex items-center gap-1.5">
					<Button
						disabled={saving}
						onClick={onCancel}
						size="sm"
						variant="ghost"
					>
						<X className="h-3 w-3" />
						Cancel
					</Button>
					<Button
						disabled={saving}
						onClick={onSubmit}
						size="sm"
					>
						{saving ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<Check className="h-3 w-3" />
						)}
						{saving ? "Saving…" : "Save"}
					</Button>
				</div>
			</div>
		</div>
	);
}

// Editorial section header: small mono section number, headline, hairline rule.
// Replaces the previous icon-in-rounded-square + card-wrapped pattern. The
// section content sits open beneath, free of card chrome.
export function Section({
	index,
	title,
	subtitle,
	icon,
	tag,
	children,
}: {
	index: number;
	title: string;
	subtitle?: string;
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
				<div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-foreground/10 pb-3">
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
					{subtitle && (
						<p className="w-full max-w-[68ch] text-[0.8125rem] text-muted-foreground leading-relaxed">
							{subtitle}
						</p>
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
	skinColor: "Skin tone",
	bodyType: "Body type",
	breastSize: "Chest / breast",
	buttSize: "Butt size",
	hairColor: "Hair color",
	hairStyle: "Hair style",
	eyeColor: "Eye color",
	tags: "Tags",
};

// UI display order — distinct from the schema's OUR_DREAM_FIELD_KEYS which is
// preserved for prompts. The display starts with the most identity-defining
// anchors (hair style, body type, ethnicity) before drilling into size and
// colour details. Tags are excluded — they render as badges in the Personality tab.
type OurDreamPhysicalKey = Exclude<keyof OurDreamFields, "tags">;
const OUR_DREAM_PHYSICAL_DISPLAY_ORDER: OurDreamPhysicalKey[] = [
	"hairStyle",
	"bodyType",
	"ethnicity",
	"breastSize",
	"buttSize",
	"eyeColor",
	"hairColor",
	"skinColor",
];

function OurDreamFieldsGrid({
	fields,
	makeFieldSaver,
}: {
	fields: OurDreamFields;
	makeFieldSaver?: (path: string) => ((value: string) => Promise<FieldSaveResult>) | undefined;
}) {
	return (
		<div className="space-y-4">
			<div className="eyebrow text-foreground/55">
				Atomic values for the OurDream creation form
			</div>
			<dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
				{OUR_DREAM_PHYSICAL_DISPLAY_ORDER.map((key) => (
					<Field
						key={key}
						label={OUR_DREAM_FIELD_LABELS[key]}
						mono
						onSave={makeFieldSaver?.(`ourDreamFields.${key}`)}
						value={fields[key]}
					/>
				))}
			</dl>
		</div>
	);
}

function TagsRow({ tags }: { tags: readonly string[] }) {
	if (tags.length === 0) return null;
	return (
		<div className="flex flex-wrap gap-1.5">
			{tags.map((t) => (
				<Badge key={t} variant="secondary" className="font-medium text-[11px]">
					{t}
				</Badge>
			))}
		</div>
	);
}

function MeasurementsGrid({ measurements }: { measurements: Measurements }) {
	const items: { label: string; value: string }[] = [
		{ label: "Height", value: `${measurements.heightCm} cm` },
		{ label: "Chest/Bust", value: `${measurements.bustCm} cm` },
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

	const [linkedGroupChats, setLinkedGroupChats] = useState<StoredGroupChat[]>(
		[],
	);
	const [allCharacters, setAllCharacters] = useState<StoredCharacter[]>([]);

	useEffect(() => {
		let cancelled = false;
		void Promise.all([
			window.api.groupChats.list(),
			window.api.characters.list(),
		]).then(([gcs, cs]) => {
			if (cancelled) return;
			setLinkedGroupChats(gcs.filter((gc) => gc.characterIds.includes(data.id)));
			setAllCharacters(cs);
		});
		return () => {
			cancelled = true;
		};
	}, [data.id]);

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
				<h1 className="-tracking-[0.025em] mt-3 flex items-baseline gap-3 font-semibold text-[2.25rem] text-foreground leading-[1.02] sm:text-[2.5rem]">
					{fullName}
					{character.age && (
						<span className="font-medium text-[1.25rem] text-foreground/55 tabular-nums sm:text-[1.4rem]">
							· {character.age}
						</span>
					)}
				</h1>
				<p className="mt-3 max-w-[28ch] text-[0.875rem] text-muted-foreground leading-relaxed">
					{character.publicDescription}
				</p>
			</div>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-foreground/10 border-t pt-4">
				{character.gender && (
					<DefItem
						label="Gender"
						value={character.gender === "male" ? "Male" : "Female"}
					/>
				)}
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

			{linkedGroupChats.length > 0 && (
				<LinkedGroupChats
					allCharacters={allCharacters}
					currentCharacterId={data.id}
					groupChats={linkedGroupChats}
				/>
			)}
		</div>
	);
}

function LinkedGroupChats({
	groupChats,
	allCharacters,
	currentCharacterId,
}: {
	groupChats: StoredGroupChat[];
	allCharacters: StoredCharacter[];
	currentCharacterId: string;
}) {
	const charactersById = new Map(allCharacters.map((c) => [c.id, c]));
	return (
		<div className="flex flex-col gap-3 border-foreground/10 border-t pt-4">
			<div className="flex items-center justify-between">
				<div className="inline-flex items-center gap-1.5 eyebrow text-foreground/55">
					<Users className="h-3 w-3" />
					Group chats
					<span className="ml-1 text-foreground/40 tabular-nums">
						{String(groupChats.length).padStart(2, "0")}
					</span>
				</div>
			</div>
			<div className="flex flex-col gap-2">
				{groupChats.map((gc) => {
					const others = gc.characterIds
						.filter((cid) => cid !== currentCharacterId)
						.map((cid) => charactersById.get(cid))
						.filter((c): c is StoredCharacter => Boolean(c))
						.slice(0, 4);
					const totalOthers =
						gc.characterIds.length - 1 + (gc.characterIds.length === 0 ? 0 : 0);
					const extra = totalOthers - others.length;
					return (
						<a
							className="group/gc relative flex items-center gap-3 rounded-xl bg-card p-3 outline-none ring-1 ring-foreground/10 transition-all duration-200 ease-out hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-primary/40"
							href={`#/group-chats/${gc.id}`}
							key={gc.id}
						>
							<div className="-space-x-2 flex shrink-0 items-center">
								{others.map((m) => {
									const name = getFullName(m.character);
									return (
										<span
											className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary/70 ring-2 ring-card"
											key={m.id}
											title={name}
										>
											{m.profileImageUrl ? (
												<img
													alt={name}
													className="h-full w-full object-cover"
													loading="lazy"
													src={m.profileImageUrl}
												/>
											) : (
												<span className="font-semibold text-[10px] text-foreground/75">
													{initials(name) || "·"}
												</span>
											)}
										</span>
									);
								})}
								{extra > 0 && (
									<span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/40 font-medium text-[10px] text-foreground/55 ring-2 ring-card">
										+{extra}
									</span>
								)}
							</div>
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="-tracking-[0.005em] truncate font-semibold text-[0.875rem] text-foreground leading-tight">
									{gc.groupChat.title}
								</span>
								<span className="mt-0.5 truncate text-[0.75rem] text-muted-foreground leading-relaxed">
									{gc.characterIds.length} characters · {gc.messageLength}
								</span>
							</div>
							<span
								aria-hidden
								className="shrink-0 text-foreground/35 text-xs transition-all duration-200 group-hover/gc:translate-x-0.5 group-hover/gc:text-primary"
							>
								›
							</span>
						</a>
					);
				})}
			</div>
		</div>
	);
}

export function DefItem({
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
	onRewindFromMessage,
	onCharacterUpdated,
}: CharacterReviewProps) {
	const { character, scenes } = data;
	const imageModel = getStoredImageModel(data);
	const imageModelMeta = IMAGE_MODEL_META[imageModel];
	const hasAnyGathering =
		(data.gatheringMessages && data.gatheringMessages.length > 0) ||
		(data.sceneGatheringMessages && data.sceneGatheringMessages.length > 0) ||
		!!data.gatheringSummary;

	const makeFieldSaver = (path: string) =>
		onCharacterUpdated
			? async (value: string): Promise<FieldSaveResult> => {
					const res = await window.api.characters.updateCharacterField(
						data.id,
						path,
						value,
					);
					if (res.success) {
						onCharacterUpdated(res.stored);
						return { success: true };
					}
					return { success: false, error: res.error };
				}
			: undefined;

	const makeSceneSaver = (
		sceneIndex: number,
		field: "prompt" | "negativePrompt",
	) =>
		onCharacterUpdated
			? async (value: string): Promise<FieldSaveResult> => {
					const res = await window.api.characters.updateSceneField(
						data.id,
						sceneIndex,
						field,
						value,
					);
					if (res.success) {
						onCharacterUpdated(res.stored);
						return { success: true };
					}
					return { success: false, error: res.error };
				}
			: undefined;

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
						icon={<User className="h-4 w-4" />}
						index={1}
						title="Identity"
					>
						<dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
							<div className="flex flex-col gap-1">
								<dt className="eyebrow text-foreground/45">Name</dt>
								<dd className="-tracking-[0.005em] font-semibold text-foreground text-[1.05rem]">
									{getFullName(character)}
								</dd>
							</div>
							{character.age && (
								<div className="flex flex-col gap-1">
									<dt className="eyebrow text-foreground/45">Age</dt>
									<dd className="-tracking-[0.005em] font-semibold text-foreground text-[1.05rem] tabular-nums">
										{character.age}
									</dd>
								</div>
							)}
						</dl>
					</Section>

					<Section
						icon={<PenLine className="h-4 w-4" />}
						index={2}
						title="Generation prompt"
						subtitle="The full prompt fed to the character generator — identity, lifestyle, measurements, and personality essence woven into one block."
					>
						<Field
							label="Generation prompt"
							mono
							onSave={makeFieldSaver("baseGenerationPrompt")}
							value={character.baseGenerationPrompt}
						/>
					</Section>

					<Section
						icon={<Image className="h-4 w-4" />}
						index={3}
						title="Base image prompt"
						subtitle="The reusable visual prompt the image model anchors every scene on."
					>
						<Field
							label="Image prompt"
							mono
							onSave={makeFieldSaver("baseImagePrompt")}
							value={character.baseImagePrompt}
						/>
					</Section>

					{character.ourDreamFields && (
						<Section
							icon={<Palette className="h-4 w-4" />}
							index={4}
							title="OurDream atomic fields"
						>
							<OurDreamFieldsGrid
								fields={character.ourDreamFields}
								makeFieldSaver={makeFieldSaver}
							/>
						</Section>
					)}

					<Section
						icon={<User className="h-4 w-4" />}
						index={character.ourDreamFields ? 5 : 4}
						title="Custom physical details"
					>
						<div className="space-y-7">
							{character.confirmedMeasurements && (
								<MeasurementsGrid
									measurements={character.confirmedMeasurements}
								/>
							)}
							<CollapsibleField
								label="Body and physical details"
								onSave={makeFieldSaver("customPhysicalDetails")}
								value={character.customPhysicalDetails}
							/>
						</div>
					</Section>

					<Section
						icon={<Eye className="h-4 w-4" />}
						index={character.ourDreamFields ? 6 : 5}
						title="Custom face details"
					>
						<CollapsibleField
							label="Face details"
							onSave={makeFieldSaver("customFaceDetails")}
							value={character.customFaceDetails}
						/>
					</Section>
				</div>
			</TabsContent>

			<TabsContent value="personality">
				<div className="space-y-12">
					<Section
						icon={<Eye className="h-4 w-4" />}
						index={1}
						title="Public description"
					>
						<CollapsibleField
							label=""
							onSave={makeFieldSaver("publicDescription")}
							value={character.publicDescription}
						/>
					</Section>

					<Section
						icon={<Tag className="h-4 w-4" />}
						index={2}
						title="Labels"
					>
						<div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
							<Field
								label="Personality"
								onSave={makeFieldSaver("personalityLabel")}
								value={character.personalityLabel}
							/>
							<Field
								label="Occupation"
								onSave={makeFieldSaver("occupationLabel")}
								value={character.occupationLabel}
							/>
							<Field
								label="Relationship status"
								onSave={makeFieldSaver("relationshipLabel")}
								value={character.relationshipLabel}
							/>
							<Field
								label="Hobby"
								onSave={makeFieldSaver("hobbyLabel")}
								value={character.hobbyLabel}
							/>
							<Field
								label="Fetish"
								onSave={makeFieldSaver("fetishLabel")}
								value={character.fetishLabel}
							/>
						</div>
					</Section>

					{character.ourDreamFields?.tags &&
						character.ourDreamFields.tags.length > 0 && (
							<Section
								icon={<Tag className="h-4 w-4" />}
								index={3}
								tag={`${character.ourDreamFields.tags.length}`}
								title="Tags"
							>
								<TagsRow tags={character.ourDreamFields.tags} />
							</Section>
						)}

					{character.moodAxes && (
						<Section
							icon={<Gauge className="h-4 w-4" />}
							index={
								character.ourDreamFields?.tags &&
								character.ourDreamFields.tags.length > 0
									? 4
									: 3
							}
							tag="0 → 100"
							title="Mood axes"
						>
							<div className="space-y-8">
								<MoodAxisMeter axis={character.moodAxes.primary} />
								<MoodAxisMeter axis={character.moodAxes.secondary} />
								{character.moodAxes.hidden &&
									character.moodAxes.hidden.length > 0 && (
										<div className="space-y-8 border-foreground/10 border-t pt-6">
											<div className="flex items-center gap-2">
												<span className="eyebrow text-foreground/55">
													Hidden axes
												</span>
												<Badge variant="outline" className="font-medium text-[10px]">
													{character.moodAxes.hidden.length} silent
												</Badge>
											</div>
											<p className="max-w-prose text-[0.8125rem] text-muted-foreground leading-relaxed">
												These axes evolve in the background — they shape the character's
												behavior but never appear in the chat header.
											</p>
											{character.moodAxes.hidden.map((axis, i) => (
												<div
													key={`${axis.label}-${String(i)}`}
													className="opacity-70"
												>
													<MoodAxisMeter axis={axis} />
												</div>
											))}
										</div>
									)}
							</div>
						</Section>
					)}

					<Section
						icon={<MessageSquare className="h-4 w-4" />}
						index={character.moodAxes ? 5 : 4}
						title="Greeting"
					>
						<Field
							label="Greeting message"
							mono
							onSave={makeFieldSaver("greetingMessage")}
							value={character.greetingMessage}
						/>
					</Section>

					<Section
						icon={<MessageSquare className="h-4 w-4" />}
						index={character.moodAxes ? 6 : 5}
						title="First reply suggestion"
					>
						<CollapsibleField
							label=""
							onSave={makeFieldSaver("firstReplySuggestion")}
							value={character.firstReplySuggestion}
						/>
					</Section>

					<Section
						icon={<BookOpen className="h-4 w-4" />}
						index={character.moodAxes ? 7 : 6}
						title="Scenario"
					>
						<CollapsibleField
							label="Scenario"
							mono
							onSave={makeFieldSaver("scenario")}
							value={character.scenario}
						/>
					</Section>

					<Section
						icon={<PenLine className="h-4 w-4" />}
						index={character.moodAxes ? 8 : 7}
						title="Personality and background"
					>
						<div className="space-y-6">
							<CollapsibleField
								label="Additional personality details"
								onSave={makeFieldSaver("additionalPersonalityDetails")}
								value={character.additionalPersonalityDetails}
							/>
							<CollapsibleField
								label="Extra details"
								onSave={makeFieldSaver("extraDetails")}
								value={character.extraDetails}
							/>
						</div>
					</Section>

					<Section
						icon={<Shield className="h-4 w-4" />}
						index={character.moodAxes ? 9 : 8}
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
						index={character.moodAxes ? 10 : 9}
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
								onSave={makeFieldSaver(
									"intimacyProfile.circumstantialTriggers",
								)}
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
											<Field
												label="Prompt"
												mono
												onSave={makeSceneSaver(i, "prompt")}
												value={scene.prompt}
											/>
											{scene.negativePrompt && (
												<Field
													icon={<Palette className="h-3 w-3" />}
													label="Negative prompt"
													mono
													onSave={makeSceneSaver(i, "negativePrompt")}
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
						onRewindFromMessage={onRewindFromMessage}
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
	onRewindFromMessage?: (params: {
		phase: GatheringPhase;
		messageId: string;
	}) => void;
}

function GatheringTab({
	characterMessages,
	sceneMessages,
	gatheringSummary,
	onRewindFromMessage,
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
						onRewindFromMessage={
							onRewindFromMessage
								? (id) =>
										onRewindFromMessage({ phase: "character", messageId: id })
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
						onRewindFromMessage={
							onRewindFromMessage
								? (id) =>
										onRewindFromMessage({ phase: "scenes", messageId: id })
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
	onRewindFromMessage,
}: {
	messages: UIMessage[];
	onRewindFromMessage?: (messageId: string) => void;
}) {
	// For assistant messages we walk back to find the prior user turn — if none
	// exists (e.g. the very first message is an assistant greeting), there's
	// nothing to rewind to, so we skip the button on that message.
	const hasPriorUserMessage = (idx: number): boolean => {
		for (let i = idx - 1; i >= 0; i--) {
			if (messages[i].role === "user") return true;
		}
		return false;
	};

	return (
		<div className="flex flex-col gap-4">
			{messages.map((msg, idx) => {
				const canRewind =
					!!onRewindFromMessage &&
					(msg.role === "user" || hasPriorUserMessage(idx));
				const alignRight = msg.role === "user";
				return (
					<div className="group/turn relative" key={msg.id}>
						<ChatMessage addToolOutput={noopAddToolOutput} message={msg} />
						{canRewind && (
							<div
								className={cn(
									"mt-1 flex flex-wrap items-center gap-1",
									alignRight ? "justify-end pr-10" : "justify-start pl-10",
								)}
							>
								<Button
									className="text-muted-foreground hover:text-primary"
									onClick={() => onRewindFromMessage?.(msg.id)}
									size="sm"
									title="Rewind the conversation to this point; the chat resumes naturally from here"
									variant="ghost"
								>
									<RotateCcw className="h-3 w-3" />
									Rewind to here
								</Button>
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
