import { ourdreamChatUrl } from "@shared/ourdream-urls";
import { ExternalLink, MessageCircle } from "lucide-react";
import type { MouseEvent } from "react";
import type { StoredCharacter } from "@/lib/types";
import {
	getFullName,
	getStoredImageModel,
	IMAGE_MODEL_META,
} from "@/lib/types";

interface CharacterCardProps {
	data: StoredCharacter;
	index: number;
}

function openExternal(url: string) {
	return (e: MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		e.stopPropagation();
		window.open(url, "_blank", "noopener,noreferrer");
	};
}

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

function ActionRail({ data }: { data: StoredCharacter }) {
	if (!data.ourdreamUrl) return null;
	return (
		<div
			className="reveal-on-hover absolute top-3 right-3 z-10 flex items-center gap-1.5"
			style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
		>
			<button
				aria-label="Open chat with this character"
				className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/40 backdrop-blur-sm transition-shadow duration-200 ease-out hover:glow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
				onClick={openExternal(ourdreamChatUrl(data.ourdreamUrl))}
				title="Open chat on OurDream"
				type="button"
			>
				<MessageCircle className="h-3.5 w-3.5" />
			</button>
			<button
				aria-label="Open profile on OurDream"
				className="flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-foreground ring-1 ring-foreground/15 backdrop-blur-sm transition-colors duration-150 ease-out hover:bg-background/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
				onClick={openExternal(data.ourdreamUrl)}
				title="Open profile on OurDream"
				type="button"
			>
				<ExternalLink className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

function MetaRail({ data }: { data: StoredCharacter }) {
	const modelLabel = IMAGE_MODEL_META[getStoredImageModel(data)].label;
	return (
		<div className="flex min-w-0 items-center gap-2 text-[10.5px] text-foreground/55 leading-none">
			<span className="font-medium uppercase tracking-[0.18em] tabular-nums">
				{String(data.scenes.length).padStart(2, "0")}
				<span className="ml-1 text-foreground/35">scenes</span>
			</span>
			<span aria-hidden className="h-0.5 w-0.5 shrink-0 rounded-full bg-foreground/25" />
			<span className="shrink-0 tabular-nums">{formatDate(data.createdAt)}</span>
			<span aria-hidden className="h-0.5 w-0.5 shrink-0 rounded-full bg-foreground/25" />
			<span
				className="truncate font-medium uppercase tracking-[0.18em] text-foreground/65"
				title={`Image model: ${modelLabel}`}
			>
				{modelLabel}
			</span>
		</div>
	);
}

export function CharacterCard({ data, index }: CharacterCardProps) {
	const { character } = data;
	const fullName = getFullName(character);
	const occupation = character.occupationLabel;
	const number = String(index + 1).padStart(2, "0");

	if (data.profileImageUrl) {
		return (
			<a
				aria-label={`Open ${fullName}`}
				className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-card outline-none ring-1 ring-foreground/10 transition-all duration-300 ease-out hover:ring-transparent hover:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.35),0_0_28px_oklch(0.72_0.25_305_/_0.15)] focus-visible:ring-3 focus-visible:ring-ring/50"
				href={`#/character/${data.id}`}
			>
				<img
					alt={fullName}
					className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
					loading="lazy"
					src={data.profileImageUrl}
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent transition-opacity duration-300 ease-out group-hover:from-background"
				/>
				<ActionRail data={data} />
				<span
					aria-hidden
					className="absolute top-3 left-3 z-10 font-medium text-[10.5px] text-foreground/55 uppercase tracking-[0.22em] tabular-nums mix-blend-luminosity"
				>
					N° {number}
				</span>
				<div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 sm:p-5">
					<span className="eyebrow">{occupation}</span>
					<h3 className="-tracking-[0.02em] font-semibold text-[1.35rem] text-foreground leading-[1.05] sm:text-[1.5rem]">
						{fullName}
					</h3>
					<div className="mt-1 flex items-center justify-between gap-3">
						<MetaRail data={data} />
						<span
							aria-hidden
							className="font-medium text-[10.5px] text-foreground/40 uppercase tracking-[0.22em] transition-colors duration-200 group-hover:text-primary"
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

	return (
		<a
			aria-label={`Open ${fullName}`}
			className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-2xl bg-card p-5 outline-none ring-1 ring-foreground/10 transition-all duration-300 ease-out hover:ring-transparent hover:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.35),0_0_28px_oklch(0.72_0.25_305_/_0.15)] focus-visible:ring-3 focus-visible:ring-ring/50"
			href={`#/character/${data.id}`}
		>
			<ActionRail data={data} />
			<div className="flex items-start justify-between">
				<span className="eyebrow">N° {number}</span>
				<span className="font-medium text-[10.5px] text-foreground/35 uppercase tracking-[0.22em]">
					Unillustrated
				</span>
			</div>
			<div className="flex flex-1 flex-col justify-center">
				<span
					aria-hidden
					className="display-figure pointer-events-none select-none text-[5.5rem] text-foreground/12 leading-[0.8] sm:text-[6.5rem]"
				>
					{initials(fullName) || "·"}
				</span>
				<span className="mt-3 eyebrow text-foreground/65">{occupation}</span>
				<h3 className="-tracking-[0.02em] mt-1.5 font-semibold text-[1.5rem] text-foreground leading-[1.05]">
					{fullName}
				</h3>
			</div>
			<div className="flex items-center justify-between gap-3 pt-4">
				<MetaRail data={data} />
				<span
					aria-hidden
					className="font-medium text-[10.5px] text-foreground/40 uppercase tracking-[0.22em] transition-colors duration-200 group-hover:text-primary"
				>
					Open
					<span className="ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
						›
					</span>
				</span>
			</div>
		</a>
	);
}
