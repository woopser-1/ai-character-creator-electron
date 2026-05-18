import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface StepperStep {
	id: string;
	label: string;
}

interface StepperProps {
	steps: StepperStep[];
	activeIndex: number;
	doneCount: number;
}

export function Stepper({ steps, activeIndex, doneCount }: StepperProps) {
	return (
		<div className="relative flex items-center gap-2">
			{steps.map((step, i) => {
				const done = i < doneCount;
				const active = i === activeIndex && !done;
				return (
					<div className="flex items-center gap-2" key={step.id}>
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className={cn(
								"relative inline-flex items-center gap-2",
								done
									? "text-foreground/70"
									: active
										? "text-foreground"
										: "text-foreground/35",
							)}
							initial={{ opacity: 0, y: 2 }}
							transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
						>
							<span
								className={cn(
									"relative inline-flex h-5 w-5 items-center justify-center rounded-full",
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
											className="display-figure text-[0.75rem] leading-none tabular-nums"
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
										layoutId="stepper-active-pill"
										transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
									/>
								)}
							</span>
							<span
								className={cn(
									"relative font-medium text-[0.75rem] uppercase tracking-[0.16em]",
								)}
							>
								{step.label}
							</span>
						</motion.div>
						{i < steps.length - 1 && (
							<div
								aria-hidden
								className="relative h-px w-6 overflow-hidden bg-foreground/10"
							>
								<motion.div
									animate={{ scaleX: done ? 1 : 0 }}
									className="h-full origin-left bg-primary/60"
									initial={{ scaleX: 0 }}
									transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
								/>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
