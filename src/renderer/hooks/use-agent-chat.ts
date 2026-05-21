import type {
	AgentStreamEvent,
	MessagePart,
	StartChatPayload,
	ToolName,
	ToolPart,
	UIMessage,
} from "@shared/chat";
import { serializeTranscriptForReplay } from "@shared/chat-replay";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";

export type ChatStatus = "idle" | "submitted" | "streaming" | "ready" | "error";

export interface UseAgentChatOptions {
	/** When true, opens the session eagerly on mount with the given start payload. */
	autoStart?: { payload: StartChatPayload };
}

export interface UseAgentChatReturn {
	messages: UIMessage[];
	status: ChatStatus;
	error: string | null;
	sessionId: string | null;
	finalSummary: string | null;
	start: (payload: StartChatPayload) => Promise<void>;
	seedReplay: (params: {
		payload: StartChatPayload;
		truncatedMessages: UIMessage[];
		newMessage: string;
	}) => Promise<void>;
	sendMessage: (params: { text: string }) => Promise<void>;
	addToolOutput: (params: {
		tool: string;
		toolCallId: string;
		output: unknown;
	}) => void;
	setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
	stop: () => Promise<void>;
	deleteMessage: (id: string) => Promise<void>;
	editAndResend: (id: string, newText: string) => Promise<void>;
	/**
	 * Rewind the chat to a specific message and let the IA take it from there.
	 * - On a user message: truncate everything AFTER it and resend that user
	 *   message — the IA produces a fresh reply at that point.
	 * - On an assistant message: walk back to the prior user message, truncate
	 *   that message's reply (and everything after) and resend that user message
	 *   — the IA reformulates the same turn.
	 * In both cases the chat naturally continues with the same flow as if the
	 * conversation had been pre-filled up to this point.
	 */
	rewindTo: (id: string) => Promise<void>;
}

