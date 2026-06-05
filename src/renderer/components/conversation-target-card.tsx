import { Users } from "lucide-react";
import type { ReactNode } from "react";
import {
	initials,
	type ConversationTarget,
	type ConversationTargetParticipant,
} from "@/lib/conversation-target";
import { cn } from "@/lib/utils";

interface ConversationTargetCardProps {
	target: ConversationTarget;
	index: number;
	actions?: ReactNode;
}

const MAX_VISIBLE_TILES = 4;

export function ConversationTargetCard({
	target,
	index,
	actions,
}: ConversationTargetCardProps) {
	const number = String(index + 1).padStart(2, "0");
	const accessibleLabel = `Open ${target.kind === "character" ? "character" : "group chat"}: ${target.title}`;

	return (
		<a
			aria-label={accessibleLabel}
			className={cn(
				"group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-card outline-none ring-1 ring-foreground/10",
				"transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
				"hover:ring-transparent hover:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.35),0_0_32px_oklch(0.72_0.25_305_/_0.16)]",
				"focus-visible:ring-3 focus-visible:ring-ring/50",
			)}
			href={target.href}
		>
			<TargetCover target={target} />

			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/36 to-transparent transition-opacity duration-300 ease-out group-hover:from-background"
			/>

			<span
				aria-hidden
				className="absolute top-3.5 left-4 z-10 font-medium text-[10.5px] text-foreground/65 uppercase tracking-[0.22em] tabular-nums mix-blend-luminosity"
			>
				N° {number}
			</span>

			{target.statusLabel && (
				<span className="absolute top-3.5 right-4 z-10 font-medium text-[10.5px] text-foreground/45 uppercase tracking-[0.22em]">
					{target.statusLabel}
				</span>
			)}

			{actions}

			<div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 sm:p-5">
				<span className="eyebrow">{target.eyebrow}</span>
				<h3 className="-tracking-[0.02em] line-clamp-2 font-semibold text-[1.35rem] text-foreground leading-[1.05] sm:text-[1.5rem]">
					{target.title}
				</h3>
				<p className="line-clamp-2 text-[0.8125rem] text-foreground/70 leading-snug">
					{target.description}
				</p>
				<div className="mt-1 flex min-w-0 items-center gap-2 text-[10.5px] text-foreground/55 leading-none">
					{target.stats.map((stat, statIndex) => (
						<span
							className={cn(
								"inline-flex min-w-0 items-center gap-1",
								statIndex === target.stats.length - 1
									? "ml-auto shrink-0 text-foreground/45"
									: "shrink-0 font-medium uppercase tracking-[0.18em] text-foreground/65",
							)}
							key={`${target.id}-${stat.label}-${statIndex}`}
							title={stat.title}
						>
							{stat.icon === "users" && <Users className="h-3 w-3" />}
							<span className="truncate tabular-nums">{stat.label}</span>
						</span>
					))}
				</div>
			</div>
		</a>
	);
}

function TargetCover({ target }: { target: ConversationTarget }) {
	if (target.kind === "group-chat") {
		return (
			<MosaicCover
				missingCount={target.missingParticipantCount ?? 0}
				participants={target.participants}
			/>
		);
	}

	if (target.coverImageUrl) {
		return (
			<img
				alt={target.title}
				className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
				loading="lazy"
				src={target.coverImageUrl}
			/>
		);
	}

	return (
		<div className="absolute inset-0 flex items-center justify-center bg-card">
			<span
				aria-hidden
				className="display-figure pointer-events-none select-none text-[5.5rem] text-foreground/12 leading-[0.8] sm:text-[6.5rem]"
			>
				{target.fallbackLabel}
			</span>
		</div>
	);
}

function MosaicCover({
	participants,
	missingCount,
}: {
	participants: ConversationTargetParticipant[];
	missingCount: number;
}) {
	const visible = participants.slice(0, MAX_VISIBLE_TILES);
	const remainder = participants.length - visible.length + missingCount;

	if (visible.length === 0) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-secondary/40">
				<Users className="h-10 w-10 text-foreground/25" />
			</div>
		);
	}

	return (
		<div aria-hidden className="absolute inset-0 flex">
			{visible.map((participant, idx) => {
				const isLastVisible = idx === visible.length - 1 && remainder > 0;

				return (
					<div
						className="relative flex-1 overflow-hidden bg-secondary/60 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
						key={participant.id ?? `${participant.name}-${idx}`}
					>
						{participant.imageUrl ? (
							<img
								alt={participant.name}
								className="absolute inset-0 h-full w-full object-cover"
								loading="lazy"
								src={participant.imageUrl}
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center">
								<span
									aria-hidden
									className="display-figure pointer-events-none select-none font-medium text-[2.25rem] text-foreground/25 leading-none"
								>
									{initials(participant.name) || "·"}
								</span>
							</div>
						)}
						{idx < visible.length - 1 && (
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
		</div>
	);
}
