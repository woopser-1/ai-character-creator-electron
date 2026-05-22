import {
	ArrowDownToLine,
	ArrowLeft,
	BookOpen,
	FileText,
	Loader2,
	MessageCircle,
	Plus,
	Shield,
	Sparkles,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DefItem, Section } from "@/components/character-detail";
import { Button } from "@/components/ui/button";
import {
	CollapsibleField,
	type CollapsibleFieldSaveResult,
} from "@/components/ui/collapsible-field";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { navigate } from "@/lib/router";
import {
	getFullName,
	MESSAGE_LENGTH_META,
	type StoredCharacter,
	type StoredGroupChat,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type FieldKey = "title" | "publicDescription" | "scenario" | "privateDetails";

interface GroupChatDetailPageProps {
	id: string;
}

function formatLongDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

export function GroupChatDetailPage({ id }: GroupChatDetailPageProps) {
	const [data, setData] = useState<StoredGroupChat | null>(null);
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [regenerateOpen, setRegenerateOpen] = useState(false);
	const [regenerateBusy, setRegenerateBusy] = useState(false);
	const [regenerateError, setRegenerateError] = useState<string | null>(null);
	const [greetingBusyFor, setGreetingBusyFor] = useState<string | null>(null);
	const [greetingError, setGreetingError] = useState<string | null>(null);
	const [deletingGreetingIdx, setDeletingGreetingIdx] = useState<number | null>(
		null,
	);
	const [exportBusy, setExportBusy] = useState(false);
	const toast = useToast();

	useEffect(() => {
		void Promise.all([
			window.api.groupChats.get(id),
			window.api.characters.list(),
		]).then(([gc, cs]) => {
			setData(gc);
			setCharacters(cs);
			setLoaded(true);
		});
	}, [id]);

	const charactersById = useMemo(
		() => new Map(characters.map((c) => [c.id, c])),
		[characters],
	);

	const handleFieldSave = useCallback(
		async (
			field: FieldKey,
			next: string,
		): Promise<CollapsibleFieldSaveResult> => {
			const res = await window.api.groupChats.updateField(id, field, next);
			if (res.success) {
				setData(res.stored);
				return { success: true };
			}
			return { success: false, error: res.error };
		},
		[id],
	);

	const handleGreetingSave = useCallback(
		async (
			index: number,
			next: string,
		): Promise<CollapsibleFieldSaveResult> => {
			const res = await window.api.groupChats.updateGreetingMessage(
				id,
				index,
				next,
			);
			if (res.success) {
				setData(res.stored);
				return { success: true };
			}
			return { success: false, error: res.error };
		},
		[id],
	);

	const handleDelete = useCallback(async () => {
		await window.api.groupChats.delete(id);
		navigate("/group-chats");
	}, [id]);

	const handleGenerateGreeting = useCallback(
		async (speakerFirstName: string) => {
			setGreetingError(null);
			setGreetingBusyFor(speakerFirstName);
			const res = await window.api.groupChats.generateGreeting(
				id,
				speakerFirstName,
			);
			setGreetingBusyFor(null);
			if (res.success) {
				setData(res.stored);
			} else {
				setGreetingError(res.error);
			}
		},
		[id],
	);

	const handleDeleteGreeting = useCallback(
		async (index: number) => {
			setDeletingGreetingIdx(index);
			const res = await window.api.groupChats.deleteGreeting(id, index);
			setDeletingGreetingIdx(null);
			if (res.success) {
				setData(res.stored);
			} else {
				setGreetingError(res.error);
			}
		},
		[id],
	);

	const handleRegenerate = useCallback(async () => {
		setRegenerateBusy(true);
		setRegenerateError(null);
		const res = await window.api.groupChats.regenerate(id);
		setRegenerateBusy(false);
		if (res.success) {
			setData(res.stored);
			setRegenerateOpen(false);
		} else {
			setRegenerateError(res.error);
		}
	}, [id]);

	const handleExport = useCallback(async () => {
		if (!data) return;
		setExportBusy(true);
		const res = await window.api.groupChats.exportToFile([data.id]);
		setExportBusy(false);
		if (res.success) {
			toast.push({
				tone: "success",
				title: `Saved "${data.groupChat.title}"`,
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

	// ⌘E exports the current group chat.
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			const cmdE =
				(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e";
			if (cmdE && !exportBusy && data) {
				event.preventDefault();
				void handleExport();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [data, exportBusy, handleExport]);

	if (!loaded) {
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

	if (!data) {
		return (
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pt-24 pb-16 text-center">
				<h2 className="-tracking-[0.02em] font-semibold text-2xl text-foreground">
					Group chat not found
				</h2>
				<p className="text-muted-foreground text-sm">
					It may have been deleted. Head back to your list to pick another.
				</p>
				<div>
					<a href="#/group-chats">
						<Button size="sm" variant="outline">
							<ArrowLeft className="h-3.5 w-3.5" />
							Back to Group Chats
						</Button>
					</a>
				</div>
			</div>
		);
	}

	const members = data.characterIds
		.map((cid) => charactersById.get(cid))
		.filter((c): c is StoredCharacter => Boolean(c));
	const missingCount = data.characterIds.length - members.length;
	const messageLengthMeta = MESSAGE_LENGTH_META[data.messageLength];
	const greetings = data.groupChat.greetingMessages ?? [];
	const memberByFirstName = new Map(
		members.map((m) => [m.character.firstName.toLowerCase(), m]),
	);

	const actions = (
		<div className="flex flex-wrap items-center gap-1.5">
			<Button
				disabled={exportBusy}
				onClick={() => void handleExport()}
				size="sm"
				variant="outline"
			>
				{exportBusy ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : (
					<ArrowDownToLine className="h-3.5 w-3.5" />
				)}
				{exportBusy ? "Exporting…" : "Export"}
			</Button>
			<Button
				disabled={regenerateBusy}
				onClick={() => {
					setRegenerateError(null);
					setRegenerateOpen(true);
				}}
				size="sm"
				variant="outline"
			>
				{regenerateBusy ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : (
					<Sparkles className="h-3.5 w-3.5" />
				)}
				{regenerateBusy ? "Upgrading…" : "Upgrade"}
			</Button>
			<Dialog>
				<DialogTrigger
					render={
						<Button
							className="text-muted-foreground hover:text-destructive"
							size="sm"
							variant="outline"
						/>
					}
				>
					<Trash2 className="h-3.5 w-3.5" />
					Delete
				</DialogTrigger>
				<DialogContent className="sm:max-w-md" showCloseButton={false}>
					<DialogHeader>
						<span className="eyebrow text-destructive/85">
							Delete group chat
						</span>
						<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
							Toss "{data.groupChat.title}"?
						</DialogTitle>
					</DialogHeader>
					<DialogDescription className="text-[0.875rem] text-muted-foreground leading-relaxed">
						This removes the group chat from your library. The individual
						characters are not affected.
					</DialogDescription>
					<DialogFooter>
						<DialogClose render={<Button size="sm" variant="outline" />}>
							Keep
						</DialogClose>
						<DialogClose
							onClick={handleDelete}
							render={<Button size="sm" variant="destructive" />}
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10">
			<div className="flex items-center justify-between">
				<a href="#/group-chats">
					<Button className="text-muted-foreground" size="sm" variant="ghost">
						<ArrowLeft className="h-4 w-4" />
						Group Chats
					</Button>
				</a>
			</div>

			<Dialog
				onOpenChange={(o) => {
					if (regenerateBusy) return;
					setRegenerateOpen(o);
					if (!o) setRegenerateError(null);
				}}
				open={regenerateOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<span className="eyebrow text-primary/85">Upgrade</span>
						<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
							Upgrade "{data.groupChat.title}"?
						</DialogTitle>
					</DialogHeader>
					<DialogDescription className="text-[0.875rem] text-muted-foreground leading-relaxed">
						This re-runs the generation step with the LATEST framework prompt,
						using the same cast, same gathering summary, same message length.
						The four fields below (title, public description, scenario, private
						details) will be rewritten in place, along with new greeting
						messages. Inline edits you made will be lost.
					</DialogDescription>
					{regenerateError && (
						<div className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs ring-1 ring-destructive/30">
							{regenerateError}
						</div>
					)}
					<DialogFooter>
						<Button
							disabled={regenerateBusy}
							onClick={() => setRegenerateOpen(false)}
							size="sm"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={regenerateBusy}
							onClick={() => void handleRegenerate()}
							size="sm"
						>
							{regenerateBusy ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Sparkles className="h-3.5 w-3.5" />
							)}
							{regenerateBusy ? "Upgrading…" : "Upgrade now"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[20rem_1fr] xl:grid-cols-[22rem_1fr] xl:gap-x-14">
				<aside>
					<GroupChatIdentity
						data={data}
						members={members}
						messageLengthMeta={messageLengthMeta}
						missingCount={missingCount}
					/>
				</aside>
				<main className="min-w-0">
					<div className="mb-6 flex justify-end">{actions}</div>
					<div className="space-y-12">
						<Section
							icon={<FileText className="h-4 w-4" />}
							index={1}
							title="Public description"
						>
							<CollapsibleField
								label=""
								maxHeight={140}
								onSave={(v) => handleFieldSave("publicDescription", v)}
								value={data.groupChat.publicDescription}
							/>
						</Section>

						<Section
							icon={<BookOpen className="h-4 w-4" />}
							index={2}
							subtitle="Narrative setup plus the [FORMAT RULES] block. Paste this into the system prompt of your downstream chat."
							title="Scenario"
						>
							<CollapsibleField
								label=""
								maxHeight={220}
								mono
								onSave={(v) => handleFieldSave("scenario", v)}
								value={data.groupChat.scenario}
							/>
						</Section>

						<Section
							icon={<Shield className="h-4 w-4" />}
							index={3}
							subtitle="Director's-cut spec: per-character stance, alliance map, message header template, speaker rotation, pacing, user integration, hidden group trust system."
							title="Private details"
						>
							<CollapsibleField
								label=""
								maxHeight={220}
								mono
								onSave={(v) => handleFieldSave("privateDetails", v)}
								value={data.groupChat.privateDetails}
							/>
						</Section>

						<Section
							icon={<MessageCircle className="h-4 w-4" />}
							index={4}
							subtitle={
								greetings.length === 0
									? "Opening turns the downstream chat says before the user types anything. None yet."
									: "Opening turns the downstream chat says before the user types anything, in chronological order. Not every cast member speaks."
							}
							tag={
								greetings.length > 0
									? String(greetings.length).padStart(2, "0")
									: undefined
							}
							title="Greeting messages"
						>
							<GreetingMessages
								deletingGreetingIdx={deletingGreetingIdx}
								greetingBusyFor={greetingBusyFor}
								greetingError={greetingError}
								greetings={greetings}
								memberByFirstName={memberByFirstName}
								members={members}
								onDeleteGreeting={handleDeleteGreeting}
								onGenerateGreeting={handleGenerateGreeting}
								onGreetingSave={handleGreetingSave}
							/>
						</Section>
					</div>
				</main>
			</div>
		</div>
	);
}

function GroupChatIdentity({
	data,
	members,
	missingCount,
	messageLengthMeta,
}: {
	data: StoredGroupChat;
	members: StoredCharacter[];
	missingCount: number;
	messageLengthMeta: { label: string; sentenceRange: string };
}) {
	const memberCount = data.characterIds.length;

	return (
		<div className="flex flex-col gap-6">
			<CastMosaic members={members} missingCount={missingCount} />

			<div>
				<div className="eyebrow text-foreground/55">
					Group chat · {formatLongDate(data.createdAt)}
				</div>
				<h1 className="-tracking-[0.025em] mt-3 font-semibold text-[2.25rem] text-foreground leading-[1.02] sm:text-[2.5rem]">
					{data.groupChat.title}
				</h1>
				<p className="mt-3 line-clamp-4 max-w-[32ch] text-[0.875rem] text-muted-foreground leading-relaxed">
					{data.groupChat.publicDescription}
				</p>
				{data.groupChat.tags && data.groupChat.tags.length > 0 && (
					<div className="mt-4 flex flex-wrap gap-1.5">
						{data.groupChat.tags.map((tag) => (
							<span
								className="inline-flex items-center rounded-full bg-secondary/60 px-2.5 py-0.5 font-medium text-[10.5px] text-foreground/75 uppercase tracking-[0.12em] ring-1 ring-foreground/10"
								key={tag}
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-foreground/10 border-t pt-4">
				<DefItem label="Cast size" value={String(memberCount)} />
				<DefItem
					label="Reply length"
					value={`${messageLengthMeta.label} · ${messageLengthMeta.sentenceRange}`}
				/>
			</dl>

			<CastList members={members} missingCount={missingCount} />
		</div>
	);
}

function CastMosaic({
	members,
	missingCount,
}: {
	members: StoredCharacter[];
	missingCount: number;
}) {
	const visible = members.slice(0, 4);
	const remainder = members.length - visible.length + missingCount;

	if (visible.length === 0) {
		return (
			<div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 [box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.22),0_0_32px_oklch(0.72_0.25_305_/_0.16)]">
				<Users className="h-12 w-12 text-foreground/20" />
				<div className="absolute bottom-4 left-5 eyebrow text-foreground/55">
					No cast
				</div>
			</div>
		);
	}

	return (
		<div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 [box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.22),0_0_32px_oklch(0.72_0.25_305_/_0.16)]">
			<div aria-hidden className="absolute inset-0 flex">
				{visible.map((m, idx) => {
					const name = getFullName(m.character);
					const isLastVisible = idx === visible.length - 1 && remainder > 0;
					return (
						<div
							className="relative flex-1 overflow-hidden bg-secondary/60"
							key={m.id}
						>
							{m.profileImageUrl ? (
								<img
									alt={name}
									className="absolute inset-0 h-full w-full object-cover"
									loading="lazy"
									src={m.profileImageUrl}
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center">
									<span
										aria-hidden
										className="display-figure pointer-events-none select-none font-medium text-[2.5rem] text-foreground/25 leading-none"
									>
										{initials(name) || "·"}
									</span>
								</div>
							)}
							{idx < visible.length - 1 && (
								<span
									aria-hidden
									className="absolute inset-y-0 right-0 w-px bg-background/40"
								/>
							)}
							{isLastVisible && (
								<div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
									<span className="font-semibold text-[1.75rem] text-foreground leading-none">
										+{remainder}
									</span>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function CastList({
	members,
	missingCount,
}: {
	members: StoredCharacter[];
	missingCount: number;
}) {
	if (members.length === 0 && missingCount === 0) return null;
	return (
		<div className="flex flex-col gap-2 border-foreground/10 border-t pt-4">
			<div className="flex items-baseline justify-between gap-3">
				<span className="eyebrow text-foreground/55">Cast</span>
				<span className="font-medium text-[10.5px] text-foreground/45 uppercase tracking-[0.18em] tabular-nums">
					{String(members.length).padStart(2, "0")}
				</span>
			</div>
			<ul className="-mx-1 flex flex-col">
				{members.map((m) => {
					const name = getFullName(m.character);
					return (
						<li key={m.id}>
							<a
								aria-label={`Open ${name}`}
								className={cn(
									"group/cast flex items-center gap-3 rounded-lg px-1.5 py-1.5 outline-none transition-colors duration-150",
									"hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/45",
								)}
								href={`#/character/${m.id}`}
							>
								<span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/70 ring-1 ring-foreground/10">
									{m.profileImageUrl ? (
										<img
											alt={name}
											className="h-full w-full object-cover"
											loading="lazy"
											src={m.profileImageUrl}
										/>
									) : (
										<span className="font-semibold text-[10.5px] text-foreground/75">
											{initials(name) || "·"}
										</span>
									)}
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="-tracking-[0.005em] truncate font-medium text-[0.875rem] text-foreground leading-tight">
										{name}
									</span>
									<span className="truncate text-[0.6875rem] text-foreground/55 leading-tight">
										{m.character.occupationLabel}
									</span>
								</span>
							</a>
						</li>
					);
				})}
				{missingCount > 0 && (
					<li className="mt-1 rounded-lg bg-secondary/40 px-2.5 py-2 text-foreground/55 text-xs ring-1 ring-foreground/10">
						{missingCount} member{missingCount === 1 ? "" : "s"} no longer in
						your library
					</li>
				)}
			</ul>
		</div>
	);
}

function GreetingMessages({
	greetings,
	memberByFirstName,
	members,
	greetingBusyFor,
	deletingGreetingIdx,
	greetingError,
	onGreetingSave,
	onGenerateGreeting,
	onDeleteGreeting,
}: {
	greetings: NonNullable<StoredGroupChat["groupChat"]["greetingMessages"]>;
	memberByFirstName: Map<string, StoredCharacter>;
	members: StoredCharacter[];
	greetingBusyFor: string | null;
	deletingGreetingIdx: number | null;
	greetingError: string | null;
	onGreetingSave: (
		index: number,
		value: string,
	) => Promise<CollapsibleFieldSaveResult>;
	onGenerateGreeting: (speakerFirstName: string) => void;
	onDeleteGreeting: (index: number) => void;
}) {
	const canAdd = greetings.length < 5;

	return (
		<div className="flex flex-col gap-5">
			{greetingError && (
				<div className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs ring-1 ring-destructive/30">
					{greetingError}
				</div>
			)}

			{greetings.length > 0 && (
				<div className="flex flex-col gap-4">
					{greetings.map((g, idx) => {
						const speaker = memberByFirstName.get(
							g.speakerFirstName.toLowerCase(),
						);
						const name = speaker
							? getFullName(speaker.character)
							: g.speakerFirstName;
						const isDeleting = deletingGreetingIdx === idx;
						return (
							<div
								className="flex flex-col gap-2"
								key={`${g.speakerFirstName}-${idx}`}
							>
								<div className="flex items-center gap-2">
									<span className="font-semibold text-[10.5px] text-foreground/40 uppercase tracking-[0.22em] tabular-nums">
										{String(idx + 1).padStart(2, "0")}
									</span>
									<span className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-secondary/70 ring-1 ring-foreground/10">
										{speaker?.profileImageUrl ? (
											<img
												alt={name}
												className="h-full w-full object-cover"
												loading="lazy"
												src={speaker.profileImageUrl}
											/>
										) : (
											<span className="font-semibold text-[10px] text-foreground/75">
												{initials(name) || "·"}
											</span>
										)}
									</span>
									<span className="font-semibold text-[0.875rem] text-foreground leading-tight">
										{name}
									</span>
									{!speaker && (
										<span
											className="ml-1 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-[10px] text-destructive uppercase tracking-[0.18em]"
											title={`No character named "${g.speakerFirstName}" in the current cast`}
										>
											Off cast
										</span>
									)}
									<button
										aria-label={`Delete greeting from ${name}`}
										className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-40"
										disabled={isDeleting || greetingBusyFor !== null}
										onClick={() => onDeleteGreeting(idx)}
										type="button"
									>
										{isDeleting ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<X className="h-3.5 w-3.5" />
										)}
									</button>
								</div>
								<CollapsibleField
									label=""
									maxHeight={160}
									mono
									onSave={(v) => onGreetingSave(idx, v)}
									value={g.message}
								/>
							</div>
						);
					})}
				</div>
			)}

			{canAdd && (
				<div className="flex flex-col gap-3 rounded-xl bg-secondary/40 p-4 ring-1 ring-foreground/10">
					<div className="flex items-center gap-2">
						<Plus className="h-3.5 w-3.5 text-foreground/55" />
						<span className="eyebrow text-foreground/55">Add a greeting</span>
						<span className="text-foreground/45 text-xs">
							· pick the next speaker
						</span>
					</div>
					<div className="flex flex-wrap gap-2">
						{members.map((m) => {
							const name = getFullName(m.character);
							const speakerFirstName = m.character.firstName;
							const isBusyHere = greetingBusyFor === speakerFirstName;
							const otherBusy =
								greetingBusyFor !== null && !isBusyHere;
							return (
								<button
									className={cn(
										"group/pick inline-flex items-center gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-[0.8125rem] text-foreground/85 ring-1 ring-foreground/10 transition-all duration-150 ease-out",
										isBusyHere
											? "ring-2 ring-primary/65"
											: otherBusy
												? "cursor-not-allowed opacity-50"
												: "hover:ring-foreground/30",
									)}
									disabled={isBusyHere || otherBusy}
									key={m.id}
									onClick={() => onGenerateGreeting(speakerFirstName)}
									title={`Generate a new greeting from ${name}`}
									type="button"
								>
									<span className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-secondary/70 ring-1 ring-foreground/10">
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
									<span className="font-medium">{name}</span>
									{isBusyHere ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
									) : (
										<Plus className="h-3 w-3 text-foreground/45 transition-colors group-hover/pick:text-primary" />
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