function isToolPart(part: MessagePart): part is ToolPart {
	return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

export function useAgentChat(
	options?: UseAgentChatOptions,
): UseAgentChatReturn {
	const [messages, setMessages] = useState<UIMessage[]>([]);
	const [status, setStatus] = useState<ChatStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [finalSummary, setFinalSummary] = useState<string | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const startedRef = useRef(false);
	const lastPayloadRef = useRef<StartChatPayload | null>(null);

	const ensureAssistantMessage = useCallback(
		(updater: (msg: UIMessage) => UIMessage) => {
			setMessages((prev) => {
				const last = prev.at(-1);
				if (last && last.role === "assistant") {
					const next = [...prev];
					next[next.length - 1] = updater(last);
					return next;
				}
				const fresh: UIMessage = {
					id: nanoid(),
					role: "assistant",
					parts: [],
				};
				return [...prev, updater(fresh)];
			});
		},
		[],
	);

	const handleEvent = useCallback(
		(ev: AgentStreamEvent) => {
			if (ev.sessionId !== sessionIdRef.current) {
				return;
			}

			switch (ev.type) {
				case "text-delta": {
					if (!ev.text) return;
					const text = ev.text;
					ensureAssistantMessage((msg) => ({
						...msg,
						parts: [...msg.parts, { type: "text", text }],
					}));
					setStatus("streaming");
					break;
				}
				case "tool-call": {
					if (!ev.toolCallId || !ev.toolName) return;
					const toolCallId = ev.toolCallId;
					const toolName = ev.toolName as ToolName;
					const input = ev.input ?? {};
					ensureAssistantMessage((msg) => ({
						...msg,
						parts: [
							...msg.parts,
							{
								type: `tool-${toolName}`,
								toolName,
								toolCallId,
								state: "input-available",
								input,
							} as ToolPart,
						],
					}));
					setStatus("streaming");
					break;
				}
				case "tool-result": {
					if (!ev.toolCallId) return;
					const toolCallId = ev.toolCallId;
					setMessages((prev) =>
						prev.map((m) => ({
							...m,
							parts: m.parts.map((p) =>
								isToolPart(p) && p.toolCallId === toolCallId
									? { ...p, state: "output-available", output: ev.output }
									: p,
							),
						})),
					);
					break;
				}
				case "finished": {
					setStatus("ready");
					if (ev.finalSummary) {
						setFinalSummary(ev.finalSummary);
					}
					break;
				}
				case "error": {
					setStatus("error");
					setError(ev.error ?? "Unknown error");
					break;
				}
				default:
					break;
			}
		},
		[ensureAssistantMessage],
	);

	useEffect(() => {
		const unsub = window.api.chat.onEvent(handleEvent);
		return unsub;
	}, [handleEvent]);

	const start = useCallback(async (payload: StartChatPayload) => {
		// Pre-generate the session id in the renderer and stamp the ref BEFORE
		// the IPC call. Events from main (chat:event) and the IPC reply travel
		// on independent channels with no ordering guarantee — if events landed
		// before we set sessionIdRef.current they used to be dropped by the
		// filter in handleEvent, leaving the chat stuck on "submitted".
		const sid = nanoid();
		sessionIdRef.current = sid;
		setSessionId(sid);
		setStatus("submitted");
		setError(null);
		setFinalSummary(null);
		lastPayloadRef.current = payload;
		const initialText = payload.initialUserMessage;
		setMessages([
			{
				id: nanoid(),
				role: "user",
				parts: [{ type: "text", text: initialText }],
			},
		]);
		const result = await window.api.chat.start({ ...payload, sessionId: sid });
		if (!result.success) {
			sessionIdRef.current = null;
			setSessionId(null);
			setStatus("error");
			setError(result.error);
			return;
		}
	}, []);

	const restart = useCallback(
		async (truncated: UIMessage[], newMessage: string) => {
			const payload = lastPayloadRef.current;
			if (!payload) return;
			const oldSessionId = sessionIdRef.current ?? undefined;
			const replayTranscript = serializeTranscriptForReplay(truncated);
			// Pre-generate the new session id in the renderer and stamp the ref
			// BEFORE the IPC call. See `start` above — without this, the first
			// few chat:event messages from main race the IPC reply and get
			// dropped by handleEvent's sessionId filter, freezing the chat.
			const sid = nanoid();
			sessionIdRef.current = sid;
			setSessionId(sid);
			setStatus("submitted");
			setError(null);
			setFinalSummary(null);
			setMessages([
				...truncated,
				{
					id: nanoid(),
					role: "user",
					parts: [{ type: "text", text: newMessage }],
				},
			]);
			const restartPayload =
				payload.flow === "gather-character"
					? {
							sessionId: sid,
							oldSessionId,
							flow: "gather-character" as const,
							replayTranscript,
							newMessage,
						}
					: payload.flow === "gather-scenes"
						? {
								sessionId: sid,
								oldSessionId,
								flow: "gather-scenes" as const,
								character: payload.character,
								replayTranscript,
								newMessage,
							}
						: payload.flow === "gather-scene"
							? {
									sessionId: sid,
									oldSessionId,
									flow: "gather-scene" as const,
									character: payload.character,
									existingScenes: payload.existingScenes,
									replayTranscript,
									newMessage,
								}
							: payload.flow === "refine-scene"
								? {
										sessionId: sid,
										oldSessionId,
										flow: "refine-scene" as const,
										character: payload.character,
										existingScenes: payload.existingScenes,
										targetScene: payload.targetScene,
										replayTranscript,
										newMessage,
									}
								: payload.flow === "gather-group-chat"
									? {
											sessionId: sid,
											oldSessionId,
											flow: "gather-group-chat" as const,
											characters: payload.characters,
											replayTranscript,
											newMessage,
										}
									: {
											sessionId: sid,
											oldSessionId,
											flow: "gather-regenerate" as const,
											character: payload.character,
											replayTranscript,
											newMessage,
										};
			const result = await window.api.chat.restart(restartPayload);
			if (!result.success) {
				sessionIdRef.current = null;
				setSessionId(null);
				setStatus("error");
				setError(result.error);
				return;
			}
			// Leave the status at "submitted" — the IPC reply only confirms the
			// session opened, the model hasn't produced anything yet. The "Thinking"
			// indicator stays visible until the first text-delta or tool-call event
			// flips us into "streaming" via handleEvent. Mirrors the start() flow.
		},
		[],
	);

	const deleteMessage = useCallback(
		async (id: string) => {
			setMessages((prev) => prev.filter((m) => m.id !== id));
			// If the model is mid-turn (preparing or streaming) when the user
			// deletes a message, the intent is "stop this turn". Kill the session
			// so the Thinking indicator clears and no further events land in the
			// now-stripped transcript.
			if (status === "submitted" || status === "streaming") {
				const sid = sessionIdRef.current;
				if (sid) {
					await window.api.chat.stop(sid);
					sessionIdRef.current = null;
					setSessionId(null);
					setStatus("idle");
				}
			}
		},
		[status],
	);

	const editAndResend = useCallback(
		async (id: string, newText: string) => {
			const idx = messages.findIndex((m) => m.id === id);
			if (idx < 0) return;
			const before = messages.slice(0, idx);
			await restart(before, newText);
		},
		[messages, restart],
	);

	const rewindTo = useCallback(
		async (id: string) => {
			const idx = messages.findIndex((m) => m.id === id);
			if (idx < 0) return;
			// On a user message: truncate after it and resend it as-is.
			// On an assistant message: walk back to the prior user turn so the IA
			// can reformulate the same answer.
			let userIdx = idx;
			if (messages[idx].role !== "user") {
				while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx--;
			}
			if (userIdx < 0) return;
			const userText = messages[userIdx].parts
				.filter((p) => p.type === "text")
				.map((p) => (p as { text: string }).text)
				.join("\n")
				.trim();
			if (!userText) return;
			const before = messages.slice(0, userIdx);
			await restart(before, userText);
		},
		[messages, restart],
	);

	const seedReplay = useCallback(
		async ({
			payload,
			truncatedMessages,
			newMessage,
		}: {
			payload: StartChatPayload;
			truncatedMessages: UIMessage[];
			newMessage: string;
		}) => {
			lastPayloadRef.current = payload;
			await restart(truncatedMessages, newMessage);
		},
		[restart],
	);

	useEffect(() => {
		if (!options?.autoStart || startedRef.current) {
			return;
		}
		startedRef.current = true;
		void start(options.autoStart.payload);
	}, [options?.autoStart, start]);

	const sendMessage = useCallback(async ({ text }: { text: string }) => {
		const currentSessionId = sessionIdRef.current;
		if (!currentSessionId) {
			return;
		}
		setMessages((prev) => [
			...prev,
			{
				id: nanoid(),
				role: "user",
				parts: [{ type: "text", text }],
			},
		]);
		setStatus("submitted");
		await window.api.chat.send(currentSessionId, text);
	}, []);

	const addToolOutput = useCallback(
		({
			toolCallId,
			output,
		}: {
			tool: string;
			toolCallId: string;
			output: unknown;
		}) => {
			const currentSessionId = sessionIdRef.current;
			if (!currentSessionId) {
				return;
			}
			const serialized =
				typeof output === "string" ? output : JSON.stringify(output);
			setMessages((prev) =>
				prev.map((m) => ({
					...m,
					parts: m.parts.map((p) =>
						isToolPart(p) && p.toolCallId === toolCallId
							? { ...p, state: "output-available", output: serialized }
							: p,
					),
				})),
			);
			setStatus("submitted");
			void window.api.chat.toolOutput(currentSessionId, toolCallId, serialized);
		},
		[],
	);

	const stop = useCallback(async () => {
		const currentSessionId = sessionIdRef.current;
		if (!currentSessionId) return;
		await window.api.chat.stop(currentSessionId);
		sessionIdRef.current = null;
		setSessionId(null);
		setStatus("idle");
	}, []);

	return {
		messages,
		status,
		error,
		sessionId,
		finalSummary,
		start,
		seedReplay,
		sendMessage,
		addToolOutput,
		setMessages,
		stop,
		deleteMessage,
		editAndResend,
		rewindTo,
	};
}
