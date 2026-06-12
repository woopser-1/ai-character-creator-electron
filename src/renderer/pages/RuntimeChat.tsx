import {
	ImageIcon,
	Loader2,
	MessageSquare,
	Plus,
	RotateCcw,
	Search,
	Trash2,
	UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { navigate } from "@/lib/router";
import {
	getFullName,
	RUNTIME_CHAT_TIERS,
	type RuntimeChatState,
	type RuntimeChatStateDelta,
	type RuntimeChatUserGender,
	type RuntimeChatUserProfile,
	type StoredCharacter,
	type StoredChatConversation,
	type UserPersona,
	type UserPersonaInput,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface RuntimeChatPageProps {
	id?: string;
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Unknown";

	return date.toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function emptyProfile(): RuntimeChatUserProfile {
	return {
		name: "",
		gender: "unspecified",
		description: "",
	};
}

function profileFromPersona(persona: UserPersona): RuntimeChatUserProfile {
	return {
		personaId: persona.id,
		name: persona.name,
		gender: persona.gender,
		age: persona.age,
		description: persona.description,
	};
}

function normalizeGender(value: unknown): RuntimeChatUserGender {
	return value === "male" ||
		value === "female" ||
		value === "other" ||
		value === "unspecified"
		? value
		: "unspecified";
}

function personaInputFromProfile(
	profile: RuntimeChatUserProfile,
): UserPersonaInput {
	return {
		name: profile.name?.trim() || undefined,
		gender: normalizeGender(profile.gender),
		age: profile.age,
		description:
			profile.description?.trim() ||
			profile.notes?.trim() ||
			[
				profile.manner?.trim(),
				profile.clothing?.trim(),
				profile.location?.trim(),
			]
				.filter(Boolean)
				.join("; "),
	};
}

export function RuntimeChatPage({ id }: RuntimeChatPageProps) {
	const [conversations, setConversations] = useState<StoredChatConversation[]>([]);
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [personas, setPersonas] = useState<UserPersona[]>([]);
	const [conversation, setConversation] =
		useState<StoredChatConversation | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [search, setSearch] = useState("");
	const [newOpen, setNewOpen] = useState(false);
	const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set());
	const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
	const [guidance, setGuidance] = useState("");
	const toast = useToast();

	useEffect(() => {
		void Promise.all([
			window.api.runtimeChat.list(),
			window.api.characters.list(),
			window.api.userPersonas.list(),
		]).then(([chatList, characterList, personaList]) => {
			setConversations(chatList);
			setCharacters(characterList);
			setPersonas(personaList);
			setLoaded(true);
		});
	}, []);

	useEffect(() => {
		if (!id) {
			setConversation(null);
			return;
		}

		void window.api.runtimeChat.get(id).then(setConversation);
	}, [id]);

	useEffect(() => {
		return window.api.runtimeChat.onEvent((event) => {
			if (event.type === "conversation-updated") {
				setConversations((prev) => {
					const next = prev.filter((item) => item.id !== event.conversation.id);
					return [event.conversation, ...next].sort((a, b) =>
						b.updatedAt.localeCompare(a.updatedAt),
					);
				});
				setStreamingIds((prev) => {
					const next = new Set(prev);
					for (const message of event.conversation.messages) {
						if (message.stateSnapshot || message.error) next.delete(message.id);
					}
					return next;
				});
				if (event.conversationId === id) setConversation(event.conversation);
				return;
			}

			if (event.type === "text-delta") {
				setStreamingIds((prev) => new Set(prev).add(event.messageId));
				if (event.conversationId !== id) return;
				setConversation((prev) => {
					if (!prev) return prev;

					return {
						...prev,
						messages: prev.messages.map((message) =>
							message.id === event.messageId
								? { ...message, text: `${message.text}${event.text}` }
								: message,
						),
					};
				});
				return;
			}

			toast.push({
				tone: "error",
				title: "Chat failed",
				description: event.error,
			});
		});
	}, [id, toast]);

	const charactersById = useMemo(
		() => new Map(characters.map((character) => [character.id, character])),
		[characters],
	);

	const activeCharacter = conversation
		? charactersById.get(conversation.characterId)
		: null;

	const filteredConversations = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return conversations;

		return conversations.filter((item) => {
			const character = charactersById.get(item.characterId);
			const name = character ? getFullName(character.character) : item.title;

			return `${item.title} ${name}`.toLowerCase().includes(term);
		});
	}, [conversations, charactersById, search]);

	const sendMessage = useCallback(
		async (text: string) => {
			if (!conversation) return;
			const result = await window.api.runtimeChat.sendMessage(
				conversation.id,
				text,
			);
			if (result.success) {
				setConversation(result.conversation);
				setConversations((prev) => {
					const next = prev.filter((item) => item.id !== result.conversation.id);
					return [result.conversation, ...next];
				});
				const pending = result.conversation.messages.at(-1);
				if (pending?.role === "assistant") {
					setStreamingIds((prev) => new Set(prev).add(pending.id));
				}
			} else {
				toast.push({
					tone: "error",
					title: "Message failed",
					description: result.error,
				});
			}
		},
		[conversation, toast],
	);

	const addCharacterMessage = useCallback(async (guidance?: string) => {
		if (!conversation) return;
		const result = await window.api.runtimeChat.addCharacterMessage(
			conversation.id,
			guidance,
		);
		if (result.success) {
			setConversation(result.conversation);
			setConversations((prev) => {
				const next = prev.filter((item) => item.id !== result.conversation.id);
				return [result.conversation, ...next];
			});
			const pending = result.conversation.messages.at(-1);
			if (pending?.role === "assistant") {
				setStreamingIds((prev) => new Set(prev).add(pending.id));
			}
		} else {
			toast.push({
				tone: "error",
				title: "Character message failed",
				description: result.error,
			});
		}
	}, [conversation, toast]);

	const savePersona = useCallback(
		async (profile: RuntimeChatUserProfile, id?: string) => {
			const input = personaInputFromProfile(profile);
			const result = id
				? await window.api.userPersonas.update(id, input)
				: await window.api.userPersonas.create(input);
			if (result.success) {
				setPersonas((prev) => {
					const next = prev.filter((persona) => persona.id !== result.persona.id);
					return [result.persona, ...next];
				});
				return result.persona;
			}

			toast.push({
				tone: "error",
				title: "Persona failed",
				description: result.error,
			});
			return null;
		},
		[toast],
	);

	const deleteMessage = useCallback(
		async (messageId: string) => {
			if (!conversation) return;
			const result = await window.api.runtimeChat.deleteMessage(
				conversation.id,
				messageId,
			);
			if (result.success) {
				setConversation(result.conversation);
				setConversations((prev) => {
					const next = prev.filter((item) => item.id !== result.conversation.id);
					return [result.conversation, ...next];
				});
				setStreamingIds(new Set());
			} else {
				toast.push({
					tone: "error",
					title: "Delete failed",
					description: result.error,
				});
			}
		},
		[conversation, toast],
	);

	const saveProfile = useCallback(
		async (nextProfile: RuntimeChatUserProfile) => {
			if (!conversation) return;
			setConversation({ ...conversation, userProfile: nextProfile });
			const result = await window.api.runtimeChat.updateUserProfile(
				conversation.id,
				nextProfile,
			);
			if (result.success) setConversation(result.conversation);
		},
		[conversation],
	);

	const deletePersona = useCallback(
		async (personaId: string) => {
			await window.api.userPersonas.delete(personaId);
			setPersonas((prev) => prev.filter((persona) => persona.id !== personaId));

			if (conversation?.userProfile.personaId === personaId) {
				await saveProfile({
					...conversation.userProfile,
					personaId: undefined,
				});
			}
		},
		[conversation, saveProfile],
	);

	const saveConversationPersona = useCallback(
		async (profile: RuntimeChatUserProfile, personaId?: string) => {
			const persona = await savePersona(profile, personaId);
			if (!persona) return;

			await saveProfile(profileFromPersona(persona));
		},
		[savePersona, saveProfile],
	);

	const deleteConversation = useCallback(async () => {
		if (!conversation) return;
		const result = await window.api.runtimeChat.delete(conversation.id);
		if (result.success) {
			setConversations((prev) =>
				prev.filter((item) => item.id !== conversation.id),
			);
			navigate("/chat");
		} else {
			toast.push({
				tone: "error",
				title: "Delete failed",
				description: result.error,
			});
		}
	}, [conversation, toast]);

	const regenerate = useCallback(async () => {
		if (!conversation || !regeneratingId) return;
		const result = await window.api.runtimeChat.regenerateMessage(
			conversation.id,
			regeneratingId,
			guidance,
		);
		if (result.success) {
			setConversation(result.conversation);
			setGuidance("");
			setRegeneratingId(null);
			setStreamingIds((prev) => new Set(prev).add(regeneratingId));
		} else {
			toast.push({
				tone: "error",
				title: "Regeneration failed",
				description: result.error,
			});
		}
	}, [conversation, regeneratingId, guidance, toast]);

	const busy = useMemo(
		() =>
			conversation?.messages.some((message) => streamingIds.has(message.id)) ??
			false,
		[conversation, streamingIds],
	);

	if (!loaded) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<Loader2 className="h-5 w-5 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<>
			<div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)_24rem] overflow-hidden max-xl:grid-cols-[16rem_minmax(0,1fr)]">
				<ConversationRail
					charactersById={charactersById}
					conversations={filteredConversations}
					onNew={() => setNewOpen(true)}
					search={search}
					selectedId={id}
					setSearch={setSearch}
				/>
				<ConversationCenter
					busy={busy}
					character={activeCharacter}
					conversation={conversation}
					onAddCharacterMessage={(guidance) =>
						void addCharacterMessage(guidance)
					}
					onDeleteMessage={(messageId) => void deleteMessage(messageId)}
					onRegenerate={(messageId) => {
						setGuidance("");
						setRegeneratingId(messageId);
					}}
					onSend={(text) => void sendMessage(text)}
					streamingIds={streamingIds}
				/>
					<StatePanel
						character={activeCharacter}
						conversation={conversation}
						onDelete={() => void deleteConversation()}
						onPersonaDelete={(personaId) => void deletePersona(personaId)}
						onPersonaSave={(profile, personaId) =>
							void saveConversationPersona(profile, personaId)
						}
						onProfileChange={(profile) => void saveProfile(profile)}
						personas={personas}
				/>
			</div>

			<NewConversationDialog
				characters={characters}
				onCreated={(created) => {
					setNewOpen(false);
					setConversations((prev) => [created, ...prev]);
					navigate(`/chat/${created.id}`);
				}}
					onOpenChange={setNewOpen}
					open={newOpen}
					personas={personas}
					deletePersona={(personaId) => void deletePersona(personaId)}
					savePersona={(profile) => savePersona(profile)}
				/>

			<Dialog
				onOpenChange={(open) => {
					if (!open) setRegeneratingId(null);
				}}
				open={Boolean(regeneratingId)}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Regenerate reply</DialogTitle>
					</DialogHeader>
					<Textarea
						onChange={(event) => setGuidance(event.target.value)}
						placeholder="Guide the rewrite..."
						value={guidance}
					/>
					<DialogFooter>
						<DialogClose render={<Button size="sm" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button onClick={() => void regenerate()} size="sm">
							<RotateCcw className="h-3.5 w-3.5" />
							Regenerate
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function ConversationRail({
	conversations,
	charactersById,
	selectedId,
	search,
	setSearch,
	onNew,
}: {
	conversations: StoredChatConversation[];
	charactersById: Map<string, StoredCharacter>;
	selectedId?: string;
	search: string;
	setSearch: (value: string) => void;
	onNew: () => void;
}) {
	return (
		<aside className="flex min-h-0 flex-col border-border border-r bg-background/40">
			<div className="flex h-14 items-center justify-between gap-2 border-border border-b px-3">
				<div className="flex items-center gap-2">
					<MessageSquare className="h-4 w-4 text-primary" />
					<span className="font-medium text-sm">Chat</span>
				</div>
				<Button onClick={onNew} size="icon-sm">
					<Plus className="h-3.5 w-3.5" />
				</Button>
			</div>
			<div className="border-border border-b p-3">
				<div className="relative">
					<Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						className="pl-8"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search"
						value={search}
					/>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-2">
				{conversations.map((conversation) => {
					const character = charactersById.get(conversation.characterId);
					const name = character
						? getFullName(character.character)
						: conversation.title;
					const latest = conversation.messages.at(-1)?.text.trim();
					const selected = conversation.id === selectedId;

					return (
						<a
							aria-current={selected ? "page" : undefined}
							className={cn(
								"mb-1 flex gap-2 rounded-lg p-2 text-left outline-none ring-1 ring-transparent transition-colors duration-150 hover:bg-muted/70",
								selected && "bg-muted ring-primary/35",
							)}
							href={`#/chat/${conversation.id}`}
							key={conversation.id}
						>
							<Avatar character={character} name={name} size="sm" />
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between gap-2">
									<p className="truncate font-medium text-[0.8125rem] text-foreground">
										{name}
									</p>
									<span className="shrink-0 text-[0.6875rem] text-muted-foreground">
										{formatTime(conversation.updatedAt)}
									</span>
								</div>
								<p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
									{latest || "No messages yet"}
								</p>
							</div>
						</a>
					);
				})}
			</div>
		</aside>
	);
}

function ConversationCenter({
	conversation,
	character,
	busy,
	streamingIds,
	onSend,
	onRegenerate,
	onDeleteMessage,
	onAddCharacterMessage,
}: {
	conversation: StoredChatConversation | null;
	character: StoredCharacter | null | undefined;
	busy: boolean;
	streamingIds: Set<string>;
	onSend: (text: string) => void;
	onRegenerate: (messageId: string) => void;
	onDeleteMessage: (messageId: string) => void;
	onAddCharacterMessage: (guidance?: string) => void;
}) {
	if (!conversation) {
		return (
			<section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
				<MessageSquare className="h-10 w-10 text-foreground/25" />
				<div>
					<h1 className="font-semibold text-xl tracking-tight">Chat</h1>
					<p className="mt-1 max-w-[36ch] text-muted-foreground text-sm">
						Select a conversation or create a new one from a character.
					</p>
				</div>
			</section>
		);
	}

	const name = character ? getFullName(character.character) : conversation.title;
	const hasPriorUser = (index: number) =>
		conversation.messages.slice(0, index).some((message) => message.role === "user");
	const previousAssistantState = (index: number): RuntimeChatState | undefined => {
		for (let i = index - 1; i >= 0; i--) {
			const state = conversation.messages[i]?.stateSnapshot;
			if (state) return state;
		}

		return undefined;
	};

	return (
		<section className="flex min-h-0 flex-col overflow-hidden">
			<div className="flex h-14 items-center justify-between gap-3 border-border border-b px-4">
				<div className="flex min-w-0 items-center gap-2.5">
					<Avatar character={character} name={name} size="sm" />
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">{name}</p>
						<p className="truncate text-muted-foreground text-xs">
							{conversation.currentState.location} · {conversation.currentState.band}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{busy && (
						<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs ring-1 ring-primary/25">
							<Loader2 className="h-3 w-3 animate-spin" />
							Thinking
						</span>
					)}
				</div>
			</div>
			<ChatContainer>
				{conversation.messages.map((message, index) => (
					<RuntimeMessage
						character={character}
						key={message.id}
						message={message}
						onDelete={
							message.role === "user"
								? () => onDeleteMessage(message.id)
								: undefined
						}
						onRegenerate={
							message.role === "assistant" && hasPriorUser(index)
								? onRegenerate
								: undefined
						}
						previousState={previousAssistantState(index)}
						streaming={streamingIds.has(message.id)}
					/>
				))}
			</ChatContainer>
			<div className="border-border border-t p-3">
				<div className="flex items-end gap-2">
					<Button
						className="h-[44px] shrink-0"
						disabled={busy}
						onClick={() => onAddCharacterMessage("Continue naturally from the character's perspective.")}
						variant="outline"
					>
						<Plus className="h-3.5 w-3.5" />
						Character turn
					</Button>
					<div className="min-w-0 flex-1">
						<ChatInput
							disabled={busy}
							onSend={onSend}
							placeholder={`Message ${character?.character.firstName ?? "character"}...`}
						/>
					</div>
				</div>
				<QuickActionBar
					disabled={busy}
					onAction={(guidance) => onAddCharacterMessage(guidance)}
				/>
			</div>
		</section>
	);
}

function QuickActionBar({
	disabled,
	onAction,
}: {
	disabled: boolean;
	onAction: (guidance: string) => void;
}) {
	const actions = [
		{
			label: "Continue",
			guidance: "Continue naturally without jumping ahead.",
		},
		{
			label: "Shorter",
			guidance: "Continue with a shorter, tighter reply.",
		},
		{
			label: "More intense",
			guidance: "Increase emotional intensity while preserving consent, pacing, and character consistency.",
		},
		{
			label: "Slower",
			guidance: "Slow the pacing down and linger on the current beat.",
		},
		{
			label: "Stay in character",
			guidance: "Course-correct strongly toward the character profile and current state.",
		},
	];

	return (
		<div className="mt-2 flex flex-wrap items-center gap-1.5">
			{actions.map((action) => (
				<button
					className="rounded-full bg-secondary/70 px-2.5 py-1 text-muted-foreground text-xs ring-1 ring-foreground/10 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
					disabled={disabled}
					key={action.label}
					onClick={() => onAction(action.guidance)}
					type="button"
				>
					{action.label}
				</button>
			))}
		</div>
	);
}

function RuntimeMessage({
	message,
	character,
	streaming,
	onRegenerate,
	onDelete,
	previousState,
}: {
	message: StoredChatConversation["messages"][number];
	character?: StoredCharacter | null;
	streaming: boolean;
	onRegenerate?: (messageId: string) => void;
	onDelete?: () => void;
	previousState?: RuntimeChatState;
}) {
	const isUser = message.role === "user";
	const name = character ? getFullName(character.character) : "Character";

	return (
		<div className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
			{isUser ? (
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
					<UserRound className="h-4 w-4" />
				</div>
			) : (
				<Avatar character={character} name={name} size="md" />
			)}
			<div
				className={cn(
					"relative flex min-w-0 max-w-[78%] flex-col gap-2",
					isUser ? "items-end" : "items-start",
				)}
			>
					<div
						className={cn(
							"rounded-xl px-3.5 py-2 text-sm leading-relaxed ring-1",
						isUser
							? "bg-muted text-foreground ring-foreground/10"
							: "bg-card/65 text-foreground ring-foreground/10",
					)}
				>
					<div className={cn("chat-markdown", isUser && "text-right")}>
						{message.text ? (
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{message.text}
							</ReactMarkdown>
						) : (
							!isUser && (
								<div className="flex items-center gap-1.5 py-1">
									<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
									<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
									<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
								</div>
							)
						)}
					</div>
				</div>
				{message.error && (
					<p className="max-w-sm text-destructive text-xs">{message.error}</p>
				)}
					{streaming && message.text && (
						<span className="text-primary text-xs">Streaming...</span>
					)}
					{message.stateSnapshot && !isUser && !streaming && (
						<StateChangeMessage
							previousState={previousState}
							state={message.stateSnapshot}
							stateDelta={message.stateDelta}
						/>
					)}
					{(onRegenerate || onDelete) && (
						<div
							className={cn(
							"flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
							isUser ? "justify-end" : "justify-start",
						)}
					>
						{onRegenerate && (
							<button
								className="inline-flex h-7 items-center gap-1 rounded-full bg-popover px-2 text-muted-foreground text-xs ring-1 ring-foreground/10 transition-colors hover:text-foreground"
								onClick={() => onRegenerate(message.id)}
								type="button"
							>
								<RotateCcw className="h-3 w-3" />
								Regenerate
							</button>
						)}
						{onDelete && (
							<button
								className="inline-flex h-7 items-center gap-1 rounded-full bg-popover px-2 text-muted-foreground text-xs ring-1 ring-foreground/10 transition-colors hover:text-destructive"
								onClick={onDelete}
								type="button"
							>
								<Trash2 className="h-3 w-3" />
								Delete
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function delta(current: number, previous?: number): number {
	if (previous === undefined) return 0;
	const value = current - previous;

	return value;
}

function fallbackStateChanges(
	state: RuntimeChatState,
	previousState?: RuntimeChatState,
): RuntimeChatStateDelta["changes"] {
	const changes = [
		{
			key: "primary",
			label: state.visibleAxes.primary.label,
			before: previousState?.visibleAxes.primary.value ?? state.visibleAxes.primary.value,
			after: state.visibleAxes.primary.value,
			delta: delta(
				state.visibleAxes.primary.value,
				previousState?.visibleAxes.primary.value,
			),
		},
		{
			key: "secondary",
			label: state.visibleAxes.secondary.label,
			before: previousState?.visibleAxes.secondary.value ?? state.visibleAxes.secondary.value,
			after: state.visibleAxes.secondary.value,
			delta: delta(
				state.visibleAxes.secondary.value,
				previousState?.visibleAxes.secondary.value,
			),
		},
		{
			key: "trust",
			label: "Trust",
			before: previousState?.trust ?? state.trust,
			after: state.trust,
			delta: delta(state.trust, previousState?.trust),
		},
		{
			key: "attraction",
			label: "Attraction",
			before: previousState?.attraction ?? state.attraction,
			after: state.attraction,
			delta: delta(state.attraction, previousState?.attraction),
		},
		{
			key: "arousal",
			label: "Arousal",
			before: previousState?.arousal ?? state.arousal,
			after: state.arousal,
			delta: delta(state.arousal, previousState?.arousal),
		},
		{
			key: "friendliness",
			label: "Friendliness",
			before: previousState?.friendliness ?? state.friendliness,
			after: state.friendliness,
			delta: delta(state.friendliness, previousState?.friendliness),
		},
	];

	return changes
		.filter((change) => change.delta !== 0)
		.map((change) => ({
			...change,
			tone:
				change.key === "arousal"
					? "neutral"
					: change.delta > 0
						? "positive"
						: "negative",
		}));
}

function StateChangeMessage({
	state,
	previousState,
	stateDelta,
}: {
	state: RuntimeChatState;
	previousState?: RuntimeChatState;
	stateDelta?: RuntimeChatStateDelta;
}) {
	const changes = stateDelta?.changes.length
		? stateDelta.changes.filter((change) => change.delta !== 0)
		: fallbackStateChanges(state, previousState);

	if (!changes.length) return null;

	const positiveCount = changes.filter((change) => change.tone === "positive").length;
	const negativeCount = changes.filter((change) => change.tone === "negative").length;

	return (
		<motion.div
			animate={{ opacity: 1, y: 0, scale: 1 }}
			className="max-w-full rounded-xl bg-card/45 px-3 py-2 text-xs ring-1 ring-foreground/10"
			initial={{ opacity: 0, y: 6, scale: 0.985 }}
			transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
		>
			<div className="mb-2 flex flex-wrap items-center gap-1.5 text-muted-foreground">
				<span className="font-medium text-foreground/85">Personality shift</span>
				<span className="rounded-full bg-muted px-2 py-0.5 ring-1 ring-foreground/10">
					{state.tier} · {state.band}
				</span>
				{positiveCount > 0 && (
					<span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary ring-1 ring-primary/25">
						{positiveCount} positive
					</span>
				)}
				{negativeCount > 0 && (
					<span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive ring-1 ring-destructive/25">
						{negativeCount} negative
					</span>
				)}
			</div>
			<div className="flex flex-wrap gap-1.5">
				{changes.map((change) => (
					<TraitPill
						change={change}
						key={`${change.key}-${change.before}-${change.after}`}
					/>
				))}
			</div>
			{stateDelta?.summary && (
				<p className="mt-2 line-clamp-2 text-muted-foreground leading-snug">
					{stateDelta.summary}
				</p>
			)}
		</motion.div>
	);
}

function TraitPill({ change }: { change: RuntimeChatStateDelta["changes"][number] }) {
	return (
		<motion.span
			animate={{ opacity: 1, y: 0, scale: 1 }}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2 py-1 ring-1",
				change.tone === "positive" && "bg-primary/10 text-primary ring-primary/25",
				change.tone === "negative" && "bg-destructive/10 text-destructive ring-destructive/25",
				change.tone === "neutral" && "bg-muted text-foreground/80 ring-foreground/15",
			)}
			initial={{ opacity: 0, y: 3, scale: 0.96 }}
			key={`${change.label}-${change.after}-${change.delta}`}
			transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
		>
			<span>{change.label}</span>
			<span className="font-mono text-[0.6875rem] opacity-80">
				{change.before}→{change.after}
			</span>
			<span className="font-mono">
				{change.delta > 0 ? "+" : ""}
				{change.delta}
			</span>
		</motion.span>
	);
}

function StatePanel({
	conversation,
	character,
	onProfileChange,
	onPersonaSave,
	onPersonaDelete,
	personas,
	onDelete,
}: {
	conversation: StoredChatConversation | null;
	character: StoredCharacter | null | undefined;
	onProfileChange: (profile: RuntimeChatUserProfile) => void;
	onPersonaSave: (
		profile: RuntimeChatUserProfile,
		personaId?: string,
	) => void;
	onPersonaDelete: (personaId: string) => void;
	personas: UserPersona[];
	onDelete: () => void;
}) {
	if (!conversation) {
		return (
			<aside className="flex min-h-0 flex-col border-border border-l bg-background/35 max-xl:hidden" />
		);
	}

	const state = conversation.currentState;
	const profile = conversation.userProfile;
	const name = character ? getFullName(character.character) : conversation.title;

	const updateProfile = (patch: Partial<RuntimeChatUserProfile>) =>
		onProfileChange({ ...profile, ...patch });

	return (
		<aside className="flex min-h-0 flex-col overflow-y-auto border-border border-l bg-background/35 p-4 max-xl:hidden">
			<div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
				<div className="aspect-[3/4] max-h-[52vh] bg-secondary/60">
					{character?.profileImageUrl ? (
						<img
							alt={name}
							className="h-full w-full object-cover"
							src={character.profileImageUrl}
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<ImageIcon className="h-8 w-8 text-foreground/25" />
						</div>
					)}
				</div>
				<div className="p-3">
					<p className="font-semibold text-sm">{name}</p>
					<p className="mt-1 text-muted-foreground text-xs">
						{character?.character.personalityLabel ?? "Character"}
					</p>
				</div>
			</div>

			<div className="mt-4 space-y-4">
				<ReadOnlyState state={state} />
				<TierScale activeTier={state.tier} />
				{conversation.memorySummary && (
					<div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
						<p className="mb-2 font-medium text-sm">Memory</p>
						<p className="whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">
							{conversation.memorySummary}
						</p>
					</div>
				)}
					<PersonaPanel
						onChange={updateProfile}
						onDelete={onPersonaDelete}
						onSave={() => onPersonaSave(profile, profile.personaId)}
						personas={personas}
						profile={profile}
					selectPersona={(persona) => onProfileChange(profileFromPersona(persona))}
				/>

				<Button
					className="w-full text-muted-foreground hover:text-destructive"
					onClick={onDelete}
					variant="outline"
				>
					<Trash2 className="h-3.5 w-3.5" />
					Delete conversation
				</Button>
			</div>
		</aside>
	);
}

function ReadOnlyState({ state }: { state: RuntimeChatState }) {
	return (
		<div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="font-medium text-sm">State</p>
				<span className="rounded-full bg-muted px-2 py-0.5 font-mono text-primary text-xs ring-1 ring-primary/25">
					{state.tier}
				</span>
			</div>
			<div className="space-y-3">
				<ReadOnlyAxis axis={state.visibleAxes.primary} />
				<ReadOnlyAxis axis={state.visibleAxes.secondary} />
				<div className="grid grid-cols-2 gap-2">
					<ReadOnlyMetric label="Trust" value={state.trust} />
					<ReadOnlyMetric label="Attraction" value={state.attraction} />
					<ReadOnlyMetric label="Arousal" value={state.arousal} />
					<ReadOnlyMetric label="Friendliness" value={state.friendliness} />
				</div>
				<div className="grid gap-2 text-xs">
					<StateLine label="Location" value={state.location} />
					<StateLine label="Outfit" value={state.outfit} />
					<StateLine label="Pose" value={state.characterState} />
					<StateLine label="Band" value={state.band} />
					{state.notes && <StateLine label="Notes" value={state.notes} />}
				</div>
			</div>
		</div>
	);
}

function ReadOnlyAxis({ axis }: { axis: RuntimeChatState["visibleAxes"]["primary"] }) {
	return (
		<div>
			<div className="mb-1 flex items-center justify-between gap-3">
				<span className="text-muted-foreground text-xs">{axis.label}</span>
				<span className="font-mono text-primary text-xs">{axis.value}/100</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-secondary">
				<motion.div
					animate={{ width: `${axis.value}%` }}
					className="h-full rounded-full bg-primary/80"
					initial={false}
					transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
				/>
			</div>
			<div className="mt-1 flex justify-between gap-2 text-[0.6875rem] text-muted-foreground/75">
				<span>{axis.lowDescriptor}</span>
				<span>{axis.highDescriptor}</span>
			</div>
		</div>
	);
}

function ReadOnlyMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg bg-muted/60 p-2 ring-1 ring-foreground/10">
			<div className="flex items-center justify-between gap-2">
				<span className="text-muted-foreground text-[0.6875rem]">{label}</span>
				<span className="font-mono text-xs">{value}</span>
			</div>
			<div className="mt-1 h-1 overflow-hidden rounded-full bg-background/60">
				<motion.div
					animate={{ width: `${value}%` }}
					className="h-full rounded-full bg-primary/70"
					initial={false}
					transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
				/>
			</div>
		</div>
	);
}

function StateLine({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-lg bg-muted/45 px-2 py-1.5 ring-1 ring-foreground/10">
			<span className="shrink-0 text-muted-foreground">{label}</span>
			<span className="min-w-0 text-right text-foreground/80">{value}</span>
		</div>
	);
}

function TierScale({ activeTier }: { activeTier: string }) {
	return (
		<div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
			<p className="mb-3 font-medium text-sm">Tier scale</p>
			<div className="space-y-2">
				{RUNTIME_CHAT_TIERS.map((tier) => {
					const active = tier.id === activeTier;

					return (
						<div className="grid grid-cols-[2rem_1fr] items-start gap-2" key={tier.id}>
							<motion.div
								animate={active ? { scale: 1.08 } : { scale: 1 }}
								className={cn(
									"flex h-7 w-7 items-center justify-center rounded-full bg-muted font-mono text-[0.6875rem] ring-1 ring-foreground/10",
									active && "bg-primary text-primary-foreground ring-primary/70 glow-sm",
								)}
							>
								{tier.id}
							</motion.div>
							<div className={cn("pb-2", active ? "text-foreground" : "text-muted-foreground")}>
								<p className="font-medium text-xs">{tier.label}</p>
								<p className="text-[0.6875rem] leading-snug">{tier.description}</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function PersonaPanel({
	profile,
	personas,
	onChange,
	selectPersona,
	onSave,
	onDelete,
}: {
	profile: RuntimeChatUserProfile;
	personas: UserPersona[];
	onChange: (patch: Partial<RuntimeChatUserProfile>) => void;
	selectPersona: (persona: UserPersona) => void;
	onSave: () => void;
	onDelete: (personaId: string) => void;
}) {
	return (
		<div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="font-medium text-sm">User persona</p>
				<Button onClick={onSave} size="sm" variant="outline">
					Save
				</Button>
			</div>
				<div className="space-y-2">
					<label className="block">
						<span className="mb-1 block text-muted-foreground text-[0.6875rem]">
							Saved personas
						</span>
						<div className="flex gap-2">
							<select
								className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
								onChange={(event) => {
									const persona = personas.find((item) => item.id === event.target.value);
									if (persona) selectPersona(persona);
								}}
								value={profile.personaId ?? ""}
							>
								<option value="">Custom persona</option>
								{personas.map((persona) => (
									<option key={persona.id} value={persona.id}>
										{persona.name || persona.description.slice(0, 32) || "Unnamed persona"}
									</option>
								))}
							</select>
							<Button
								disabled={!profile.personaId}
								onClick={() => profile.personaId && onDelete(profile.personaId)}
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</Button>
						</div>
					</label>
				<LabeledInput
					label="Name"
					onCommit={(value) => onChange({ name: value })}
					value={profile.name ?? ""}
				/>
				<label className="block">
					<span className="mb-1 block text-muted-foreground text-[0.6875rem]">
						Gender
					</span>
					<select
						className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						onChange={(event) =>
							onChange({ gender: event.target.value as RuntimeChatUserGender })
						}
						value={normalizeGender(profile.gender)}
					>
						<option value="unspecified">Unspecified</option>
						<option value="male">Male</option>
						<option value="female">Female</option>
						<option value="other">Other</option>
					</select>
				</label>
				<LabeledInput
					label="Age"
					onCommit={(value) => {
						const age = Number(value);
						onChange({
							age: Number.isFinite(age) && age >= 18 ? age : undefined,
						});
					}}
					type="number"
					value={profile.age ? String(profile.age) : ""}
				/>
				<LabeledTextarea
					label="Description"
					onCommit={(value) => onChange({ description: value })}
					value={
						profile.description ??
						profile.notes ??
						[
							profile.manner,
							profile.clothing,
							profile.location,
						]
							.filter(Boolean)
							.join("; ")
					}
				/>
			</div>
		</div>
	);
}

function LabeledInput({
	label,
	value,
	onCommit,
	type = "text",
	icon,
}: {
	label: string;
	value: string;
	onCommit: (value: string) => void;
	type?: string;
	icon?: ReactNode;
}) {
	const [draft, setDraft] = useState(value);

	useEffect(() => setDraft(value), [value]);

	return (
		<label className="block">
			<span className="mb-1 flex items-center gap-1.5 text-muted-foreground text-[0.6875rem]">
				{icon}
				{label}
			</span>
			<Input
				onBlur={() => onCommit(draft.trim())}
				onChange={(event) => setDraft(event.target.value)}
				type={type}
				value={draft}
			/>
		</label>
	);
}

function LabeledTextarea({
	label,
	value,
	onCommit,
}: {
	label: string;
	value: string;
	onCommit: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);

	useEffect(() => setDraft(value), [value]);

	return (
		<label className="block">
			<span className="mb-1 block text-muted-foreground text-[0.6875rem]">
				{label}
			</span>
			<Textarea
				className="min-h-20"
				onBlur={() => onCommit(draft.trim())}
				onChange={(event) => setDraft(event.target.value)}
				value={draft}
			/>
		</label>
	);
}

function Avatar({
	character,
	name,
	size,
}: {
	character?: StoredCharacter | null;
	name: string;
	size: "sm" | "md";
}) {
	return (
		<div
			className={cn(
				"shrink-0 overflow-hidden rounded-lg bg-secondary ring-1 ring-foreground/10",
				size === "sm" ? "h-9 w-9" : "h-8 w-8",
			)}
		>
			{character?.profileImageUrl ? (
				<img
					alt={name}
					className="h-full w-full object-cover"
					src={character.profileImageUrl}
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center text-foreground/50 text-xs">
					{initials(name) || "·"}
				</div>
			)}
		</div>
	);
}

function NewConversationDialog({
	open,
	onOpenChange,
	characters,
	personas,
	savePersona,
	deletePersona,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	characters: StoredCharacter[];
	personas: UserPersona[];
	savePersona: (profile: RuntimeChatUserProfile) => Promise<UserPersona | null>;
	deletePersona: (personaId: string) => void;
	onCreated: (conversation: StoredChatConversation) => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [profile, setProfile] = useState<RuntimeChatUserProfile>(emptyProfile);
	const [busy, setBusy] = useState(false);
	const [personaBusy, setPersonaBusy] = useState(false);
	const toast = useToast();

	const create = async () => {
		if (!selectedId) return;
		setBusy(true);
		const result = await window.api.runtimeChat.create({
			characterId: selectedId,
			userProfile: profile,
		});
		setBusy(false);

		if (result.success) {
			setSelectedId(null);
			setProfile(emptyProfile());
			onCreated(result.conversation);
		} else {
			toast.push({
				tone: "error",
				title: "Create failed",
				description: result.error,
			});
		}
	};

	const handleSavePersona = async () => {
		setPersonaBusy(true);
		const persona = await savePersona(profile);
		setPersonaBusy(false);
		if (persona) {
			setProfile(profileFromPersona(persona));
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="overflow-visible sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>New chat</DialogTitle>
				</DialogHeader>
				<div className="grid max-h-[72vh] min-h-0 grid-cols-[minmax(0,1fr)_18rem] gap-4 overflow-visible max-md:grid-cols-1">
					<div className="-m-3 min-h-0 overflow-y-auto p-3">
						<div className="grid grid-cols-2 gap-2 overflow-visible max-sm:grid-cols-1">
							{characters.map((character) => {
								const name = getFullName(character.character);
								const selected = character.id === selectedId;

								return (
									<button
										className={cn(
											"flex gap-2 rounded-xl bg-card p-2 text-left ring-1 transition-all",
											selected
												? "ring-2 ring-primary/70 glow-sm"
												: "ring-foreground/10 hover:ring-foreground/25",
										)}
										key={character.id}
										onClick={() => setSelectedId(character.id)}
										type="button"
									>
										<Avatar character={character} name={name} size="sm" />
										<div className="min-w-0">
											<p className="truncate font-medium text-sm">{name}</p>
											<p className="truncate text-muted-foreground text-xs">
												{character.character.occupationLabel}
											</p>
										</div>
									</button>
								);
							})}
						</div>
					</div>
					<div className="space-y-2">
							<label className="block">
								<span className="mb-1 block text-muted-foreground text-[0.6875rem]">
									User persona
								</span>
								<div className="flex gap-2">
									<select
										className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
										onChange={(event) => {
											const persona = personas.find(
												(item) => item.id === event.target.value,
											);
											setProfile(persona ? profileFromPersona(persona) : emptyProfile());
										}}
										value={profile.personaId ?? ""}
									>
										<option value="">Custom persona</option>
										{personas.map((persona) => (
											<option key={persona.id} value={persona.id}>
												{persona.name ||
													persona.description.slice(0, 32) ||
													"Unnamed persona"}
											</option>
										))}
									</select>
									<Button
										disabled={!profile.personaId}
										onClick={() => {
											if (!profile.personaId) return;
											deletePersona(profile.personaId);
											setProfile(emptyProfile());
										}}
										size="icon"
										variant="ghost"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</label>
						<LabeledInput
							label="Name"
							onCommit={(value) =>
								setProfile((prev) => ({ ...prev, name: value }))
							}
							value={profile.name ?? ""}
						/>
						<label className="block">
							<span className="mb-1 block text-muted-foreground text-[0.6875rem]">
								Gender
							</span>
							<select
								className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
								onChange={(event) =>
									setProfile((prev) => ({
										...prev,
										gender: event.target.value as RuntimeChatUserGender,
									}))
								}
								value={normalizeGender(profile.gender)}
							>
								<option value="unspecified">Unspecified</option>
								<option value="male">Male</option>
								<option value="female">Female</option>
								<option value="other">Other</option>
							</select>
						</label>
						<LabeledInput
							label="Age"
							onCommit={(value) => {
								const age = Number(value);
								setProfile((prev) => ({
									...prev,
									age: Number.isFinite(age) && age >= 18 ? age : undefined,
								}));
							}}
							type="number"
							value={profile.age ? String(profile.age) : ""}
						/>
						<LabeledTextarea
							label="Description"
							onCommit={(value) =>
								setProfile((prev) => ({ ...prev, description: value }))
							}
							value={profile.description ?? profile.notes ?? ""}
						/>
						<Button
							className="w-full"
							disabled={personaBusy}
							onClick={() => void handleSavePersona()}
							size="sm"
							variant="outline"
						>
							{personaBusy ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Plus className="h-3.5 w-3.5" />
							)}
							Save as persona
						</Button>
					</div>
				</div>
				<DialogFooter>
					<DialogClose render={<Button size="sm" variant="outline" />}>
						Cancel
					</DialogClose>
					<Button disabled={!selectedId || busy} onClick={() => void create()} size="sm">
						{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
