import type { MessagePart, ToolPart, UIMessage } from "@shared/chat";
import { useEffect, useRef } from "react";
import { AUTOPILOT_SENTINEL } from "@/components/tools/autopilot-badge";

function isToolPart(part: MessagePart): part is ToolPart {
	return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

interface UseChatAutopilotOptions {
	enabled: boolean;
	messages: UIMessage[];
	addToolOutput: (params: {
		tool: string;
		toolCallId: string;
		output: unknown;
	}) => void;
}

export function useChatAutopilot({
	enabled,
	messages,
	addToolOutput,
}: UseChatAutopilotOptions): void {
	const handledRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		if (!enabled) return;
		for (const msg of messages) {
			for (const part of msg.parts) {
				if (!isToolPart(part)) continue;
				if (part.state !== "input-available") continue;
				if (part.output !== undefined) continue;
				if (handledRef.current.has(part.toolCallId)) continue;

				handledRef.current.add(part.toolCallId);
				const toolName = part.toolName ?? part.type.replace(/^tool-/, "");
				addToolOutput({
					tool: toolName,
					toolCallId: part.toolCallId,
					output: AUTOPILOT_SENTINEL,
				});
			}
		}
	}, [enabled, messages, addToolOutput]);
}
