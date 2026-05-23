import {
	ArrowLeft,
	Bot,
	Loader2,
	RefreshCw,
	Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatMessage } from "@/components/chat/chat-message";
import { AutopilotPill } from "@/components/chrome/autopilot-pill";
import { ChatDock } from "@/components/chrome/chat-dock";
import { ChatDockSlot, SubHeaderSlot } from "@/components/chrome/chrome-slots";
import { DifficultyPill } from "@/components/chrome/difficulty-pill";
import { ImageModelPill } from "@/components/chrome/image-model-pill";
import { SubHeader } from "@/components/chrome/sub-header";
import { ProfileReview } from "@/components/profile-review";
import { Button } from "@/components/ui/button";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useChatAutopilot } from "@/hooks/use-chat-autopilot";
import { consumeReplaySeed } from "@/lib/gathering-replay";
import { navigate } from "@/lib/router";
import {
	type CharacterProfilePreview,
	type CharacterStepId,
	type ConfirmedProfile,
	getFullName,
	getStoredImageModel,
	type ImageModel,
	type Measurements,
	type StoredCharacter,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "reviewing" | "profile-review" | "regenerating" | "done";
type GatheringSource = "review-chat" | "stored";

/** Steps the user can opt-in to regenerating. `scenes` is a meta-step. */
type RegenStep = CharacterStepId | "scenes";

const STEP_LABELS: Record<RegenStep, { title: string; hint: string }> = {
	visual: {
		title: "Visual",
		hint: "Appearance, image prompts, OurDream fields",
	},
	scenario: {
		title: "Scenario",
		hint: "Opening scenario text the chat starts in",
	},
	personality: {
		title: "Personality",
		hint: "additionalPersonalityDetails behavioral spec",
	},
	extras: {
		title: "Background",
		hint: "extraDetails lore and biography",
	},
	light: {
		title: "Mood & difficulty axes",
		hint: "moodAxes + difficulty + intimacy profiles",
	},
	scenes: {
		title: "Scenes",
		hint: "Rewrites all scene image prompts (same scene names)",
	},
};

const ORDERED_STEPS: RegenStep[] = [
	"visual",
	"scenario",
	"personality",
	"extras",
	"light",
	"scenes",
];

function summarizeChat(
	messages: ReturnType<typeof useAgentChat>["messages"],
): string {
	const lines: string[] = [];
	for (const msg of messages) {
		const role = msg.role === "user" ? "User" : "Assistant";
		for (const part of msg.parts) {
			if (part.type === "text" && part.text.trim()) {
				lines.push(`${role}: ${part.text.trim()}`);
			} else if (part.type !== "text") {
				const toolPart = part;
				const question =
					(toolPart.input as { question?: string }).question ?? "";
				const output = toolPart.output ? String(toolPart.output) : "";
				lines.push(`Assistant asked: ${question}`);
				if (output) lines.push(`User answered: ${output}`);
			}
		}
	}
	return lines.join("\n");
}

export function RegeneratePage({ id }: { id: string }) {
	const [data, setData] = useState<StoredCharacter | null>(null);
	const [notFound, setNotFound] = useState(false);
	const [phase, setPhase] = useState<Phase>("reviewing");
	const [generating, setGenerating] = useState(false);
	const [inferredProfile, setInferredProfile] = useState<
		CharacterProfilePreview | undefined
	>();
	const [profileLoading, setProfileLoading] = useState(false);
	const [profileError, setProfileError] = useState<string | undefined>();
	const [imageModel, setImageModel] = useState<ImageModel | null>(null);
	const [gatheringSource, setGatheringSource] =
		useState<GatheringSource>("review-chat");
	const [selectedSteps, setSelectedSteps] = useState<Set<RegenStep>>(
		() => new Set<RegenStep>(["visual"]),
	);

	const reviewChat = useAgentChat();
	const hasStarted = useRef(false);
	const [autopilot, setAutopilot] = useState(false);

	useChatAutopilot({
		enabled: autopilot,
		messages: reviewChat.messages,
		addToolOutput: reviewChat.addToolOutput,
	});

	useEffect(() => {
		window.api.characters.get(id).then((stored) => {
			if (stored) {
				setData(stored);
				setImageModel(getStoredImageModel(stored));
			} else {
				setNotFound(true);
			}
		});
	}, [id]);

	useEffect(() => {
		if (!data || hasStarted.current) return;
		hasStarted.current = true;
		// If we arrived via an in-place rewind from CharacterDetail, replay the
		// truncated transcript into the review chat so the user can resume from
		// the chosen point. Otherwise start fresh with the standard prompt.
		const seed = consumeReplaySeed();
		if (
			seed &&
			seed.kind === "rewind-regenerate" &&
			seed.characterId === data.id
		) {
			void reviewChat.seedReplay({
				payload: {
					flow: "gather-regenerate",
					character: data,
					initialUserMessage: seed.newMessage,
				},
				truncatedMessages: seed.truncatedMessages,
				newMessage: seed.newMessage,
			});
			return;
		}
		void reviewChat.start({
			flow: "gather-regenerate",
			character: data,
			initialUserMessage: `I want to regenerate the character "${getFullName(data.character)}". Show me what areas I can change.`,
		});
	}, [data, reviewChat]);

	const gatheringSummary = useMemo(() => {
		// Always merge the stored gathering (the source of truth) with anything
		// new said in the review chat — that way regenerations stay grounded in
		// the original character while picking up the latest tweaks.
		const stored = data?.gatheringSummary ?? "";
		const reviewLive =
			gatheringSource === "review-chat"
				? (reviewChat.finalSummary ?? summarizeChat(reviewChat.messages))
				: "";
		if (!stored) return reviewLive;
		if (!reviewLive) return stored;
		return `${stored}\n\n---\n\n[Regeneration review chat]\n${reviewLive}`;
	}, [
		gatheringSource,
		data?.gatheringSummary,
		reviewChat.finalSummary,
		reviewChat.messages,
	]);

	const toggleStep = useCallback((step: RegenStep) => {
		setSelectedSteps((prev) => {
			const next = new Set(prev);
			if (next.has(step)) next.delete(step);
			else next.add(step);
			return next;
		});
	}, []);

	const visualSelected = selectedSteps.has("visual");
	const hasAnySelection = selectedSteps.size > 0;

	const runRegeneration = useCallback(
		async ({
			measurements,
			profile,
		}: {
			measurements?: Measurements;
			profile?: ConfirmedProfile;
		}) => {
			if (!data) return;
			setPhase("regenerating");
			setGenerating(true);
			try {
				const effectiveImageModel = imageModel ?? getStoredImageModel(data);
				const characterSteps = ORDERED_STEPS.filter(
					(s): s is CharacterStepId =>
						s !== "scenes" && selectedSteps.has(s),
				);
				const regenerateScenes = selectedSteps.has("scenes");

				// Only append the review chat to the stored transcript when the user
				// actually used it as input — keeps the transcript clean on the
				// "Original gathering only" path.
				const appendMessages =
					gatheringSource === "review-chat" &&
					reviewChat.messages.length > 1
						? reviewChat.messages
						: undefined;

				const res = await window.api.characters.regeneratePartial({
					id: data.id,
					steps: characterSteps,
					regenerateScenes,
					gatheringSummary,
					gatheringMessagesAppend: appendMessages,
					confirmedMeasurements: measurements,
					confirmedProfile: profile,
					imageModel: effectiveImageModel,
				});
				if (!res.success) {
					throw new Error(res.error);
				}
				setPhase("done");
				navigate(`/character/${res.stored.id}`);
			} catch (err) {
				console.error("Regeneration failed:", err);
				setPhase(visualSelected ? "profile-review" : "reviewing");
			} finally {
				setGenerating(false);
			}
		},
		[
			data,
			imageModel,
			selectedSteps,
			gatheringSource,
			reviewChat.messages,
			gatheringSummary,
			visualSelected,
		],
	);

	const handleConfirm = useCallback(async () => {
		if (!data || !hasAnySelection) return;
		setProfileError(undefined);

		// Visual regen needs measurements + a confirmed profile (they steer the
		// image prompts). Other steps can run straight from the gathering.
		if (visualSelected) {
			setProfileLoading(true);
			setInferredProfile(undefined);
			setPhase("profile-review");
			try {
				const res = await window.api.generate.inferProfile({
					gatheringSummary,
					difficulty: data.difficulty,
				});
				if (res.success) {
					setInferredProfile(res.profile);
				} else {
					setProfileError(res.error);
				}
			} catch (err) {
				console.error("[inferProfile] threw:", err);
				setProfileError(err instanceof Error ? err.message : String(err));
			} finally {
				setProfileLoading(false);
			}
			return;
		}
		await runRegeneration({});
	}, [data, hasAnySelection, visualSelected, gatheringSummary, runRegeneration]);

	const handleConfirmProfile = useCallback(
		async ({
			measurements,
			profile,
		}: {
			measurements: Measurements;
			profile: ConfirmedProfile;
		}) => {
			await runRegeneration({ measurements, profile });
		},
		[runRegeneration],
	);

	const handleBackToReview = useCallback(() => {
		setPhase("reviewing");
		setInferredProfile(undefined);
		setProfileError(undefined);
	}, []);

	const isStreaming =
		reviewChat.status === "streaming" || reviewChat.status === "submitted";

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
						<ArrowLeft className="mr-2 h-4 w-4" />
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

	const subtitle =
		phase === "reviewing"
			? "Choose what to change"
			: phase === "profile-review"
				? "Review profile and measurements"
				: phase === "regenerating"
					? "Regenerating character…"
					: "Complete";

	const isProfileReview = phase === "profile-review";

	return (
		<>
			<SubHeaderSlot>
				<SubHeader
					actions={
						<>
							<DifficultyPill readOnly value={data.difficulty} />
							{imageModel && (
								<ImageModelPill
									onChange={
										phase === "reviewing"
											? (next) => setImageModel(next)
											: undefined
									}
									readOnly={phase !== "reviewing"}
									value={imageModel}
								/>
							)}
							<a href={`#/character/${id}`}>
								<Button
									className="text-muted-foreground"
									size="icon-sm"
									variant="ghost"
								>
									<ArrowLeft className="h-3.5 w-3.5" />
									<span className="sr-only">Back to character</span>
								</Button>
							</a>
						</>
					}
					icon={<RefreshCw className="h-4 w-4" />}
					subtitle={subtitle}
					subtitleKey={phase}
					title={`Regenerate ${getFullName(data.character)}`}
				/>
			</SubHeaderSlot>

			{!generating && !isProfileReview && (
				<ChatDockSlot>
					<ChatDock
						disabled={isStreaming || phase !== "reviewing"}
						extraAbove={
							<RegenPanel
								data={data}
								source={gatheringSource}
								onSourceChange={setGatheringSource}
								selectedSteps={selectedSteps}
								onToggleStep={toggleStep}
								onConfirm={() => void handleConfirm()}
								confirmDisabled={
									generating ||
									isStreaming ||
									!hasAnySelection ||
									(gatheringSource === "review-chat" &&
										reviewChat.messages.length <= 1)
								}
								autopilot={autopilot}
								onAutopilotToggle={setAutopilot}
								autopilotDisabled={generating || phase !== "reviewing"}
							/>
						}
						onSend={(text) => void reviewChat.sendMessage({ text })}
						placeholder="Describe what you want to change…"
					/>
				</ChatDockSlot>
			)}

			<ChatContainer>
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
					{reviewChat.error && (
						<div className="animate-message-in rounded-xl bg-destructive/10 p-3 text-destructive text-sm ring-1 ring-destructive/30">
							<p className="font-medium">Chat error</p>
							<p className="mt-1 text-destructive/90 text-xs leading-relaxed whitespace-pre-wrap">
								{reviewChat.error}
							</p>
						</div>
					)}
					{reviewChat.messages.map((msg) => (
						<ChatMessage
							addToolOutput={reviewChat.addToolOutput}
							key={msg.id}
							message={msg}
							onRewind={reviewChat.rewindTo}
						/>
					))}

					{isProfileReview && (
						<ProfileReview
							initial={inferredProfile}
							loading={profileLoading}
							error={profileError}
							difficulty={data.difficulty}
							gatheringSummary={gatheringSummary}
							onConfirm={handleConfirmProfile}
							onBack={handleBackToReview}
							backLabel="Back to chat"
							confirmLabel="Confirm and regenerate"
						/>
					)}

					{reviewChat.status === "submitted" && (
						<div className="flex animate-message-in gap-3">
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
								<Bot className="h-3.5 w-3.5" />
							</div>
							<div className="glow-xs flex items-center gap-2.5 rounded-xl bg-muted px-4 py-3 ring-1 ring-primary/20">
								<div className="flex items-center gap-1">
									<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
									<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
									<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
								</div>
								<span className="text-muted-foreground text-xs">Thinking…</span>
							</div>
						</div>
					)}

					{generating && (
						<div className="flex animate-message-in items-center justify-center gap-3 py-10">
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
							</div>
							<div className="flex flex-col gap-1">
								<span className="font-medium text-foreground text-sm">
									Regenerating character and scenes…
								</span>
								<div className="h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
									<div className="h-full w-full animate-shimmer rounded-full" />
								</div>
							</div>
						</div>
					)}
				</div>
			</ChatContainer>
		</>
	);
}

interface RegenPanelProps {
	data: StoredCharacter;
	source: GatheringSource;
	onSourceChange: (next: GatheringSource) => void;
	selectedSteps: Set<RegenStep>;
	onToggleStep: (step: RegenStep) => void;
	onConfirm: () => void;
	confirmDisabled: boolean;
	autopilot: boolean;
	onAutopilotToggle: (next: boolean) => void;
	autopilotDisabled: boolean;
}

function RegenPanel({
	data,
	source,
	onSourceChange,
	selectedSteps,
	onToggleStep,
	onConfirm,
	confirmDisabled,
	autopilot,
	onAutopilotToggle,
	autopilotDisabled,
}: RegenPanelProps) {
	const hasOriginalGathering = !!data.gatheringSummary;
	return (
		<div className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-card/40 p-3">
			{hasOriginalGathering && (
				<section className="flex flex-col gap-1.5">
					<span className="eyebrow text-foreground/55">Gathering source</span>
					<div className="flex flex-wrap gap-1.5">
						<SourcePill
							active={source === "stored"}
							label="Original gathering only"
							onClick={() => onSourceChange("stored")}
						/>
						<SourcePill
							active={source === "review-chat"}
							label="Original + this review chat"
							onClick={() => onSourceChange("review-chat")}
						/>
					</div>
				</section>
			)}

			<section className="flex flex-col gap-1.5">
				<span className="eyebrow text-foreground/55">
					What to regenerate
				</span>
				<div className="flex flex-wrap gap-1.5">
					{ORDERED_STEPS.map((step) => {
						const meta = STEP_LABELS[step];
						return (
							<StepPill
								active={selectedSteps.has(step)}
								hint={meta.hint}
								key={step}
								label={meta.title}
								onClick={() => onToggleStep(step)}
							/>
						);
					})}
				</div>
			</section>

			<div className="flex items-center gap-2 pt-1">
				<Button
					className="glow-lg flex-1"
					disabled={confirmDisabled}
					onClick={onConfirm}
				>
					<RefreshCw className="mr-2 h-4 w-4" />
					Confirm and regenerate
				</Button>
				<AutopilotPill
					disabled={autopilotDisabled}
					enabled={autopilot}
					onToggle={onAutopilotToggle}
				/>
			</div>
		</div>
	);
}

function SourcePill({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				"rounded-full px-3 py-1.5 font-medium text-[0.8125rem] outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
				active
					? "bg-primary/15 text-foreground ring-1 ring-primary/40 glow-xs"
					: "bg-secondary text-foreground/70 ring-1 ring-foreground/10 hover:text-foreground hover:ring-foreground/20",
			)}
			onClick={onClick}
			type="button"
		>
			{label}
		</button>
	);
}

function StepPill({
	active,
	label,
	hint,
	onClick,
}: {
	active: boolean;
	label: string;
	hint: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				"group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
				active
					? "bg-primary/15 text-foreground ring-1 ring-primary/40 glow-xs"
					: "bg-secondary text-foreground/70 ring-1 ring-foreground/10 hover:text-foreground hover:ring-foreground/20",
			)}
			onClick={onClick}
			title={hint}
			type="button"
		>
			<span
				aria-hidden
				className={cn(
					"flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-colors",
					active
						? "border-primary/60 bg-primary/30"
						: "border-foreground/25 bg-transparent",
				)}
			>
				{active && (
					<span className="h-1.5 w-1.5 rounded-[1px] bg-foreground" />
				)}
			</span>
			<span className="font-medium">{label}</span>
		</button>
	);
}
