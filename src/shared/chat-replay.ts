import type { UIMessage } from "./chat";

export function serializeTranscriptForReplay(messages: UIMessage[]): string {
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
				if (question) lines.push(`Assistant asked: ${question}`);
				if (output) lines.push(`User answered: ${output}`);
			}
		}
	}
	return lines.join("\n");
}
