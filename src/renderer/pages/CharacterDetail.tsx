import { Popover } from "@base-ui/react/popover";
import { ourdreamChatUrl } from "@shared/ourdream-urls";
import {
	ArrowLeft,
	Download,
	ExternalLink,
	Gauge,
	ImagePlus,
	Link as LinkIcon,
	MessageCircle,
	MoreHorizontal,
	RefreshCw,
	Search,
	Settings2,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AddSceneDialog } from "@/components/add-scene-dialog";
import {
	CharacterIdentity,
	CharacterReview,
} from "@/components/character-detail";
import { OurDreamUrlDialog } from "@/components/ourdream-url-dialog";
import { QuickEditDialog } from "@/components/quick-edit-dialog";
import { RefineSceneDialog } from "@/components/refine-scene-dialog";
import { RegenerateDialog } from "@/components/regenerate-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	type ReplaySeed,
	setReplaySeed,
} from "@/lib/gathering-replay";
import { navigate } from "@/lib/router";
import type { StoredCharacter } from "@/lib/types";
import { cn } from "@/lib/utils";

function synthGatheringSummary(data: StoredCharacter): string {
	const c = data.character;
	const lines = [
		`Character: ${c.firstName} ${c.lastName}.`,
		`Difficulty: ${data.difficulty}.`,
		`Personality: ${c.personalityLabel}.`,
		`Occupation: ${c.occupationLabel}.`,
		`Relationship: ${c.relationshipLabel}.`,
		`Hobby: ${c.hobbyLabel}.`,
		`Fetish/kink: ${c.fetishLabel}.`,
		"",
		`Public description: ${c.publicDescription}`,
		"",
		`Physical: ${c.customPhysicalDetails}`,
		`Face: ${c.customFaceDetails}`,
	];
	if (c.ourDreamFields) {
		const odf = c.ourDreamFields;
		lines.push(
			"",
			"OurDream atomic fields:",
			`- ethnicity: ${odf.ethnicity}`,
			`- skinColor: ${odf.skinColor}`,
			`- hairColor: ${odf.hairColor}`,
			`- hairStyle: ${odf.hairStyle}`,
			`- eyeColor: ${odf.eyeColor}`,
			`- bodyType: ${odf.bodyType}`,
			`- breastSize: ${odf.breastSize}`,
			`- buttSize: ${odf.buttSize}`,
		);
	}
	lines.push(
		"",
		`Personality details:`,
		c.additionalPersonalityDetails,
		"",
		`Background:`,
		c.extraDetails,
		"",
		`Current scenario:`,
		c.scenario,
	);
	return lines.join("\n");
}

