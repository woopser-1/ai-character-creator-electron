import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CreateToolbarProps {
	/** Editorial stamp at the far left ("Studio", etc.). */
	mark?: string;
	/** Steps in order. Active and done are derived from indices. */
	steps: ReadonlyArray<{ id: string; label: string }>;
	activeIndex: number;
	doneCount: number;
	/** Quiet status line shown next to the active step ("drafting…"). */
	status?: string;
	/** Keyed for AnimatePresence on status changes. Defaults to status string. */
	statusKey?: string;
	/** Configuration pills cluster (Difficulty, Reply length, Image model). */
	config?: ReactNode;
	/** Reset / primary destructive action, rendered as-is at the far right. */
	reset?: ReactNode;
	className?: string;
}

export function CreateToolbar({
	mark = "Studio",
	steps,
	activeIndex,
	doneCount,
	status,
	statusKey,
	config,
	reset,
	className,
}: CreateToolbarProps) {
	return (
		<motion.div
			animate={{ y: 0, opacity: 1 }}
			className={cn(
				"relative border-border border-b bg-background/85 backdrop-blur-md",
				"[background-image:radial-gradient(ellipse_220px_60px_at_var(--rail-pad-left,1.5rem)_50%,oklch(0.72_0.25_305_/_0.12),transparent_70%)]",
				className,
			)}
			initial={{ y: -4, opacity: 0 }}
			transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
		>
			<div className="chrome-rail @container/toolbar py-2.5">
				<div className="flex min-h-9 items-center justify-between gap-4 @[54rem]/toolbar:min-h-12 @[54rem]/toolbar:gap-6">
					<div className="flex min-w-0 flex-1 items-center gap-3 @[54rem]/toolbar:gap-4">
						<span className="eyebrow hidden shrink-0 text-foreground/55 @[20rem]/toolbar:inline">
							{mark}
						</span>
						<span
							aria-hidden
							className="hidden h-3.5 w-px shrink-0 bg-foreground/15 @[20rem]/toolbar:block"
						/>
						<ConsoleStepper
							activeIndex={activeIndex}
							doneCount={doneCount}
							status={status}
							statusKey={statusKey}
							steps={steps}
						/>
					</div>
					<div className="flex shrink-0 items-center gap-3">
						{config && (
							<div className="hidden items-center gap-2 @[54rem]/toolbar:flex">
								<span className="eyebrow text-foreground/45">Tune</span>
								<div className="flex items-center gap-1.5">{config}</div>
							</div>
						)}
						{config && reset && (
							<span
								aria-hidden
								className="hidden h-3.5 w-px bg-foreground/15 @[54rem]/toolbar:block"
							/>
						)}
						{reset}
					</div>
				</div>
				{config && (
					<div className="mt-2 flex items-center gap-2 border-foreground/8 border-t pt-2 @[54rem]/toolbar:hidden">
						<span className="eyebrow shrink-0 text-foreground/45">Tune</span>
						<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
							{config}
						</div>
					</div>
				)}
			</div>
		</motion.div>
	);
}

function ConsoleStepper({
	steps,
	activeIndex,
	doneCount,
	status,
	statusKey,
}: {
	steps: ReadonlyArray<{ id: string; label: string }>;
	activeIndex: number;
	doneCount: number;
	status?: string;
	statusKey?: string;
}) {
	return (
		<ol className="flex min-w-0 items-center gap-1.5">
			{steps.map((step, i) => {
				const done = i < doneCount;
				const active = i === activeIndex && !done;
				return (
					<li
						className={cn(
							"flex items-center gap-1.5",
							active ? "min-w-0 flex-shrink" : "shrink-0",
						)}
						key={step.id}
					>
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className={cn(
								"relative inline-flex min-w-0 items-center gap-2",
								done && "text-foreground/65",
								active && "text-foreground",
								!done && !active && "text-foreground/35",
							)}
							initial={{ opacity: 0, y: 2 }}
							transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
						>
							<span
								className={cn(
									"relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
									done && "bg-primary/15 text-primary",
									active && "text-primary",
								)}
							>
								<AnimatePresence initial={false} mode="wait">
									{done ? (
										<motion.span
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0, scale: 0.8 }}
											initial={{ opacity: 0, scale: 0.8 }}
											key="check"
											transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
										>
											<Check className="h-3 w-3" strokeWidth={3} />
										</motion.span>
									) : (
										<motion.span
											animate={{ opacity: 1 }}
											className="display-figure text-[0.7rem] leading-none tabular-nums"
											exit={{ opacity: 0 }}
											initial={{ opacity: 0 }}
											key="num"
										>
											{String(i + 1).padStart(2, "0")}
										</motion.span>
									)}
								</AnimatePresence>
								{active && (
									<motion.span
										aria-hidden
										className="-z-10 absolute inset-0 rounded-full bg-primary/10 ring-1 ring-primary/30 glow-xs"
										layoutId="create-toolbar-active-pill"
										transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
									/>
								)}
							</span>
							<span
								className={cn(
									"-tracking-[0.005em] truncate font-semibold text-[0.875rem] leading-none",
									!active && !done && "hidden @[26rem]/toolbar:inline",
								)}
							>
								{step.label}
							</span>
							{active && status && (
								<span className="ml-2 hidden min-w-0 items-center @[32rem]/toolbar:flex">
									<span
										aria-hidden
										className="mr-2 inline-block h-1 w-1 shrink-0 rounded-full bg-foreground/25"
									/>
									<span className="relative min-w-0 flex-1 overflow-hidden">
										<AnimatePresence initial={false} mode="wait">
											<motion.span
												animate={{ opacity: 1, y: 0 }}
												className="block truncate font-medium text-[11px] text-foreground/55 uppercase tracking-[0.16em]"
												exit={{ opacity: 0, y: -3 }}
												initial={{ opacity: 0, y: 3 }}
												key={statusKey ?? status}
												transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
											>
												{status}
											</motion.span>
										</AnimatePresence>
									</span>
								</span>
							)}
						</motion.div>
						{i < steps.length - 1 && (
							<span
								aria-hidden
								className="relative h-px w-5 shrink-0 overflow-hidden bg-foreground/10"
							>
								<motion.span
									animate={{ scaleX: done ? 1 : 0 }}
									className="block h-full origin-left bg-primary/60"
									initial={{ scaleX: 0 }}
									transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
								/>
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}
