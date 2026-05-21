import { serializeTranscriptForReplay } from "@shared/chat-replay";
import type { GenerateProgressEvent } from "@shared/generate";
import { ArrowLeft, RotateCcw, Users, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatMessage } from "@/components/chat/chat-message";
import { CharacterPicker } from "@/components/character-picker";
import { AutopilotPill } from "@/components/chrome/autopilot-pill";
import { ChatDock } from "@/components/chrome/chat-dock";
import { ChatDockSlot, SubHeaderSlot } from "@/components/chrome/chrome-slots";
import { CreateToolbar } from "@/components/chrome/create-toolbar";
import { MessageLengthPill } from "@/components/chrome/message-length-pill";
import {
	GenerationSteps,
	type StepState,
} from "@/components/create/generation-steps";
import { Button } from "@/components/ui/button";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useChatAutopilot } from "@/hooks/use-chat-autopilot";
import { useSettings } from "@/hooks/use-settings";
import { navigate } from "@/lib/router";
import {
	DEFAULT_MESSAGE_LENGTH,
	getFullName,
	MAX_GROUP_CHAT_CHARACTERS,
	MIN_GROUP_CHAT_CHARACTERS,
	type MessageLength,
	type StoredCharacter,
} from "@/lib/types";

type Phase = "selecting" | "gathering" | "generating" | "done";

const STEPPER_STEPS = [
	{ id: "characters", label: "Characters" },
	{ id: "brief", label: "Brief" },
];

function initialGenSteps(): StepState[] {
	return [{ id: "group-chat", label: "Generating group chat", status: "idle" }];
}

const summarizeChat = serializeTranscriptForReplay;