export function CharacterDetailPage({ id }: { id: string }) {
	const [data, setData] = useState<StoredCharacter | null>(null);
	const [notFound, setNotFound] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [addSceneOpen, setAddSceneOpen] = useState(false);
	const [refineSceneIndex, setRefineSceneIndex] = useState<number | null>(null);
	const [regenerateOpen, setRegenerateOpen] = useState(false);
	const [quickEditOpen, setQuickEditOpen] = useState(false);
	const [ourdreamOpen, setOurdreamOpen] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const [moodAxesBusy, setMoodAxesBusy] = useState(false);
	const [moodAxesError, setMoodAxesError] = useState<string | null>(null);
	const [exportBusy, setExportBusy] = useState(false);
	const toast = useToast();

	useEffect(() => {
		window.api.characters.get(id).then((char) => {
			if (char) {
				setData(char);
			} else {
				setNotFound(true);
			}
		});
	}, [id]);

	async function handleDelete() {
		await window.api.characters.delete(id);
		navigate("/");
	}

	const handleSceneAdded = useCallback((updated: StoredCharacter) => {
		setData(updated);
	}, []);

	const handleExport = useCallback(async () => {
		if (!data) return;
		setExportBusy(true);
		const res = await window.api.characters.exportToFile([data.id]);
		setExportBusy(false);
		if (res.success) {
			toast.push({
				tone: "success",
				title: `Saved ${data.character.firstName} ${data.character.lastName}`,
				description: res.path,
				action: {
					label: "Show in Finder",
					onClick: () => void window.api.shell.showInFolder(res.path),
				},
			});
		} else if (!("canceled" in res)) {
			toast.push({
				tone: "error",
				title: "Export failed",
				description: res.error,
			});
		}
	}, [data, toast]);

	// ⌘E to export
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			const cmdE = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e";
			if (cmdE && !exportBusy && data) {
				event.preventDefault();
				void handleExport();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [data, exportBusy, handleExport]);

	const handleRegenerateFromMessage = useCallback(
		({ messageId }: { messageId: string }) => {
			if (!data) return;
			const messages = data.gatheringMessages;
			if (!messages) return;
			const clickedIdx = messages.findIndex((m) => m.id === messageId);
			if (clickedIdx < 0) return;
			// Keep messages up to AND INCLUDING the clicked one — the user is
			// telling us "this is where the gathering effectively ended".
			const gatheringMessages = messages.slice(0, clickedIdx + 1);
			if (gatheringMessages.length === 0) return;
			const seed: ReplaySeed = {
				kind: "regenerate-from-gathering",
				originCharacterId: data.id,
				difficulty: data.difficulty,
				messageLength: data.messageLength,
				imageModel: data.imageModel,
				gatheringMessages,
			};
			setReplaySeed(seed);
			navigate("/create");
		},
		[data],
	);

	const handleRestartFromMessage = useCallback(
		({ phase, messageId }: { phase: "character" | "scenes"; messageId: string }) => {
			if (!data) return;
			const messages =
				phase === "character"
					? data.gatheringMessages
					: data.sceneGatheringMessages;
			if (!messages) return;
			const clickedIdx = messages.findIndex((m) => m.id === messageId);
			if (clickedIdx < 0) return;

			// Resolve the anchor user message. Clicking a user message forks at
			// that message; clicking an assistant message walks back to the prior
			// user turn (regenerate-from-here semantic), so any message in the
			// chat — including tool-output-only assistant turns — is a valid
			// resume point.
			let userIdx = clickedIdx;
			if (messages[clickedIdx].role !== "user") {
				while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx--;
			}
			if (userIdx < 0) return;
			const anchor = messages[userIdx];
			const newMessage = anchor.parts
				.filter((p) => p.type === "text")
				.map((p) => (p as { text: string }).text)
				.join("\n")
				.trim();
			if (!newMessage) return;
			const truncatedMessages = messages.slice(0, userIdx);

			const seed: ReplaySeed =
				phase === "character"
					? {
							kind: "gather-character",
							originCharacterId: data.id,
							difficulty: data.difficulty,
							messageLength: data.messageLength,
							imageModel: data.imageModel,
							truncatedMessages,
							newMessage,
						}
					: {
							kind: "gather-scenes",
							originCharacterId: data.id,
							character: data.character,
							difficulty: data.difficulty,
							messageLength: data.messageLength,
							imageModel: data.imageModel,
							truncatedMessages,
							newMessage,
						};
			setReplaySeed(seed);
			navigate("/create");
		},
		[data],
	);

	const handleRegenerateMoodAxes = useCallback(async () => {
		if (!data) return;
		setMoodAxesBusy(true);
		setMoodAxesError(null);
		const res = await window.api.characters.regenerateMoodAxes(
			data.id,
			synthGatheringSummary(data),
		);
		setMoodAxesBusy(false);
		if (res.success) {
			setData(res.stored);
		} else {
			setMoodAxesError(res.error);
		}
	}, [data]);

	if (notFound) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground ring-1 ring-foreground/10">
					<Search className="h-6 w-6" />
				</div>
				<div className="text-center">
					<p className="font-semibold text-lg">Character not found</p>
					<p className="mt-1 text-muted-foreground text-sm">
						This character may have been deleted.
					</p>
				</div>
				<a href="#/">
					<Button variant="outline">
						<ArrowLeft className="h-4 w-4" />
						Back to studio
					</Button>
				</a>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<div className="flex items-center gap-1.5">
					<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
					<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
					<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
				</div>
			</div>
		);
	}

	const actions = (
		<ActionToolbar
			data={data}
			exportBusy={exportBusy}
			moodAxesBusy={moodAxesBusy}
			moreOpen={moreOpen}
			onAddScene={() => setAddSceneOpen(true)}
			onDelete={() => setDeleteOpen(true)}
			onEditOurdream={() => setOurdreamOpen(true)}
			onExport={() => void handleExport()}
			onMoreOpenChange={setMoreOpen}
			onQuickEdit={() => setQuickEditOpen(true)}
			onRegenerate={() => setRegenerateOpen(true)}
			onRegenerateMoodAxes={() => void handleRegenerateMoodAxes()}
		/>
	);

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10">
			<TopUtilityBar data={data} />

			{moodAxesError && (
				<div className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs ring-1 ring-destructive/30">
					Mood axes generation failed: {moodAxesError}
				</div>
			)}

			<div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[20rem_1fr] xl:grid-cols-[22rem_1fr] xl:gap-x-14">
				<aside>
					<CharacterIdentity data={data} />
				</aside>
				<main className="min-w-0">
					<CharacterReview
						actions={actions}
						data={data}
						onRefineScene={(idx) => setRefineSceneIndex(idx)}
						onRegenerateFromMessage={handleRegenerateFromMessage}
						onRestartFromMessage={handleRestartFromMessage}
					/>
				</main>
			</div>

			<AddSceneDialog
				character={data}
				onOpenChange={setAddSceneOpen}
				onSceneAdded={handleSceneAdded}
				open={addSceneOpen}
			/>

			<RefineSceneDialog
				character={data}
				onOpenChange={(o) => {
					if (!o) setRefineSceneIndex(null);
				}}
				onSceneRefined={handleSceneAdded}
				open={refineSceneIndex !== null}
				sceneIndex={refineSceneIndex ?? 0}
			/>

			<RegenerateDialog
				data={data}
				onOpenChange={setRegenerateOpen}
				open={regenerateOpen}
			/>

			<QuickEditDialog
				data={data}
				gatheringSummary={synthGatheringSummary(data)}
				onOpenChange={setQuickEditOpen}
				onUpdated={setData}
				open={quickEditOpen}
			/>

			<OurDreamUrlDialog
				data={data}
				onOpenChange={setOurdreamOpen}
				onUpdated={setData}
				open={ourdreamOpen}
			/>

			<Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<span className="eyebrow text-destructive/85">Delete</span>
						<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
							Discard {data.character.firstName}?
						</DialogTitle>
					</DialogHeader>
					<DialogDescription className="max-w-[48ch] text-[0.875rem] text-muted-foreground leading-relaxed">
						The profile, the scenes, the gathered context. All of it leaves the
						shelf permanently. There is no draft to fall back to.
					</DialogDescription>
					<DialogFooter>
						<Button onClick={() => setDeleteOpen(false)} variant="outline">
							Cancel
						</Button>
						<Button onClick={handleDelete} variant="destructive">
							<Trash2 className="h-3.5 w-3.5" />
							Delete permanently
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function TopUtilityBar({ data }: { data: StoredCharacter }) {
	return (
		<div className="flex items-center justify-between gap-2">
			<a href="#/">
				<Button className="text-muted-foreground" size="sm" variant="ghost">
					<ArrowLeft className="h-4 w-4" />
					Studio
				</Button>
			</a>
			{data.ourdreamUrl && (
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger
							render={
								<a
									aria-label="Open chat on OurDream"
									href={ourdreamChatUrl(data.ourdreamUrl)}
									rel="noreferrer noopener"
									target="_blank"
								/>
							}
						>
							<Button
								className="text-primary/80 hover:text-primary"
								size="icon-sm"
								variant="ghost"
							>
								<MessageCircle className="h-3.5 w-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open chat on OurDream</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<a
									aria-label="Open profile on OurDream"
									href={data.ourdreamUrl}
									rel="noreferrer noopener"
									target="_blank"
								/>
							}
						>
							<Button
								className="text-muted-foreground hover:text-foreground"
								size="icon-sm"
								variant="ghost"
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Open profile on OurDream</TooltipContent>
					</Tooltip>
				</div>
			)}
		</div>
	);
}

