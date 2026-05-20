import { serializeTranscriptForReplay } from "@shared/chat-replay";
import type { Draft } from "@shared/drafts";
import type { GenerateProgressEvent, GenerateStepId } from "@shared/generate";
import { Plus, RotateCcw, Wand2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatMessage } from "@/components/chat/chat-message";
import { AutopilotPill } from "@/components/chrome/autopilot-pill";
import { ChatDock } from "@/components/chrome/chat-dock";
import { ChatDockSlot, SubHeaderSlot } from "@/components/chrome/chrome-slots";
import { CreateToolbar } from "@/components/chrome/create-toolbar";
import { DifficultyPill } from "@/components/chrome/difficulty-pill";
import { ImageModelPill } from "@/components/chrome/image-model-pill";
import { MessageLengthPill } from "@/components/chrome/message-length-pill";
import {
	GenerationSteps,
	type StepState,
} from "@/components/create/generation-steps";
import { ProfileReview } from "@/components/profile-review";
import { Button } from "@/components/ui/button";
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
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useChatAutopilot } from "@/hooks/use-chat-autopilot";
import { useSettings } from "@/hooks/use-settings";
import { consumeReplaySeed } from "@/lib/gathering-replay";
import { navigate } from "@/lib/router";
import {
	CHARACTER_STEP_IDS,
	type Character,
	type CharacterProfilePreview,
	type CharacterStepId,
	type ConfirmedProfile,
	DEFAULT_IMAGE_MODEL,
	DEFAULT_MESSAGE_LENGTH,
	type Difficulty,
	getFullName,
	type ImageModel,
	type Measurements,
	type MessageLength,
} from "@/lib/types";

type Phase =
	| "character-gathering"
	| "character-profile-review"
	| "character-generating"
	| "scene-gathering"
	| "scene-generating"
	| "done";

const CHARACTER_STEP_LABELS: Record<CharacterStepId, string> = {
	light: "Identity, greeting, difficulty/intimacy profiles",
	scenario: "Scenario (narrative, intimacy, trust system)",
	personality: "Detailed personality (XML sections)",
	extras: "Lore, backstory, NPCs",
	visual: "Physical description and visual prompts",
};

const STEPPER_STEPS = [
	{ id: "character", label: "Character" },
	{ id: "scenes", label: "Scenes" },
];

function initialCharacterSteps(): StepState[] {
	return CHARACTER_STEP_IDS.map((id) => ({
		id: id as GenerateStepId,
		label: CHARACTER_STEP_LABELS[id],
		status: "idle",
	}));
}

function initialSceneSteps(): StepState[] {
	return [{ id: "scenes", label: "Generating scenes", status: "idle" }];
}

const summarizeChat = serializeTranscriptForReplay;