export function CreateGroupChatPage() {
	const [phase, setPhase] = useState<Phase>("selecting");
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [charactersLoaded, setCharactersLoaded] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [briefPrompt, setBriefPrompt] = useState("");
	const [messageLength, setMessageLength] = useState<MessageLength>(
		DEFAULT_MESSAGE_LENGTH,
	);
	const [genSteps, setGenSteps] = useState<StepState[]>(initialGenSteps);
	const [runId, setRunId] = useState<string | null>(null);
	const [autopilot, setAutopilot] = useState(false);
	const [generationError, setGenerationError] = useState<string | null>(null);

	const chat = useAgentChat();
	const { settings } = useSettings();
	const superAdmin = settings?.superAdmin ?? false;

	useChatAutopilot({
		enabled: autopilot,
		messages: chat.messages,
		addToolOutput: chat.addToolOutput,
	});

	useEffect(() => {
		void window.api.characters.list().then((list) => {
			setCharacters(list);
			setCharactersLoaded(true);
		});
	}, []);

	useEffect(() => {
		if (settings?.lastMessageLength) {
			setMessageLength(settings.lastMessageLength);
		}
	}, [settings]);

	useEffect(() => {
		const off = window.api.generate.onProgress((ev: GenerateProgressEvent) => {
			if (ev.kind !== "group-chat") return;
			if (runId && ev.runId !== runId) return;
			setGenSteps((prev) =>
				prev.map((s) =>
					s.id === ev.step
						? {
								...s,
								status:
									ev.status === "started"
										? "running"
										: ev.status === "succeeded"
											? "succeeded"
											: ev.status === "refusal-detected"
												? "refusal-detected"
												: "failed",
								error: ev.error,
								usage: ev.usage ?? s.usage,
								adminOverrideApplied:
									ev.adminOverrideApplied ?? s.adminOverrideApplied,
							}
						: s,
				),
			);
		});
		return () => off();
	}, [runId]);

	const selectedCharacters = useMemo(
		() => characters.filter((c) => selectedIds.includes(c.id)),
		[characters, selectedIds],
	);

	const handleToggle = useCallback((id: string) => {
		setSelectedIds((prev) => {
			if (prev.includes(id)) return prev.filter((x) => x !== id);
			if (prev.length >= MAX_GROUP_CHAT_CHARACTERS) return prev;
			return [...prev, id];
		});
	}, []);

	const handleStartGathering = useCallback(async () => {
		if (selectedCharacters.length < MIN_GROUP_CHAT_CHARACTERS) return;
		const trimmedBrief = briefPrompt.trim();
		const names = selectedCharacters
			.map((c) => getFullName(c.character))
			.join(", ");
		const initialUserMessage = trimmedBrief
			? trimmedBrief
			: `Let's design a group chat featuring ${names}. I don't have a specific brief in mind yet — ask me what you need.`;
		setPhase("gathering");
		await chat.start({
			flow: "gather-group-chat",
			characters: selectedCharacters.map((c) => c.character),
			initialUserMessage,
		});
	}, [chat, selectedCharacters, briefPrompt]);

	const gatheringSummary = useMemo(
		() => chat.finalSummary ?? summarizeChat(chat.messages),
		[chat.finalSummary, chat.messages],
	);

	const handleGenerate = useCallback(async () => {
		if (selectedCharacters.length < MIN_GROUP_CHAT_CHARACTERS) return;
		const id = `group-${Date.now()}`;
		setRunId(id);
		setGenSteps(initialGenSteps());
		setGenerationError(null);
		setPhase("generating");
		const result = await window.api.generate.groupChat({
			runId: id,
			characterIds: selectedIds,
			gatheringSummary,
			messageLength,
			gatheringMessages: chat.messages,
		});
		if (result.success) {
			setPhase("done");
			navigate(`/group-chats/${result.stored.id}`);
		} else {
			setGenerationError(result.error);
			setPhase("gathering");
		}
	}, [
		selectedCharacters,
		selectedIds,
		gatheringSummary,
		messageLength,
		chat.messages,
	]);

	const handleRetry = useCallback(() => {
		void handleGenerate();
	}, [handleGenerate]);

	const handleStartOver = useCallback(() => {
		void chat.stop();
		chat.setMessages([]);
		setSelectedIds([]);
		setBriefPrompt("");
		setPhase("selecting");
		setGenSteps(initialGenSteps());
		setRunId(null);
		setGenerationError(null);
	}, [chat]);

	const handleBackToSelection = useCallback(() => {
		void chat.stop();
		chat.setMessages([]);
		setPhase("selecting");
	}, [chat]);

	const isStreaming =
		chat.status === "streaming" || chat.status === "submitted";
	const isGenerating = phase === "generating";
	const isDone = phase === "done";

	const showGenerateButton =
		phase === "gathering" && chat.messages.length > 1 && !isStreaming;
	const showAutopilotToggle =
		phase === "gathering" && chat.messages.length > 0;
	const showGenerationSteps =
		phase === "generating" ||
		(phase === "gathering" && genSteps.some((s) => s.status !== "idle"));

	const activeStepIndex = phase === "selecting" ? 0 : 1;
	const doneCount = isDone ? 2 : phase === "selecting" ? 0 : 1;

	const subtitle =
		phase === "selecting"
			? "Pick the cast"
			: phase === "gathering"
				? `Brief · ${selectedCharacters.length} characters`
				: phase === "generating"
					? "Drafting group chat…"
					: "Complete";

	const canContinue =
		selectedIds.length >= MIN_GROUP_CHAT_CHARACTERS &&
		selectedIds.length <= MAX_GROUP_CHAT_CHARACTERS;
	const canSendChat = phase === "gathering" && !isStreaming;
	const hasExtraAbove =
		showGenerationSteps || showGenerateButton || showAutopilotToggle;

	return (
		<>
			<SubHeaderSlot>
				<CreateToolbar
					activeIndex={activeStepIndex}
					config={
						<MessageLengthPill
							onChange={setMessageLength}
							readOnly={phase !== "selecting" && phase !== "gathering"}
							value={messageLength}
						/>
					}
					doneCount={doneCount}
					mark="Group Chat"
					reset={
						(selectedIds.length > 0 || chat.messages.length > 0) &&
						!isGenerating ? (
							<Button
								className="text-muted-foreground hover:text-destructive"
								onClick={handleStartOver}
								size="sm"
								variant="outline"
							>
								<RotateCcw className="h-3.5 w-3.5" />
								Reset
							</Button>
						) : undefined
					}
					status={subtitle}
					statusKey={phase}
					steps={STEPPER_STEPS}
				/>
			</SubHeaderSlot>

			{(phase === "gathering" || phase === "generating") && (
				<ChatDockSlot>
					<ChatDock
						disabled={!canSendChat || isGenerating || isDone}
						extraAbove={
							hasExtraAbove ? (
								<div className="space-y-3">
									{showGenerationSteps && (
										<GenerationSteps
											onRetry={handleRetry}
											steps={genSteps}
											superAdmin={superAdmin}
											title="Group chat"
										/>
									)}
									{(showGenerateButton || showAutopilotToggle) && (
										<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
											{showGenerateButton && (
												<span className="inline-flex items-center gap-1.5 eyebrow text-foreground/55">
													<span
														aria-hidden
														className="h-1.5 w-1.5 rounded-full bg-primary glow-xs"
													/>
													Ready ·{" "}
													<span className="tabular-nums text-foreground/75">
														{String(chat.messages.length).padStart(2, "0")}
													</span>{" "}
													turns
												</span>
											)}
											<div className="ml-auto flex items-center gap-2">
												{showGenerateButton && (
													<Button
														className="glow-lg"
														onClick={handleGenerate}
													>
														<Wand2 className="h-4 w-4" />
														Generate group chat
													</Button>
												)}
												{showAutopilotToggle && (
													<AutopilotPill
														disabled={isGenerating || isDone}
														enabled={autopilot}
														onToggle={setAutopilot}
													/>
												)}
											</div>
										</div>
									)}
								</div>
							) : undefined
						}
						onSend={(text) => void chat.sendMessage({ text })}
						placeholder="Describe the scene, the dynamic, or refine your answer…"
					/>
				</ChatDockSlot>
			)}

			<ChatContainer autoScroll={phase !== "selecting"}>
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
					{phase === "selecting" && (
						<div className="flex flex-col gap-8 pt-12 pb-8">
							<div className="flex items-baseline gap-3">
								<span
									aria-hidden
									className="display-figure text-[0.875rem] text-foreground/35 leading-none"
								>
									01
								</span>
								<span className="eyebrow text-foreground/55">
									Brief · Cast
								</span>
							</div>
							<h2 className="-tracking-[0.025em] max-w-[22ch] font-semibold text-[2.5rem] text-foreground leading-[1.02] sm:text-[3rem]">
								Who's in the
								<br />
								<span className="text-primary">room?</span>
							</h2>
							<p className="max-w-[58ch] text-[0.9375rem] text-muted-foreground leading-relaxed">
								Pick {MIN_GROUP_CHAT_CHARACTERS}–{MAX_GROUP_CHAT_CHARACTERS}{" "}
								characters from your library. We'll feed their full profiles
								into the brief — you don't need to re-describe them.
							</p>

							{charactersLoaded && (
								<CharacterPicker
									characters={characters}
									onToggle={handleToggle}
									selectedIds={selectedIds}
								/>
							)}

							<div className="flex flex-col gap-2">
								<label
									className="eyebrow text-foreground/55"
									htmlFor="group-chat-brief"
								>
									Brief
									<span className="ml-1 text-foreground/35 normal-case tracking-normal">
										(optional)
									</span>
								</label>
								<textarea
									className="min-h-[7rem] resize-y rounded-2xl bg-card p-4 text-[0.9375rem] text-foreground leading-relaxed outline-none ring-1 ring-foreground/10 transition-all duration-200 placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/50"
									id="group-chat-brief"
									onChange={(e) => setBriefPrompt(e.target.value)}
									placeholder="Add anything you already know about the scene — setting, time, why these characters are together, the central beat, the tone, your POV, prior history… The AI will use this as the starting context and only ask follow-ups about what's still ambiguous."
									rows={5}
									value={briefPrompt}
								/>
							</div>

							<div className="flex items-center justify-end gap-3">
								<Button
									className={
										canContinue ? "glow-md hover:glow-lg" : undefined
									}
									disabled={!canContinue}
									onClick={handleStartGathering}
									size="default"
								>
									<Users className="h-4 w-4" />
									Continue with{" "}
									{selectedIds.length > 0 ? selectedIds.length : "…"}{" "}
									characters
								</Button>
							</div>
						</div>
					)}

					{(phase === "gathering" || phase === "generating") && (
						<>
							<div className="animate-message-in flex flex-col gap-5 pt-4 pb-2">
								<div className="flex items-baseline gap-3">
									<span
										aria-hidden
										className="display-figure text-[0.875rem] text-foreground/35 leading-none"
									>
										02
									</span>
									<span className="eyebrow text-foreground/55">
										Brief · Group Chat
									</span>
									<span className="h-px flex-1 bg-foreground/10" />
								</div>
								<div className="flex flex-col gap-3">
									<div className="eyebrow text-foreground/40">Cast</div>
									<div className="flex flex-wrap items-center gap-2">
										{selectedCharacters.map((c) => (
											<span
												className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-foreground/85 text-xs ring-1 ring-foreground/10"
												key={c.id}
											>
												{getFullName(c.character)}
											</span>
										))}
										<button
											className="inline-flex items-center gap-1 rounded-full bg-transparent px-2 py-1 text-foreground/55 text-xs underline-offset-2 hover:text-foreground hover:underline"
											onClick={handleBackToSelection}
											type="button"
										>
											<ArrowLeft className="h-3 w-3" />
											Change cast
										</button>
									</div>
								</div>
							</div>
							{generationError && (
								<div className="animate-message-in rounded-xl bg-destructive/10 p-3 text-destructive text-sm ring-1 ring-destructive/30">
									<p className="font-medium">Generation error</p>
									<p className="mt-1 text-destructive/90 text-xs leading-relaxed whitespace-pre-wrap">
										{generationError}
									</p>
								</div>
							)}
							{chat.error && (
								<div className="animate-message-in rounded-xl bg-destructive/10 p-3 text-destructive text-sm ring-1 ring-destructive/30">
									<p className="font-medium">Chat error</p>
									<p className="mt-1 text-destructive/90 text-xs leading-relaxed whitespace-pre-wrap">
										{chat.error}
									</p>
								</div>
							)}
							{chat.messages.map((msg, idx) => (
								<ChatMessage
									addToolOutput={chat.addToolOutput}
									key={msg.id}
									message={msg}
									noPriorUserTurn={
										msg.role === "assistant" &&
										!chat.messages
											.slice(0, idx)
											.some((m) => m.role === "user")
									}
									onDelete={
										phase === "gathering" ? chat.deleteMessage : undefined
									}
									onEdit={
										phase === "gathering" ? chat.editAndResend : undefined
									}
									onRewind={
										phase === "gathering" ? chat.rewindTo : undefined
									}
								/>
							))}
							{chat.status === "submitted" && (
								<div className="flex animate-message-in items-center gap-3 pl-1 text-foreground/55">
									<div className="flex items-center gap-1">
										<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
										<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
										<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
									</div>
									<span className="eyebrow">Thinking</span>
								</div>
							)}
						</>
					)}
				</div>
			</ChatContainer>
		</>
	);
}
