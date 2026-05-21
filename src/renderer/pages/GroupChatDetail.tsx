import {
	ArrowLeft,
	BookOpen,
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
		async (field: FieldKey, next: string): Promise<CollapsibleFieldSaveResult> => {
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

	if (!loaded) return <div className="flex-1" />;

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

	return (
		<div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10">
			<div className="flex items-center justify-between">
				<a href="#/group-chats">
					<Button size="sm" variant="ghost">
						<ArrowLeft className="h-3.5 w-3.5" />
						All Group Chats
					</Button>
				</a>
				<div className="flex items-center gap-2">
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
						This re-runs the generation step with the LATEST framework prompt —
						same cast, same gathering summary, same message length. The four
						fields below (title, public description, scenario, private details)
						will be rewritten in place, along with new greeting messages. Inline
						edits you made will be lost.
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
					<GroupChatReview
						data={data}
						deletingGreetingIdx={deletingGreetingIdx}
						greetingBusyFor={greetingBusyFor}
						greetingError={greetingError}
						greetings={greetings}
						memberByFirstName={memberByFirstName}
						members={members}
						onDeleteGreeting={handleDeleteGreeting}
						onFieldSave={handleFieldSave}
						onGenerateGreeting={handleGenerateGreeting}
						onGreetingSave={handleGreetingSave}
					/>
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
	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="eyebrow text-foreground/55">
					Group chat · {formatLongDate(data.createdAt)}
				</div>
				<h1 className="-tracking-[0.025em] mt-3 font-semibold text-[2rem] text-foreground leading-[1.05] sm:text-[2.25rem]">
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

			<div className="flex flex-col gap-3">
				<div className="inline-flex items-center gap-1.5 eyebrow text-foreground/55">
					<Users className="h-3 w-3" />
					Cast
					<span className="ml-1 text-foreground/40 tabular-nums">
						{String(data.characterIds.length).padStart(2, "0")}
					</span>
				</div>
				<ul className="flex flex-col gap-3">
					{members.map((m) => {
						const name = getFullName(m.character);
						return (
							<li key={m.id}>
								<a
									aria-label={`Open ${name}`}
									className="group/cast relative block aspect-[4/3] overflow-hidden rounded-2xl bg-card outline-none ring-1 ring-foreground/10 transition-all duration-300 ease-out hover:ring-transparent hover:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.35),0_0_24px_oklch(0.72_0.25_305_/_0.16)] focus-visible:ring-3 focus-visible:ring-ring/50"
									href={`#/character/${m.id}`}
								>
									{m.profileImageUrl ? (
										<img
											alt={name}
											className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/cast:scale-[1.04]"
											loading="lazy"
											src={m.profileImageUrl}
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center bg-secondary/60">
											<span
												aria-hidden
												className="display-figure pointer-events-none select-none font-medium text-[3.5rem] text-foreground/20 leading-none"
											>
												{initials(name) || "·"}
											</span>
										</div>
									)}
									<div
										aria-hidden
										className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent transition-opacity duration-300 ease-out group-hover/cast:from-background"
									/>
									<div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
										<span className="-tracking-[0.005em] truncate font-semibold text-[1.0625rem] text-foreground leading-tight">
											{name}
										</span>
										<span className="truncate text-[0.75rem] text-foreground/65 leading-tight">
											{m.character.occupationLabel}
										</span>
									</div>
								</a>
							</li>
						);
					})}
					{missingCount > 0 && (
						<li className="rounded-2xl bg-secondary/40 p-3 text-foreground/55 text-xs ring-1 ring-foreground/10">
							{missingCount} member{missingCount === 1 ? "" : "s"} no longer in
							your library
						</li>
					)}
				</ul>
			</div>

			<dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-foreground/10 border-t pt-4">
				<DefItem
					label="Reply length"
					value={`${messageLengthMeta.label} · ${messageLengthMeta.sentenceRange}`}
				/>
				<DefItem
					label="Cast size"
					value={String(data.characterIds.length)}
				/>
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
		<div className="flex min-w-0 flex-col gap-1">
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

function GroupChatReview({
	data,
	greetings,
	memberByFirstName,
	members,
	greetingBusyFor,
	deletingGreetingIdx,
	greetingError,
	onFieldSave,
	onGreetingSave,
	onGenerateGreeting,
	onDeleteGreeting,
}: {
	data: StoredGroupChat;
	greetings: NonNullable<StoredGroupChat["groupChat"]["greetingMessages"]>;
	memberByFirstName: Map<string, StoredCharacter>;
	members: StoredCharacter[];
	greetingBusyFor: string | null;
	deletingGreetingIdx: number | null;
	greetingError: string | null;
	onFieldSave: (
		field: FieldKey,
		value: string,
	) => Promise<CollapsibleFieldSaveResult>;
	onGreetingSave: (
		index: number,
		value: string,
	) => Promise<CollapsibleFieldSaveResult>;
	onGenerateGreeting: (speakerFirstName: string) => void;
	onDeleteGreeting: (index: number) => void;
}) {
	return (
		<div className="space-y-12">
			<Section
				icon={<BookOpen className="h-4 w-4" />}
				index={1}
				subtitle="The story-blurb that introduces this scene. Editable inline."
				title="Public description"
			>
				<CollapsibleField
					label=""
					onSave={(v) => onFieldSave("publicDescription", v)}
					value={data.groupChat.publicDescription}
				/>
			</Section>

			<Section
				icon={<BookOpen className="h-4 w-4" />}
				index={2}
				subtitle="Narrative setup + [FORMAT RULES] block. Paste this into the system prompt of your downstream chat."
				title="Scenario"
			>
				<CollapsibleField
					label=""
					maxHeight={180}
					mono
					onSave={(v) => onFieldSave("scenario", v)}
					value={data.groupChat.scenario}
				/>
			</Section>

			<Section
				icon={<Shield className="h-4 w-4" />}
				index={3}
				subtitle="Director's-cut spec — XML-tagged sections for per-character stance, alliance map, message header template, speaker rotation, pacing, user integration, and the hidden group trust system."
				title="Private details"
			>
				<CollapsibleField
					label=""
					maxHeight={180}
					mono
					onSave={(v) => onFieldSave("privateDetails", v)}
					value={data.groupChat.privateDetails}
				/>
			</Section>

			<Section
				icon={<MessageCircle className="h-4 w-4" />}
				index={4}
				subtitle={
					greetings.length === 0
						? "This group chat doesn't have any greeting messages yet. Pick a cast member below to draft one."
						: "Opening turns the downstream chat says before the user types anything. In chronological order; not every cast member speaks."
				}
				title={`Greeting messages${greetings.length > 0 ? ` · ${greetings.length}` : ""}`}
			>
				{greetingError && (
					<div className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs ring-1 ring-destructive/30">
						{greetingError}
					</div>
				)}

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
									maxHeight={140}
									mono
									onSave={(v) => onGreetingSave(idx, v)}
									value={g.message}
								/>
							</div>
						);
					})}
				</div>

				{greetings.length < 5 && (
					<div className="flex flex-col gap-3 rounded-xl bg-secondary/40 p-4 ring-1 ring-foreground/10">
						<div className="flex items-center gap-2">
							<Plus className="h-3.5 w-3.5 text-foreground/55" />
							<span className="eyebrow text-foreground/55">
								Add a greeting
							</span>
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
			</Section>
		</div>
	);
}

function Section({
	index,
	icon,
	title,
	subtitle,
	children,
}: {
	index: number;
	icon: React.ReactNode;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<span
						aria-hidden
						className="display-figure font-medium text-[0.75rem] text-foreground/35 leading-none tabular-nums"
					>
						{String(index).padStart(2, "0")}
					</span>
					<span className="text-foreground/55">{icon}</span>
					<h3 className="-tracking-[0.01em] font-semibold text-[1.125rem] text-foreground leading-tight">
						{title}
					</h3>
					<span className="h-px flex-1 bg-foreground/10" />
				</div>
				{subtitle && (
					<p className="max-w-[68ch] text-foreground/55 text-xs leading-relaxed">
						{subtitle}
					</p>
				)}
			</div>
			{children}
		</section>
	);
}