export function CreatePage() {
	const [phase, setPhase] = useState<Phase>("character-gathering");
	const [difficulty, setDifficulty] = useState<Difficulty>("medium");
	const [messageLength, setMessageLength] = useState<MessageLength>(
		DEFAULT_MESSAGE_LENGTH,
	);
	const [imageModel, setImageModel] = useState<ImageModel>(DEFAULT_IMAGE_MODEL);
	const [character, setCharacter] = useState<Character | null>(null);
	const [savedId, setSavedId] = useState<string | null>(null);
	const [characterSteps, setCharacterSteps] = useState<StepState[]>(
		initialCharacterSteps,
	);
	const [sceneSteps, setSceneSteps] = useState<StepState[]>(() =>
		initialSceneSteps(),
	);
	const [runId, setRunId] = useState<string | null>(null);
	const [sceneRunId, setSceneRunId] = useState<string | null>(null);
	const [inferredProfile, setInferredProfile] = useState<
		CharacterProfilePreview | undefined
	>();
	const [profileLoading, setProfileLoading] = useState(false);
	const [profileError, setProfileError] = useState<string | undefined>();
	const [confirmedMeasurements, setConfirmedMeasurements] = useState<
		Measurements | undefined
	>();
	const [confirmedProfile, setConfirmedProfile] = useState<
		ConfirmedProfile | undefined
	>();
	const stepDataRef = useRef<Partial<Record<CharacterStepId, unknown>>>({});
	// Draft tracking. Allocated upfront so autosave can start the moment the
	// user types their first message; reused as the final character id when the
	// gathering successfully promotes to a StoredCharacter.
	const draftIdRef = useRef<string>(nanoid());
	const sourceCharacterIdRef = useRef<string | undefined>(undefined);
	const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
	const [resumeChecked, setResumeChecked] = useState(false);

	const characterChat = useAgentChat();
	const sceneChat = useAgentChat();
	const { settings, update: updateSettings } = useSettings();
	const superAdmin = settings?.superAdmin ?? false;
	const [autopilot, setAutopilot] = useState(false);
	// Once the user has touched a chat-setting pill, stop overriding it from the
	// last-used defaults loaded from settings.json. Also gates the persistence
	// effects so they only fire after the user has actually picked something.
	const settingsAppliedRef = useRef(false);

	// Apply the last-used chat settings as defaults — but only on a fresh
	// /create with no seed (rewinds bring their own settings). Runs as soon as
	// the settings hook resolves.
	useEffect(() => {
		if (!settings) return;
		if (settingsAppliedRef.current) return;
		if (seedAppliedRef.current) return;
		settingsAppliedRef.current = true;
		if (settings.lastDifficulty) setDifficulty(settings.lastDifficulty);
		if (settings.lastMessageLength)
			setMessageLength(settings.lastMessageLength);
		if (settings.lastImageModel) setImageModel(settings.lastImageModel);
	}, [settings]);

	const handleDifficultyChange = useCallback(
		(next: Difficulty) => {
			setDifficulty(next);
			void updateSettings({ lastDifficulty: next });
		},
		[updateSettings],
	);
	const handleMessageLengthChange = useCallback(
		(next: MessageLength) => {
			setMessageLength(next);
			void updateSettings({ lastMessageLength: next });
		},
		[updateSettings],
	);
	const handleImageModelChange = useCallback(
		(next: ImageModel) => {
			setImageModel(next);
			void updateSettings({ lastImageModel: next });
		},
		[updateSettings],
	);

	useChatAutopilot({
		enabled: autopilot,
		messages: characterChat.messages,
		addToolOutput: characterChat.addToolOutput,
	});
	useChatAutopilot({
		enabled: autopilot,
		messages: sceneChat.messages,
		addToolOutput: sceneChat.addToolOutput,
	});

	const activeChat =
		phase === "character-gathering" ||
		phase === "character-profile-review" ||
		phase === "character-generating"
			? characterChat
			: sceneChat;

	const isStreaming =
		activeChat.status === "streaming" || activeChat.status === "submitted";

	const seedAppliedRef = useRef(false);
	useEffect(() => {
		if (seedAppliedRef.current) return;
		const seed = consumeReplaySeed();
		if (!seed) {
			// No seed: check for a pending draft to potentially resume. Don't
			// auto-restore silently — surface a banner and let the user decide.
			void window.api.drafts.getLatest().then((draft) => {
				if (draft) setPendingDraft(draft);
				setResumeChecked(true);
			});
			return;
		}
		seedAppliedRef.current = true;
		setResumeChecked(true); // a seed wins over any pending draft
		if (seed.kind === "rewind-character") {
			draftIdRef.current = seed.draftId;
			sourceCharacterIdRef.current = seed.sourceCharacterId;
			setDifficulty(seed.difficulty);
			if (seed.messageLength) setMessageLength(seed.messageLength);
			if (seed.imageModel) setImageModel(seed.imageModel);
			setPhase("character-gathering");
			void characterChat.seedReplay({
				payload: {
					flow: "gather-character",
					initialUserMessage: seed.newMessage,
				},
				truncatedMessages: seed.truncatedMessages,
				newMessage: seed.newMessage,
			});
		} else if (seed.kind === "rewind-scenes") {
			setDifficulty(seed.difficulty);
			if (seed.messageLength) setMessageLength(seed.messageLength);
			if (seed.imageModel) setImageModel(seed.imageModel);
			setCharacter(seed.character);
			setSavedId(seed.originCharacterId);
			setPhase("scene-gathering");
			void sceneChat.seedReplay({
				payload: {
					flow: "gather-scenes",
					character: seed.character,
					initialUserMessage: seed.newMessage,
				},
				truncatedMessages: seed.truncatedMessages,
				newMessage: seed.newMessage,
			});
		}
	}, [characterChat, sceneChat]);

	// Autosave the character-gathering draft. Runs whenever the transcript
	// settles into a stable state — never during streaming, never with a tool
	// call still awaiting input. A short debounce smooths bursts.
	useEffect(() => {
		if (phase !== "character-gathering") return;
		if (characterChat.messages.length === 0) return;
		if (
			characterChat.status === "streaming" ||
			characterChat.status === "submitted"
		)
			return;
		const handle = window.setTimeout(() => {
			void window.api.drafts.save({
				id: draftIdRef.current,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				kind: "character",
				difficulty,
				messageLength,
				imageModel,
				characterGatheringMessages: characterChat.messages,
				sourceCharacterId: sourceCharacterIdRef.current,
			});
		}, 300);
		return () => window.clearTimeout(handle);
	}, [
		phase,
		characterChat.messages,
		characterChat.status,
		difficulty,
		messageLength,
		imageModel,
	]);

	// Real-time persistence for the scene-gathering phase. The character is
	// already saved, so we write straight into StoredCharacter.sceneGatheringMessages.
	useEffect(() => {
		if (phase !== "scene-gathering") return;
		if (!savedId) return;
		if (sceneChat.messages.length === 0) return;
		if (sceneChat.status === "streaming" || sceneChat.status === "submitted")
			return;
		const handle = window.setTimeout(() => {
			void window.api.characters.updateGatheringMessages(savedId, {
				sceneGatheringMessages: sceneChat.messages,
			});
		}, 300);
		return () => window.clearTimeout(handle);
	}, [phase, savedId, sceneChat.messages, sceneChat.status]);

	useEffect(() => {
		const off = window.api.generate.onProgress((ev: GenerateProgressEvent) => {
			if (ev.status === "failed" || ev.status === "refusal-detected") {
				console.error("[generate-progress]", ev);
			} else {
				console.log("[generate-progress]", ev.kind, ev.step, ev.status);
			}
			if (ev.kind === "character") {
				if (runId && ev.runId !== runId) return;
				setCharacterSteps((prev) =>
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
			} else if (ev.kind === "scenes") {
				if (sceneRunId && ev.runId !== sceneRunId) return;
				setSceneSteps((prev) =>
					prev.map((s) =>
						s.id === "scenes"
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
			}
		});
		return () => off();
	}, [runId, sceneRunId]);

	const handleSendCharacter = useCallback(
		async (text: string) => {
			if (characterChat.sessionId) {
				await characterChat.sendMessage({ text });
			} else {
				await characterChat.start({
					flow: "gather-character",
					initialUserMessage: text,
				});
			}
		},
		[characterChat],
	);

	const handleSuggestStarterCharacters = useCallback(() => {
		void handleSendCharacter(
			"Surprise me — propose 6-8 wildly different starter character concepts I could build from. Mix personalities, eras, occupations, settings, and vibes; lean into specificity (a haunted lighthouse keeper, a Bangkok fixer, a moody ceramicist, an heiress on the run). Use the selectMultiple tool so I can pick one or several to combine — I'll choose and we'll keep gathering from there.",
		);
	}, [handleSendCharacter]);

	const handleSendScenes = useCallback(
		async (text: string) => {
			if (!character) return;
			if (sceneChat.sessionId) {
				await sceneChat.sendMessage({ text });
			} else {
				await sceneChat.start({
					flow: "gather-scenes",
					character,
					initialUserMessage: text,
				});
			}
		},
		[character, sceneChat],
	);

	const gatheringSummary = useMemo(
		() => characterChat.finalSummary ?? summarizeChat(characterChat.messages),
		[characterChat.finalSummary, characterChat.messages],
	);

	const handleGenerateCharacter = useCallback(async () => {
		setProfileError(undefined);
		setProfileLoading(true);
		setInferredProfile(undefined);
		setConfirmedMeasurements(undefined);
		setConfirmedProfile(undefined);
		setPhase("character-profile-review");

		try {
			if (typeof window.api.generate.inferProfile !== "function") {
				setProfileError(
					"Profile inference is unavailable. Restart the app so the preload bridge picks up the latest changes.",
				);
				return;
			}
			const res = await window.api.generate.inferProfile({
				gatheringSummary,
				difficulty,
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
	}, [gatheringSummary, difficulty]);

	const handleConfirmProfile = useCallback(
		async ({
			measurements,
			profile,
		}: {
			measurements: Measurements;
			profile: ConfirmedProfile;
		}) => {
			setConfirmedMeasurements(measurements);
			setConfirmedProfile(profile);
			const id = `char-${Date.now()}`;
			setRunId(id);
			setCharacterSteps(initialCharacterSteps());
			stepDataRef.current = {};
			setPhase("character-generating");

			const result = await window.api.generate.characterAll({
				runId: id,
				difficulty,
				messageLength,
				gatheringSummary,
				imageModel,
				confirmedMeasurements: measurements,
				confirmedProfile: profile,
				draftId: draftIdRef.current,
				sourceCharacterId: sourceCharacterIdRef.current,
			});

			if (result.success) {
				setCharacter(result.stored.character);
				setSavedId(result.stored.id);
				// Persist the gathering transcript onto the now-created character,
				// then delete the draft (the promotion is complete).
				await window.api.characters.updateGatheringMessages(result.stored.id, {
					gatheringMessages: characterChat.messages,
				});
				await window.api.drafts.delete(draftIdRef.current);
				setPhase("scene-gathering");
				await sceneChat.start({
					flow: "gather-scenes",
					character: result.stored.character,
					initialUserMessage: `We are generating scene prompts for the character "${getFullName(result.stored.character)}". Suggest a variety of scene ideas that fit this character; I'll pick as many or as few as I want.`,
				});
			} else {
				for (const [stepId, data] of Object.entries(result.partialByStep)) {
					stepDataRef.current[stepId as CharacterStepId] = data;
				}
			}
		},
		[
			difficulty,
			messageLength,
			imageModel,
			gatheringSummary,
			sceneChat,
			characterChat.messages,
		],
	);

	const handleBackFromProfile = useCallback(() => {
		setPhase("character-gathering");
		setProfileError(undefined);
		setInferredProfile(undefined);
	}, []);

	const handleRetryCharacterStep = useCallback(
		async (stepId: GenerateStepId) => {
			if (stepId === "scenes") return;
			if (!runId) return;

			setCharacterSteps((prev) =>
				prev.map((s) =>
					s.id === stepId ? { ...s, status: "running", error: undefined } : s,
				),
			);

			const res = await window.api.generate.characterStep({
				runId,
				stepId: stepId as CharacterStepId,
				difficulty,
				messageLength,
				imageModel,
				gatheringSummary,
				confirmedMeasurements,
				confirmedProfile,
			});

			if (res.success) {
				stepDataRef.current[stepId as CharacterStepId] = res.data;
				const allSucceeded = CHARACTER_STEP_IDS.every(
					(id) => stepDataRef.current[id as CharacterStepId] !== undefined,
				);
				if (allSucceeded) {
					const final = await window.api.generate.characterFinalize({
						stepData: stepDataRef.current as Record<CharacterStepId, unknown>,
						difficulty,
						messageLength,
						imageModel,
						confirmedMeasurements,
						gatheringSummary,
						confirmedProfile,
						draftId: draftIdRef.current,
						sourceCharacterId: sourceCharacterIdRef.current,
					});
					if (final.success) {
						setCharacter(final.stored.character);
						setSavedId(final.stored.id);
						await window.api.characters.updateGatheringMessages(
							final.stored.id,
							{ gatheringMessages: characterChat.messages },
						);
						await window.api.drafts.delete(draftIdRef.current);
						setPhase("scene-gathering");
						await sceneChat.start({
							flow: "gather-scenes",
							character: final.stored.character,
							initialUserMessage: `We are generating scene prompts for the character "${getFullName(final.stored.character)}". Suggest a variety of scene ideas that fit this character; I'll pick as many or as few as I want.`,
						});
					}
				}
			}
		},
		[
			runId,
			difficulty,
			messageLength,
			imageModel,
			gatheringSummary,
			sceneChat,
			confirmedMeasurements,
			confirmedProfile,
			characterChat.messages,
		],
	);

	const sceneGatheringSummary = useMemo(
		() => sceneChat.finalSummary ?? summarizeChat(sceneChat.messages),
		[sceneChat.finalSummary, sceneChat.messages],
	);

	const handleGenerateScenes = useCallback(async () => {
		if (!character || !savedId) return;
		const id = `scenes-${Date.now()}`;
		setSceneRunId(id);
		setSceneSteps(initialSceneSteps());
		setPhase("scene-generating");
		await window.api.characters.updateImageModel(savedId, imageModel);
		const result = await window.api.generate.scenes({
			runId: id,
			character,
			gatheringSummary: sceneGatheringSummary,
			imageModel,
		});
		if (result.success) {
			await window.api.characters.updateScenes(savedId, result.scenes);
			void window.api.characters.updateGatheringMessages(savedId, {
				sceneGatheringMessages: sceneChat.messages,
			});
			setPhase("done");
			navigate(`/character/${savedId}`);
		}
	}, [
		character,
		savedId,
		imageModel,
		sceneGatheringSummary,
		sceneChat.messages,
	]);

	const handleMoreSceneSuggestions = useCallback(async () => {
		if (sceneChat.status === "streaming" || sceneChat.status === "submitted")
			return;
		await sceneChat.sendMessage({
			text: "Please suggest 5 more fresh scene ideas that don't overlap with the ones already suggested.",
		});
	}, [sceneChat]);

	const handleRetryScenes = useCallback(
		(stepId: GenerateStepId) => {
			if (stepId !== "scenes") return;
			void handleGenerateScenes();
		},
		[handleGenerateScenes],
	);

	const showCharacterGenerate =
		phase === "character-gathering" &&
		characterChat.messages.length > 0 &&
		!isStreaming;
	const showSceneGenerate =
		phase === "scene-gathering" &&
		sceneChat.messages.length > 1 &&
		!isStreaming;
	const hasProgress =
		characterChat.messages.length > 0 || sceneChat.messages.length > 0;

	const handleResumeDraft = useCallback(() => {
		if (!pendingDraft) return;
		draftIdRef.current = pendingDraft.id;
		sourceCharacterIdRef.current = pendingDraft.sourceCharacterId;
		setDifficulty(pendingDraft.difficulty);
		if (pendingDraft.messageLength)
			setMessageLength(pendingDraft.messageLength);
		if (pendingDraft.imageModel) setImageModel(pendingDraft.imageModel);
		const messages = pendingDraft.characterGatheringMessages ?? [];
		// Walk back to the last user message and replay everything before it as
		// the transcript; the IA picks up where it left off and reformulates the
		// final turn. Same mental model as Rewind — a natural resume.
		let userIdx = messages.length - 1;
		while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx--;
		if (userIdx < 0) {
			// Draft has no user turn yet; nothing to replay. Just clear.
			setPendingDraft(null);
			return;
		}
		const userText = messages[userIdx].parts
			.filter((p) => p.type === "text")
			.map((p) => (p as { text: string }).text)
			.join("\n")
			.trim();
		if (!userText) {
			setPendingDraft(null);
			return;
		}
		const before = messages.slice(0, userIdx);
		setPhase("character-gathering");
		setPendingDraft(null);
		void characterChat.seedReplay({
			payload: {
				flow: "gather-character",
				initialUserMessage: userText,
			},
			truncatedMessages: before,
			newMessage: userText,
		});
	}, [pendingDraft, characterChat]);

	const handleDiscardDraft = useCallback(() => {
		if (!pendingDraft) return;
		void window.api.drafts.delete(pendingDraft.id);
		setPendingDraft(null);
	}, [pendingDraft]);

	const handleStartOver = useCallback(() => {
		void characterChat.stop();
		void sceneChat.stop();
		void window.api.drafts.delete(draftIdRef.current);
		draftIdRef.current = nanoid();
		sourceCharacterIdRef.current = undefined;
		characterChat.setMessages([]);
		sceneChat.setMessages([]);
		setPhase("character-gathering");
		setDifficulty("medium");
		setMessageLength(DEFAULT_MESSAGE_LENGTH);
		setImageModel(DEFAULT_IMAGE_MODEL);
		setCharacter(null);
		setSavedId(null);
		setCharacterSteps(initialCharacterSteps());
		setSceneSteps(initialSceneSteps());
		stepDataRef.current = {};
		setRunId(null);
		setSceneRunId(null);
		setInferredProfile(undefined);
		setProfileLoading(false);
		setProfileError(undefined);
		setConfirmedMeasurements(undefined);
		setConfirmedProfile(undefined);
		setPendingDraft(null);
	}, [characterChat, sceneChat]);

	const characterDone =
		phase === "scene-gathering" ||
		phase === "scene-generating" ||
		phase === "done";
	const sceneDone = phase === "done";

	const showCharacterSteps =
		phase === "character-generating" ||
		(phase === "character-gathering" &&
			characterSteps.some((s) => s.status !== "idle"));
	const showSceneSteps =
		phase === "scene-generating" ||
		(phase === "scene-gathering" &&
			sceneSteps.some((s) => s.status !== "idle"));

	const activeStepIndex = characterDone ? 1 : 0;
	const doneCount = sceneDone ? 2 : characterDone ? 1 : 0;

	const subtitle =
		phase === "character-gathering"
			? "Brief, in progress"
			: phase === "character-profile-review"
				? "Profile review"
				: phase === "character-generating"
					? "Drafting character…"
					: phase === "scene-gathering"
						? `Scenes for ${character ? getFullName(character) : "…"}`
						: phase === "scene-generating"
							? "Drafting scenes…"
							: "Complete";

	const difficultyReadOnly = phase !== "character-gathering";
	const imageModelReadOnly = phase === "scene-generating" || phase === "done";
	const isGenerating =
		phase === "character-generating" || phase === "scene-generating";
	const isProfileReview = phase === "character-profile-review";
	const isDone = phase === "done";

	const handleChatSend = useCallback(
		(text: string) => {
			if (phase === "character-gathering") {
				void handleSendCharacter(text);
			} else if (phase === "scene-gathering") {
				void handleSendScenes(text);
			}
		},
		[phase, handleSendCharacter, handleSendScenes],
	);

	const showAutopilotToggle =
		(phase === "character-gathering" && characterChat.messages.length > 0) ||
		(phase === "scene-gathering" && sceneChat.messages.length > 0);

	const hasExtraAbove =
		showCharacterSteps ||
		showSceneSteps ||
		showCharacterGenerate ||
		showSceneGenerate ||
		showAutopilotToggle;

	return (
		<>
			<SubHeaderSlot>
				<CreateToolbar
					activeIndex={activeStepIndex}
					config={
						<>
							<DifficultyPill
								onChange={handleDifficultyChange}
								readOnly={difficultyReadOnly}
								value={difficulty}
							/>
							<MessageLengthPill
								onChange={handleMessageLengthChange}
								readOnly={difficultyReadOnly}
								value={messageLength}
							/>
							<ImageModelPill
								onChange={handleImageModelChange}
								readOnly={imageModelReadOnly}
								value={imageModel}
							/>
						</>
					}
					doneCount={doneCount}
					mark="Studio"
					reset={
						hasProgress && !isGenerating ? (
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
									<RotateCcw className="h-3.5 w-3.5" />
									Reset
								</DialogTrigger>
								<DialogContent
									className="sm:max-w-md"
									showCloseButton={false}
								>
									<DialogHeader>
										<span className="eyebrow text-destructive/85">
											Start over
										</span>
										<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
											Toss this brief?
										</DialogTitle>
									</DialogHeader>
									<DialogDescription className="max-w-[48ch] text-[0.875rem] text-muted-foreground leading-relaxed">
										Every message, every step, every staged setting goes
										back to the blank page. The character has not been saved
										yet.
									</DialogDescription>
									<DialogFooter>
										<DialogClose
											render={<Button size="sm" variant="outline" />}
										>
											Keep going
										</DialogClose>
										<DialogClose
											onClick={handleStartOver}
											render={<Button size="sm" variant="destructive" />}
										>
											<RotateCcw className="h-3.5 w-3.5" />
											Start over
										</DialogClose>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						) : undefined
					}
					status={subtitle}
					statusKey={phase}
					steps={STEPPER_STEPS}
				/>
			</SubHeaderSlot>

			<ChatDockSlot>
				<ChatDock
					disabled={isStreaming || isGenerating || isProfileReview || isDone}
					extraAbove={
						hasExtraAbove ? (
							<div className="space-y-3">
								{showCharacterSteps && (
									<GenerationSteps
										onRetry={handleRetryCharacterStep}
										steps={characterSteps}
										superAdmin={superAdmin}
										title="Character profile"
									/>
								)}
								{showSceneSteps && (
									<GenerationSteps
										onRetry={handleRetryScenes}
										steps={sceneSteps}
										superAdmin={superAdmin}
										title="Scenes"
									/>
								)}
								{(showCharacterGenerate ||
									showSceneGenerate ||
									showAutopilotToggle) && (
									<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
										{(showCharacterGenerate || showSceneGenerate) && (
											<span className="inline-flex items-center gap-1.5 eyebrow text-foreground/55">
												<span
													aria-hidden
													className="h-1.5 w-1.5 rounded-full bg-primary glow-xs"
												/>
												Ready ·{" "}
												<span className="tabular-nums text-foreground/75">
													{String(
														showCharacterGenerate
															? characterChat.messages.length
															: sceneChat.messages.length,
													).padStart(2, "0")}
												</span>{" "}
												turns
											</span>
										)}
										<div className="ml-auto flex items-center gap-2">
											{phase === "scene-gathering" &&
												sceneChat.messages.length > 1 &&
												!isStreaming && (
													<Button
														onClick={handleMoreSceneSuggestions}
														size="sm"
														variant="outline"
													>
														<Plus className="h-3.5 w-3.5" />
														More suggestions
													</Button>
												)}
											{showCharacterGenerate && (
												<Button
													className="glow-lg"
													onClick={handleGenerateCharacter}
												>
													<Wand2 className="h-4 w-4" />
													Generate character
												</Button>
											)}
											{showSceneGenerate && (
												<Button
													className="glow-lg"
													onClick={handleGenerateScenes}
												>
													<Wand2 className="h-4 w-4" />
													Generate scenes
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
					onSend={handleChatSend}
					placeholder={
						phase === "character-gathering"
							? "Describe your character concept..."
							: "Describe scene ideas or adjustments..."
					}
				/>
			</ChatDockSlot>

			<ChatContainer>
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
					{activeChat.error && (
						<div className="animate-message-in rounded-xl bg-destructive/10 p-3 text-destructive text-sm ring-1 ring-destructive/30">
							<p className="font-medium">Chat error</p>
							<p className="mt-1 text-destructive/90 text-xs leading-relaxed whitespace-pre-wrap">
								{activeChat.error}
							</p>
						</div>
					)}
					{phase === "character-gathering" ||
					phase === "character-profile-review" ||
					phase === "character-generating" ? (
						<>
							{characterChat.messages.length === 0 && (
								<div className="flex flex-col gap-6 px-1 pt-16 pb-12 sm:pt-24">
									<div className="flex items-baseline gap-3">
										<span
											aria-hidden
											className="display-figure text-[0.875rem] text-foreground/35 leading-none"
										>
											01
										</span>
										<span className="eyebrow text-foreground/55">
											Brief · Character
										</span>
									</div>
									<h2 className="-tracking-[0.025em] max-w-[18ch] font-semibold text-[2.5rem] text-foreground leading-[1.02] sm:text-[3rem]">
										Who are we
										<br />
										writing <span className="text-primary">today?</span>
									</h2>
									<p className="max-w-[58ch] text-[0.9375rem] text-muted-foreground leading-relaxed">
										Sketch the concept in plain language: occupation, age,
										temperament, the room they're standing in. The agent will
										refine the rest by asking follow-up questions.
									</p>
									<div className="flex flex-wrap items-center gap-2">
										<Button
											className="glow-md hover:glow-lg"
											disabled={isStreaming}
											onClick={handleSuggestStarterCharacters}
											size="sm"
										>
											<Wand2 className="h-3.5 w-3.5" />
											Surprise me
										</Button>
										<span className="text-foreground/45 text-xs">
											or type your own brief below.
										</span>
									</div>
									{resumeChecked && pendingDraft && (
										<div className="animate-message-in flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/50 px-4 py-3 ring-1 ring-foreground/10">
											<div className="flex min-w-0 flex-1 flex-col">
												<span className="eyebrow text-foreground/55">
													Unfinished brief
												</span>
												<span className="text-foreground/80 text-sm">
													{(pendingDraft.characterGatheringMessages?.length ?? 0)}{" "}
													messages saved · last edit{" "}
													{new Date(pendingDraft.updatedAt).toLocaleString()}
												</span>
											</div>
											<div className="flex items-center gap-2">
												<Button
													onClick={handleDiscardDraft}
													size="sm"
													variant="ghost"
												>
													Discard
												</Button>
												<Button onClick={handleResumeDraft} size="sm">
													<RotateCcw className="h-3.5 w-3.5" />
													Resume
												</Button>
											</div>
										</div>
									)}
								</div>
							)}
							{characterChat.messages.map((msg, idx) => (
								<ChatMessage
									addToolOutput={characterChat.addToolOutput}
									key={msg.id}
									message={msg}
									noPriorUserTurn={
										msg.role === "assistant" &&
										!characterChat.messages
											.slice(0, idx)
											.some((m) => m.role === "user")
									}
									onDelete={
										phase === "character-gathering"
											? characterChat.deleteMessage
											: undefined
									}
									onEdit={
										phase === "character-gathering"
											? characterChat.editAndResend
											: undefined
									}
									onRewind={
										phase === "character-gathering"
											? characterChat.rewindTo
											: undefined
									}
								/>
							))}
							{isProfileReview && (
								<ProfileReview
									initial={inferredProfile}
									loading={profileLoading}
									error={profileError}
									difficulty={difficulty}
									gatheringSummary={gatheringSummary}
									onConfirm={handleConfirmProfile}
									onBack={handleBackFromProfile}
								/>
							)}
						</>
					) : (
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
										Brief · Scenes
									</span>
									<span className="h-px flex-1 bg-foreground/10" />
								</div>
								{character && (
									<div className="flex flex-col gap-3">
										<div className="eyebrow text-foreground/40">
											Drafted character
										</div>
										<h2 className="-tracking-[0.02em] font-semibold text-[1.5rem] text-foreground leading-[1.05] sm:text-[1.75rem]">
											{getFullName(character)}
										</h2>
										<p className="max-w-[64ch] text-[0.9375rem] text-muted-foreground leading-relaxed">
											{character.publicDescription}
										</p>
									</div>
								)}
							</div>
							{sceneChat.messages.map((msg, idx) => (
								<ChatMessage
									addToolOutput={sceneChat.addToolOutput}
									key={msg.id}
									message={msg}
									noPriorUserTurn={
										msg.role === "assistant" &&
										!sceneChat.messages
											.slice(0, idx)
											.some((m) => m.role === "user")
									}
									onDelete={
										phase === "scene-gathering"
											? sceneChat.deleteMessage
											: undefined
									}
									onEdit={
										phase === "scene-gathering"
											? sceneChat.editAndResend
											: undefined
									}
									onRewind={
										phase === "scene-gathering"
											? sceneChat.rewindTo
											: undefined
									}
								/>
							))}
						</>
					)}

					{activeChat.status === "submitted" && (
						<div className="flex animate-message-in items-center gap-3 pl-1 text-foreground/55">
							<div className="flex items-center gap-1">
								<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
								<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
								<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
							</div>
							<span className="eyebrow">Thinking</span>
						</div>
					)}
				</div>
			</ChatContainer>
		</>
	);
}
