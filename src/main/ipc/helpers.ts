import type { BrowserWindow } from "electron";
import type { PortableCharacter } from "@shared/character-port";
import type { PortableGroupChat } from "@shared/group-chat-port";
import type { Measurements } from "@shared/schemas";
import type { GenerateProgressEvent } from "@shared/generate";

export const APP_TAG = "ai-character-creator";

export interface IpcCtx {
	window: BrowserWindow;
	emitProgress: (event: GenerateProgressEvent) => void;
}

export function safeFilenameSegment(input: string, fallback: string): string {
	const cleaned = input
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
	return cleaned.length > 0 ? cleaned.slice(0, 60) : fallback;
}

export function characterFilename(c: PortableCharacter): string {
	const first = safeFilenameSegment(c.character.firstName, "character");
	const last = safeFilenameSegment(c.character.lastName, "");
	const stamp = new Date().toISOString().slice(0, 10);
	const slug = last ? `${first}-${last}` : first;
	return `${slug}-${stamp}.character.json`;
}

export function groupChatFilename(g: PortableGroupChat): string {
	const titleSlug = safeFilenameSegment(g.groupChat.title, "group-chat");
	const stamp = new Date().toISOString().slice(0, 10);
	return `${titleSlug}-${stamp}.group-chat.json`;
}

export function withConfirmedMeasurements(
	gatheringSummary: string,
	measurements?: Measurements,
): string {
	if (!measurements) return gatheringSummary;
	const block = [
		"## CONFIRMED MEASUREMENTS (use these EXACT values, do not change)",
		`- Height: ${measurements.heightCm} cm`,
		`- Chest/Bust: ${measurements.bustCm} cm`,
		`- Cup size or N/A: ${measurements.cupSize}`,
		`- Waist: ${measurements.waistCm} cm`,
		`- Hips: ${measurements.hipsCm} cm`,
	].join("\n");
	return `${gatheringSummary}\n\n${block}`;
}
