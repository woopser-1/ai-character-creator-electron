import { UploadCloud } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { ConversationTargetCard } from "@/components/conversation-target-card";
import type { ConversationTarget } from "@/lib/conversation-target";

interface ConversationLibraryPageProps {
	actions: ReactNode;
	countLabel: string;
	empty: ReactNode;
	loaded: boolean;
	mobileLabel: string;
	onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
	onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
	onDragOver: (event: DragEvent<HTMLDivElement>) => void;
	onDrop: (event: DragEvent<HTMLDivElement>) => void;
	pageDragOver: boolean;
	renderActions?: (target: ConversationTarget) => ReactNode;
	targets: ConversationTarget[];
	title: string;
}

export function ConversationLibraryPage({
	actions,
	countLabel,
	empty,
	loaded,
	mobileLabel,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
	pageDragOver,
	renderActions,
	targets,
	title,
}: ConversationLibraryPageProps) {
	if (!loaded) {
		return <LoadingDots />;
	}

	if (targets.length === 0) {
		return (
			<div
				className="relative flex min-h-0 flex-1 flex-col"
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
				onDragOver={onDragOver}
				onDrop={onDrop}
			>
				{empty}
				<ConversationDragOverlay show={pageDragOver} />
			</div>
		);
	}

	return (
		<div
			className="relative mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14"
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			<ConversationLibraryMasthead
				actions={actions}
				count={targets.length}
				countLabel={countLabel}
				mobileLabel={mobileLabel}
				title={title}
			/>

			<div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
				{targets.map((target, index) => (
					<ConversationTargetCard
						actions={renderActions?.(target)}
						index={index}
						key={target.id}
						target={target}
					/>
				))}
			</div>

			<ConversationDragOverlay show={pageDragOver} />
		</div>
	);
}

function ConversationLibraryMasthead({
	actions,
	count,
	countLabel,
	mobileLabel,
	title,
}: {
	actions: ReactNode;
	count: number;
	countLabel: string;
	mobileLabel: string;
	title: string;
}) {
	return (
		<header className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr_auto] sm:items-end sm:gap-10">
			<div className="flex items-end gap-5">
				<span
					aria-hidden
					className="display-figure text-[5.5rem] text-foreground leading-[0.85] sm:text-[6.5rem]"
				>
					{String(count).padStart(2, "0")}
				</span>
				<div className="pb-3">
					<div className="eyebrow text-foreground/55">{title}</div>
					<div className="mt-1.5 text-[0.8125rem] text-muted-foreground">
						{countLabel}
					</div>
				</div>
			</div>
			<div
				aria-hidden
				className="hidden h-px self-end bg-gradient-to-r from-foreground/15 via-foreground/8 to-transparent sm:block sm:mb-5"
			/>
			<div className="flex items-center justify-between gap-2 sm:justify-end sm:pb-3">
				<span className="font-medium text-[10.5px] text-foreground/45 uppercase tracking-[0.22em] sm:hidden">
					{mobileLabel}
				</span>
				<div className="flex items-center gap-1.5">{actions}</div>
			</div>
		</header>
	);
}

export function ConversationDragOverlay({ show }: { show: boolean }) {
	if (!show) return null;

	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-3xl bg-background/55 backdrop-blur-[2px] ring-2 ring-[oklch(0.8_0.28_303/0.55)] [box-shadow:0_0_0_1px_oklch(0.8_0.28_303/0.4),0_0_48px_oklch(0.72_0.25_305/0.28)] animate-in fade-in-0"
		>
			<div className="flex flex-col items-center gap-3 rounded-2xl bg-popover/90 px-6 py-5 ring-1 ring-foreground/12 backdrop-blur-2xl">
				<span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
					<UploadCloud className="h-5 w-5" />
				</span>
				<div className="text-center">
					<div className="-tracking-[0.005em] font-semibold text-[1rem] text-foreground leading-tight">
						Release to import
					</div>
					<div className="mt-1 text-[0.8125rem] text-muted-foreground">
						Files will open with the result
					</div>
				</div>
			</div>
		</div>
	);
}

export function LoadingDots() {
	return (
		<div className="flex min-h-0 flex-1 items-center justify-center">
			<div className="flex items-center gap-1.5">
				<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
				<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
				<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
			</div>
		</div>
	);
}
