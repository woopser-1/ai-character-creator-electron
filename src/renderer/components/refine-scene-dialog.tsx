import { serializeTranscriptForReplay } from "@shared/chat-replay";
import { Loader2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatContainer } from "@/components/chat/chat-container";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { AutopilotPill } from "@/components/chrome/autopilot-pill";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useChatAutopilot } from "@/hooks/use-chat-autopilot";
import {
	getFullName,
	getStoredImageModel,
	type Scene,
	type StoredCharacter,
} from "@/lib/types";

interface RefineSceneDialogProps {
	character: StoredCharacter;
	sceneIndex: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSceneRefined?: (updated: StoredCharacter) => void;
}

export function RefineSceneDialog({
	character,
	sceneIndex,
	open,
	onOpenChange,
	onSceneRefined,
}: RefineSceneDialogProps) {
	const targetScene: Scene | undefined = character.scenes[sceneIndex];
	const [generating, setGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const chat = useAgentChat();
	const prevOpenRef = useRef(open);
	const [autopilot, setAutopilot] = useState(false);

	useChatAutopilot({
		enabled: autopilot,
		messages: chat.messages,
		addToolOutput: chat.addToolOutput,
	});

	useEffect(() => {
		if (prevOpenRef.current && !open) {
			void chat.stop();
			chat.setMessages([]);
			setGenerating(false);
			setError(null);
			setAutopilot(false);
		}
		prevOpenRef.current = open;
	}, [open, chat]);

	const isStreaming =
		chat.status === "streaming" || chat.status === "submitted";
	const showGenerate =
		chat.messages.length > 1 &&
		!isStreaming &&
		!generating &&
		chat.status !== "error";

	const gatheringSummary = useMemo(
		() => chat.finalSummary ?? serializeTranscriptForReplay(chat.messages),
		[chat.finalSummary, chat.messages],
	);

	const handleSend = useCallback(
		async (text: string) => {
			if (!targetScene) return;
			setError(null);
			if (chat.sessionId) {
				await chat.sendMessage({ text });
			} else {
				await chat.start({
					flow: "refine-scene",
					character: character.character,
					existingScenes: character.scenes,
					targetScene,
					initialUserMessage: text,
				});
			}
		},
		[chat, character, targetScene],
	);

	const handleGenerate = useCallback(async () => {
		if (!targetScene) return;
		setGenerating(true);
		setError(null);
		try {
			const otherScenes = character.scenes.filter((_, i) => i !== sceneIndex);
			const result = await window.api.generate.sceneSingle({
				runId: `scene-refine-${Date.now()}`,
				character: character.character,
				existingScenes: otherScenes,
				gatheringSummary,
				imageModel: getStoredImageModel(character),
			});
			if (!result.success) {
				setError(result.error);
				return;
			}
			const updated = await window.api.characters.replaceScene(
				character.id,
				sceneIndex,
				result.scene,
			);
			if (updated) {
				onSceneRefined?.(updated);
			}
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setGenerating(false);
		}
	}, [
		character,
		gatheringSummary,
		sceneIndex,
		targetScene,
		onOpenChange,
		onSceneRefined,
	]);

	if (!targetScene) return null;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className="flex h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
				showCloseButton
			>
				<DialogHeader className="border-border border-b px-6 pt-5 pb-4">
					<div className="flex items-start justify-between gap-4 pr-8">
						<div className="flex min-w-0 flex-col gap-1.5">
							<span className="eyebrow text-foreground/55">
								Refine · scene
							</span>
							<DialogTitle className="-tracking-[0.015em] truncate font-semibold text-[1.25rem] text-foreground leading-tight">
								{targetScene.sceneName}
							</DialogTitle>
						</div>
						<AutopilotPill
							disabled={generating}
							enabled={autopilot}
							onToggle={setAutopilot}
						/>
					</div>
					<p className="mt-2 line-clamp-2 max-w-[60ch] text-[0.8125rem] text-muted-foreground leading-relaxed">
						{targetScene.prompt}
					</p>
				</DialogHeader>

				<ChatContainer>
					<div className="flex w-full flex-col gap-4">
						{chat.messages.length === 0 && (
							<div className="flex flex-col gap-5 py-10">
								<div className="flex items-baseline gap-3">
									<span
										aria-hidden
										className="display-figure text-[0.8125rem] text-foreground/35 leading-none"
									>
										01
									</span>
									<span className="eyebrow text-foreground/55">
										Direction
									</span>
								</div>
								<h2 className="-tracking-[0.02em] max-w-[22ch] font-semibold text-[1.875rem] text-foreground leading-[1.05]">
									What's <span className="text-primary">off</span> about this
									one?
								</h2>
								<p className="max-w-[58ch] text-[0.9375rem] text-muted-foreground leading-relaxed">
									Outfit, mood, lighting, framing, anything. Describe the
									direction and the agent will rewrite the prompt for{" "}
									{getFullName(character.character)}.
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
									!chat.messages.slice(0, idx).some((m) => m.role === "user")
								}
								onDelete={!isStreaming ? chat.deleteMessage : undefined}
								onEdit={!isStreaming ? chat.editAndResend : undefined}
								onRewind={!isStreaming ? chat.rewindTo : undefined}
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

						{generating && (
							<div className="flex animate-message-in flex-col gap-3 py-8">
								<div className="flex items-center gap-2.5">
									<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
									<span className="eyebrow text-foreground/70">
										Rewriting scene prompt
									</span>
								</div>
								<div className="h-px w-full overflow-hidden bg-foreground/10">
									<div className="h-full w-full animate-shimmer" />
								</div>
							</div>
						)}

						{error && (
							<div className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs ring-1 ring-destructive/30">
								{error}
							</div>
						)}
					</div>
				</ChatContainer>

				<div className="border-border border-t bg-background/80 backdrop-blur-xl">
					<div className="space-y-3 px-6 py-3">
						{showGenerate && (
							<Button
								className="glow-lg w-full"
								disabled={generating}
								onClick={handleGenerate}
							>
								<Wand2 className="h-4 w-4" />
								Rewrite scene prompt
							</Button>
						)}
						{!generating && (
							<ChatInput
								disabled={isStreaming || generating}
								onSend={(text) => void handleSend(text)}
								placeholder="What would you like to change?"
							/>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
