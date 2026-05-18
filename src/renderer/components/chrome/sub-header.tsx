import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SubHeaderProps {
	icon: ReactNode;
	title: string;
	/** Keyed for AnimatePresence phase swap. Defaults to the subtitle string itself. */
	subtitle: string;
	subtitleKey?: string;
	stepper?: ReactNode;
	actions?: ReactNode;
	className?: string;
}

export function SubHeader({
	icon,
	title,
	subtitle,
	subtitleKey,
	stepper,
	actions,
	className,
}: SubHeaderProps) {
	return (
		<motion.div
			animate={{ y: 0, opacity: 1 }}
			className={cn(
				"relative border-border border-b bg-background/85 backdrop-blur-md",
				"[background-image:radial-gradient(ellipse_120px_50px_at_var(--rail-pad-left,1.5rem)_50%,oklch(0.72_0.25_305_/_0.12),transparent_70%)]",
				className,
			)}
			initial={{ y: -4, opacity: 0 }}
			transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
		>
			<div className="chrome-rail flex items-center justify-between gap-4 py-2.5">
				<div className="flex min-w-0 items-center gap-3">
					<div className="glow-xs flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground ring-1 ring-primary/20">
						{icon}
					</div>
					<div className="min-w-0">
						<h1 className="truncate font-semibold text-sm tracking-tight">
							{title}
						</h1>
						<div className="relative h-4">
							<AnimatePresence initial={false} mode="wait">
								<motion.p
									animate={{ opacity: 1, y: 0 }}
									className="absolute inset-0 truncate text-muted-foreground text-xs"
									exit={{ opacity: 0, y: -3 }}
									initial={{ opacity: 0, y: 3 }}
									key={subtitleKey ?? subtitle}
									transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
								>
									{subtitle}
								</motion.p>
							</AnimatePresence>
						</div>
					</div>
				</div>
				{stepper && <div className="hidden shrink-0 md:block">{stepper}</div>}
				{actions && (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				)}
			</div>
		</motion.div>
	);
}
