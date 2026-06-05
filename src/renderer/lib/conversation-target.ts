import {
	getFullName,
	getStoredImageModel,
	IMAGE_MODEL_META,
	type StoredCharacter,
	type StoredGroupChat,
} from "@/lib/types";

export type ConversationTargetKind = "character" | "group-chat";

export interface ConversationTargetParticipant {
	id?: string;
	name: string;
	subtitle?: string;
	imageUrl?: string;
	href?: string;
	missing?: boolean;
}

export interface ConversationTargetStat {
	label: string;
	icon?: "users";
	title?: string;
}

export interface ConversationTarget {
	kind: ConversationTargetKind;
	id: string;
	href: string;
	title: string;
	description: string;
	eyebrow: string;
	createdAt: string;
	coverImageUrl?: string;
	fallbackLabel: string;
	participants: ConversationTargetParticipant[];
	missingParticipantCount?: number;
	stats: ConversationTargetStat[];
	statusLabel?: string;
}

export function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

export function formatTargetDate(iso: string | number | Date): string {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function toCharacterTarget(data: StoredCharacter): ConversationTarget {
	const title = getFullName(data.character);
	const modelLabel = IMAGE_MODEL_META[getStoredImageModel(data)].label;

	return {
		kind: "character",
		id: data.id,
		href: `#/character/${data.id}`,
		title,
		description: data.character.publicDescription,
		eyebrow: data.character.occupationLabel,
		createdAt: data.createdAt,
		coverImageUrl: data.profileImageUrl,
		fallbackLabel: initials(title) || "·",
		participants: [
			{
				id: data.id,
				name: title,
				subtitle: data.character.occupationLabel,
				imageUrl: data.profileImageUrl,
				href: `#/character/${data.id}`,
			},
		],
		stats: [
			{
				label: `${String(data.scenes.length).padStart(2, "0")} scenes`,
			},
			{ label: formatTargetDate(data.createdAt) },
			{ label: modelLabel, title: `Image model: ${modelLabel}` },
		],
		statusLabel: data.profileImageUrl ? undefined : "Unillustrated",
	};
}

export function toGroupChatTarget(
	data: StoredGroupChat,
	charactersById: Map<string, StoredCharacter>,
): ConversationTarget {
	const participants = data.characterIds
		.map((id) => charactersById.get(id))
		.filter((character): character is StoredCharacter => Boolean(character))
		.map((character) => {
			const name = getFullName(character.character);

			return {
				id: character.id,
				name,
				subtitle: character.character.occupationLabel,
				imageUrl: character.profileImageUrl,
				href: `#/character/${character.id}`,
			};
		});

	const missingParticipantCount = data.characterIds.length - participants.length;

	return {
		kind: "group-chat",
		id: data.id,
		href: `#/group-chats/${data.id}`,
		title: data.groupChat.title,
		description: data.groupChat.publicDescription,
		eyebrow: "Group chat",
		createdAt: data.createdAt,
		fallbackLabel: "·",
		participants,
		missingParticipantCount,
		stats: [
			{ icon: "users", label: String(data.characterIds.length) },
			{ label: data.messageLength },
			{ label: formatTargetDate(data.createdAt) },
		],
	};
}