function ActionToolbar({
	data,
	exportBusy,
	moodAxesBusy,
	moreOpen,
	onAddScene,
	onDelete,
	onEditOurdream,
	onExport,
	onMoreOpenChange,
	onQuickEdit,
	onRegenerate,
	onRegenerateMoodAxes,
}: {
	data: StoredCharacter;
	exportBusy: boolean;
	moodAxesBusy: boolean;
	moreOpen: boolean;
	onAddScene: () => void;
	onDelete: () => void;
	onEditOurdream: () => void;
	onExport: () => void;
	onMoreOpenChange: (v: boolean) => void;
	onQuickEdit: () => void;
	onRegenerate: () => void;
	onRegenerateMoodAxes: () => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							disabled={exportBusy}
							onClick={onExport}
							size="sm"
							variant="outline"
						/>
					}
				>
					<Download className="h-3.5 w-3.5" />
					{exportBusy ? "Exporting" : "Export"}
				</TooltipTrigger>
				<TooltipContent>
					Save this character as a .json file (⌘E)
				</TooltipContent>
			</Tooltip>
			<Button onClick={onQuickEdit} size="sm" variant="outline">
				<Settings2 className="h-3.5 w-3.5" />
				Quick edit
			</Button>
			<Button className="glow-md hover:glow-lg" onClick={onAddScene} size="sm">
				<ImagePlus className="h-3.5 w-3.5" />
				Add scene
			</Button>
			<Popover.Root onOpenChange={onMoreOpenChange} open={moreOpen}>
				<Tooltip>
					<Popover.Trigger
						render={
							<TooltipTrigger
								render={
									<Button
										aria-label="More actions"
										size="icon-sm"
										variant="ghost"
									/>
								}
							/>
						}
					>
						<MoreHorizontal className="h-4 w-4" />
					</Popover.Trigger>
					<TooltipContent>More actions</TooltipContent>
				</Tooltip>
				<Popover.Portal>
					<Popover.Positioner align="end" sideOffset={8}>
						<Popover.Popup className="origin-top-right transition-all duration-200 ease-out data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
							<div className="w-60 rounded-xl bg-popover/95 p-1.5 ring-1 ring-foreground/10 backdrop-blur-2xl">
								<MenuItem
									icon={<RefreshCw className="h-3.5 w-3.5" />}
									label="Regenerate character"
									onClick={() => {
										onMoreOpenChange(false);
										onRegenerate();
									}}
								/>
								<MenuItem
									icon={<LinkIcon className="h-3.5 w-3.5" />}
									label={
										data.ourdreamUrl
											? "Edit OurDream link"
											: "Link to OurDream"
									}
									onClick={() => {
										onMoreOpenChange(false);
										onEditOurdream();
									}}
								/>
								{!data.character.moodAxes && (
									<MenuItem
										disabled={moodAxesBusy}
										icon={<Gauge className="h-3.5 w-3.5" />}
										label={
											moodAxesBusy ? "Generating…" : "Generate mood axes"
										}
										onClick={() => {
											onMoreOpenChange(false);
											onRegenerateMoodAxes();
										}}
									/>
								)}
								<div className="my-1 h-px bg-border" />
								<MenuItem
									destructive
									icon={<Trash2 className="h-3.5 w-3.5" />}
									label="Delete character"
									onClick={() => {
										onMoreOpenChange(false);
										onDelete();
									}}
								/>
							</div>
						</Popover.Popup>
					</Popover.Positioner>
				</Popover.Portal>
			</Popover.Root>
		</div>
	);
}

function MenuItem({
	destructive,
	disabled,
	icon,
	label,
	onClick,
}: {
	destructive?: boolean;
	disabled?: boolean;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			className={cn(
				"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 ease-out",
				destructive
					? "text-destructive hover:bg-destructive/10"
					: "hover:bg-muted",
				disabled && "pointer-events-none opacity-50",
			)}
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<span
				className={cn(
					"flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
					destructive ? "bg-destructive/10" : "bg-secondary",
				)}
			>
				{icon}
			</span>
			<span className="flex-1 truncate">{label}</span>
		</button>
	);
}
