import { Check, Users } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
	getFullName,
	MAX_GROUP_CHAT_CHARACTERS,
	MIN_GROUP_CHAT_CHARACTERS,
	type StoredCharacter,
} from "@/lib/types";

interface CharacterPickerProps {
	characters: StoredCharacter[];
	selectedIds: string[];
	onToggle: (id: string) => void;
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

export function CharacterPicker({
	characters,
	selectedIds,
	onToggle,
}: CharacterPickerProps) {
	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const atMax = selectedIds.length >= MAX_GROUP_CHAT_CHARACTERS;
	const atMin = selectedIds.length >= MIN_GROUP_CHAT_CHARACTERS;

	if (characters.length === 0) {
		return (
			<div className="rounded-2xl bg-secondary/40 p-8 text-center ring-1 ring-foreground/10">
				<Users className="mx-auto h-8 w-8 text-foreground/35" />
				<p className="mt-3 font-medium text-foreground text-sm">
					No characters yet
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create at least 2 characters first, then come back to build a group
					chat.
				</p>
			</div>
		);
	}

	if (characters.length < MIN_GROUP_CHAT_CHARACTERS) {
		return (
			<div className="rounded-2xl bg-secondary/40 p-8 text-center ring-1 ring-foreground/10">
				<Users className="mx-auto h-8 w-8 text-foreground/35" />
				<p className="mt-3 font-medium text-foreground text-sm">
					Not enough characters
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					A group chat needs at least {MIN_GROUP_CHAT_CHARACTERS} characters.
					You currently have {characters.length}.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-baseline gap-2">
					<span className="font-medium text-foreground text-sm">
						{selectedIds.length}
					</span>
					<span className="text-muted-foreground text-xs">
						selected · pick {MIN_GROUP_CHAT_CHARACTERS}-
						{MAX_GROUP_CHAT_CHARACTERS}
					</span>
				</div>
				{!atMin && selectedIds.length > 0 && (
					<span className="text-foreground/55 text-xs">
						Pick at least {MIN_GROUP_CHAT_CHARACTERS - selectedIds.length} more
					</span>
				)}
			</div>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{characters.map((c) => {
					const isSelected = selectedSet.has(c.id);
					const disabled = !isSelected && atMax;
					const fullName = getFullName(c.character);
					return (
						<button
							aria-pressed={isSelected}
							className={cn(
								"group relative flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-3 text-left outline-none ring-1 transition-all duration-200 ease-out",
								isSelected
									? "ring-2 ring-primary/65 [box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.25),0_0_18px_oklch(0.72_0.25_305_/_0.18)]"
									: disabled
										? "cursor-not-allowed opacity-45 ring-foreground/10"
										: "cursor-pointer ring-foreground/10 hover:ring-foreground/25",
							)}
							disabled={disabled}
							key={c.id}
							onClick={() => onToggle(c.id)}
							type="button"
						>
							<div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-secondary/60">
								{c.profileImageUrl ? (
									<img
										alt={fullName}
										className="h-full w-full object-cover"
										loading="lazy"
										src={c.profileImageUrl}
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center">
										<span
											aria-hidden
											className="display-figure pointer-events-none select-none text-[3rem] text-foreground/15 leading-[0.8]"
										>
											{initials(fullName) || "·"}
										</span>
									</div>
								)}
								{isSelected && (
									<span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
										<Check className="h-3.5 w-3.5" />
									</span>
								)}
							</div>
							<div className="flex flex-col gap-0.5">
								<h4 className="-tracking-[0.01em] truncate font-semibold text-[0.875rem] text-foreground leading-tight">
									{fullName}
								</h4>
								<p className="truncate text-foreground/55 text-xs">
									{c.character.occupationLabel}
								</p>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
