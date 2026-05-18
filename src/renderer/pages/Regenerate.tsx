import {
	ArrowLeft,
	Bot,
	History,
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
import { navigate } from "@/lib/router";
import {
	type CharacterProfilePreview,
	type ConfirmedProfile,
	getFullName,
	getStoredImageModel,
	type ImageModel,
	type Measurements,
	type StoredCharacter,
} from "@/lib/types";

type Phase = "reviewing" | "profile-review" | "regenerating" | "done";
type GatheringSource = "review-chat" | "stored";

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
		void reviewChat.start({
			flow: "gather-regenerate",
			character: data,
			initialUserMessage: `I want to regenerate the character "${getFullName(data.character)}". Show me what areas I can change.`,
		});
	}, [data, reviewChat]);

	const gatheringSummary = useMemo(() => {
		if (gatheringSource === "stored" && data?.gatheringSummary) {
			return data.gatheringSummary;
		}
		return reviewChat.finalSummary ?? summarizeChat(reviewChat.messages);
	}, [
		gatheringSource,
		data?.gatheringSummary,
		reviewChat.finalSummary,
		reviewChat.messages,
	]);

	const handleStartProfileReview = useCallback(
		async (source: GatheringSource = "review-chat") => {
			if (!data) return;
			setProfileError(undefined);
			setProfileLoading(true);
			setInferredProfile(undefined);
			setGatheringSource(source);
			setPhase("profile-review");

			const effectiveSummary =
				source === "stored" && data.gatheringSummary
					? data.gatheringSummary
					: (reviewChat.finalSummary ?? summarizeChat(reviewChat.messages));

			try {
				if (typeof window.api.generate.inferProfile !== "function") {
					setProfileError(
						"Profile inference is unavailable. Restart the app so the preload bridge picks up the latest changes.",
					);
					return;
				}
				const res = await window.api.generate.inferProfile({
					gatheringSummary: effectiveSummary,
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
		},
		[data, reviewChat.finalSummary, reviewChat.messages],
	);

	const handleConfirmRegenerate = useCallback(
		async ({
			measurements,
			profile,
		}: {
			measurements: Measurements;
			profile: ConfirmedProfile;
		}) => {
			if (!data) return;
			setPhase("regenerating");
			setGenerating(true);
			try {
				const runId = `regen-${Date.now()}`;
				const effectiveImageModel = imageModel ?? getStoredImageModel(data);

				if (gatheringSource === "stored") {
					const visualResult = await window.api.characters.regenerateVisualOnly(
						{
							id: data.id,
							gatheringSummary,
							confirmedMeasurements: measurements,
							confirmedProfile: profile,
							imageModel: effectiveImageModel,
						},
					);
					if (!visualResult.success) {
						throw new Error(visualResult.error);
					}
					const sceneResult = await window.api.generate.scenes({
						runId: `${runId}-scenes`,
						character: visualResult.stored.character,
						gatheringSummary,
						imageModel: effectiveImageModel,
					});
					if (!sceneResult.success) {
						throw new Error(sceneResult.error);
					}
					await window.api.characters.updateScenes(
						visualResult.stored.id,
						sceneResult.scenes,
					);
					setPhase("done");
					navigate(`/character/${visualResult.stored.id}`);
					return;
				}

				const charResult = await window.api.generate.characterAll({
					runId,
					difficulty: data.difficulty,
					gatheringSummary,
					imageModel: effectiveImageModel,
					confirmedMeasurements: measurements,
					confirmedProfile: profile,
				});
				if (!charResult.success) {
					throw new Error(charResult.error);
				}
				const sceneResult = await window.api.generate.scenes({
					runId: `${runId}-scenes`,
					character: charResult.stored.character,
					gatheringSummary,
					imageModel: effectiveImageModel,
				});
				if (!sceneResult.success) {
					throw new Error(sceneResult.error);
				}
				await window.api.characters.updateScenes(
					charResult.stored.id,
					sceneResult.scenes,
				);
				await window.api.characters.updateImageModel(
					charResult.stored.id,
					effectiveImageModel,
				);
				setPhase("done");
				navigate(`/character/${charResult.stored.id}`);
			} catch (err) {
				console.error("Regeneration failed:", err);
				setPhase("profile-review");
			} finally {
				setGenerating(false);
			}
		},
		[data, gatheringSummary, imageModel, gatheringSource],
	);

	const handleBackToReview = useCallback(() => {
		setPhase("reviewing");
		setInferredProfile(undefined);
		setProfileError(undefined);
		setGatheringSource("review-chat");
	}, []);

	const isStreaming =
		reviewChat.status === "streaming" || reviewChat.status === "submitted";
	const showRegenerate =
		phase === "reviewing" && reviewChat.messages.length > 1 && !isStreaming;

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
							<div className="flex flex-col gap-2">
								{data.gatheringSummary &&
									phase === "reviewing" &&
									!isStreaming && (
										<div className="flex flex-col gap-1">
											<Button
												className="w-full"
												disabled={generating}
												onClick={() => void handleStartProfileReview("stored")}
												variant="outline"
											>
												<History className="mr-2 h-4 w-4" />
												Regenerate visual and scenes from original gathering
											</Button>
											<p className="px-1 text-[11px] text-muted-foreground leading-snug">
												Re-runs only the appearance and scene prompts using the
												saved gathering. Personality, scenario, mood axes, and
												lore stay unchanged.
											</p>
										</div>
									)}
								<div className="flex items-center gap-2">
									{showRegenerate && (
										<Button
											className="glow-lg flex-1"
											disabled={generating}
											onClick={() =>
												void handleStartProfileReview("review-chat")
											}
										>
											<RefreshCw className="mr-2 h-4 w-4" />
											Review profile and regenerate
										</Button>
									)}
									<div className={showRegenerate ? "" : "ml-auto"}>
										<AutopilotPill
											disabled={generating || phase !== "reviewing"}
											enabled={autopilot}
											onToggle={setAutopilot}
										/>
									</div>
								</div>
							</div>
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
						/>
					))}

					{isProfileReview && (
						<ProfileReview
							initial={inferredProfile}
							loading={profileLoading}
							error={profileError}
							difficulty={data.difficulty}
							gatheringSummary={gatheringSummary}
							onConfirm={handleConfirmRegenerate}
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
