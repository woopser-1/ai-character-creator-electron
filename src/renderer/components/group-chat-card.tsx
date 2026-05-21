import { Users } from "lucide-react";
import type { StoredCharacter, StoredGroupChat } from "@/lib/types";
import { getFullName } from "@/lib/types";

interface GroupChatCardProps {
	data: StoredGroupChat;
	charactersById: Map<string, StoredCharacter>;
	index: number;
}

const MAX_VISIBLE_TILES = 4;

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

function formatDate(iso: string | number | Date): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function GroupChatCard({
	data,
	charactersById,
	index,
}: GroupChatCardProps) {
	const number = String(index + 1).padStart(2, "0");
	const members = data.characterIds
		.map((id) => charactersById.get(id))
		.filter((c): c is StoredCharacter => Boolean(c));
	const memberCount = data.characterIds.length;
	const missingCount = memberCount - members.length;

	const visibleTiles = members.slice(0, MAX_VISIBLE_TILES);
	const remainder =
		members.length - visibleTiles.length + (missingCount > 0 ? missingCount : 0);

	return (
		<a
			aria-label={`Open group chat: ${data.groupChat.title}`}
			className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-card outline-none ring-1 ring-foreground/10 transition-all duration-300 ease-out hover:ring-transparent hover:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.35),0_0_28px_oklch(0.72_0.25_305_/_0.15)] focus-visible:ring-3 focus-visible:ring-ring/50"
			href={`#/group-chats/${data.id}`}
		>
			<div
				aria-hidden
				className="absolute inset-0 flex"
			>
				{visibleTiles.map((m, idx) => {
					const name = getFullName(m.character);
					const isLastVisible =
						idx === visibleTiles.length - 1 && remainder > 0;
					return (
						<div
							className="relative flex-1 overflow-hidden bg-secondary/60 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
							key={m.id}
						>
							{m.profileImageUrl ? (
								<img
									alt={name}
									className="absolute inset-0 h-full w-full object-cover"
									loading="lazy"
									src={m.profileImageUrl}
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center">
									<span
										aria-hidden
										className="display-figure pointer-events-none select-none font-medium text-[2.25rem] text-foreground/25 leading-none"
									>
										{initials(name) || "·"}
									</span>
								</div>
							)}
							{idx < visibleTiles.length - 1 && (
								<span
									aria-hidden
									className="absolute inset-y-0 right-0 w-px bg-background/40"
								/>
							)}
							{isLastVisible && (
								<div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
									<span className="font-semibold text-[1.5rem] text-foreground leading-none">
										+{remainder}
									</span>
								</div>
							)}
						</div>
					);
				})}
				{visibleTiles.length === 0 && (
					<div className="flex h-full w-full items-center justify-center bg-secondary/40">
						<Users className="h-10 w-10 text-foreground/25" />
					</div>
				)}
			</div>

			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/35 to-transparent transition-opacity duration-300 ease-out group-hover:from-background"
			/>

			<span
				aria-hidden
				className="absolute top-3 left-3 z-10 font-medium text-[10.5px] text-foreground/65 uppercase tracking-[0.22em] tabular-nums mix-blend-luminosity"
			>
				N° {number}
			</span>
			<span
				aria-hidden
				className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-background/55 px-2 py-0.5 font-medium text-[10.5px] text-foreground/75 uppercase tracking-[0.18em] backdrop-blur-sm ring-1 ring-foreground/10"
			>
				<Users className="h-3 w-3" />
				{memberCount}
			</span>

			<div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-4 sm:p-5">
				<span className="eyebrow text-foreground/70">Group chat</span>
				<h3 className="-tracking-[0.02em] line-clamp-2 font-semibold text-[1.35rem] text-foreground leading-[1.05] sm:text-[1.5rem]">
					{data.groupChat.title}
				</h3>
				<p className="line-clamp-2 text-[0.8125rem] text-foreground/70 leading-relaxed">
					{data.groupChat.publicDescription}
				</p>
				{data.groupChat.tags && data.groupChat.tags.length > 0 && (
					<div className="mt-0.5 flex flex-wrap gap-1">
						{data.groupChat.tags.slice(0, 3).map((tag) => (
							<span
								className="inline-flex items-center rounded-full bg-background/55 px-2 py-0.5 font-medium text-[9.5px] text-foreground/80 uppercase tracking-[0.12em] ring-1 ring-foreground/10 backdrop-blur-sm"
								key={tag}
							>
								{tag}
							</span>
						))}
					</div>
				)}
				<div className="mt-1 flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2 text-[10.5px] text-foreground/55 leading-none">
						<span className="shrink-0 tabular-nums">
							{formatDate(data.createdAt)}
						</span>
						<span
							aria-hidden
							className="h-0.5 w-0.5 shrink-0 rounded-full bg-foreground/25"
						/>
						<span className="truncate font-medium uppercase tracking-[0.18em] text-foreground/65">
							{data.messageLength}
						</span>
					</div>
					<span
						aria-hidden
						className="font-medium text-[10.5px] text-foreground/45 uppercase tracking-[0.22em] transition-colors duration-200 group-hover:text-primary"
					>
						Open
						<span className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
							›
						</span>
					</span>
				</div>
			</div>
		</a>
	);
}
