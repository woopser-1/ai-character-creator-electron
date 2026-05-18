import { Popover } from "@base-ui/react/popover";
import { Check, MessageSquare } from "lucide-react";
import {
	MESSAGE_LENGTH_META,
	MESSAGE_LENGTHS,
	type MessageLength,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageLengthPillProps {
	value: MessageLength;
	onChange?: (next: MessageLength) => void;
	readOnly?: boolean;
}

const PILL_BASE =
	"inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 font-medium text-muted-foreground text-xs outline-none transition-all duration-200 ease-out hover:text-foreground hover:glow-xs focus-visible:ring-3 focus-visible:ring-primary/40 aria-expanded:text-foreground aria-expanded:glow-ring";

export function MessageLengthPill({
	value,
	onChange,
	readOnly,
}: MessageLengthPillProps) {
	const meta = MESSAGE_LENGTH_META[value];

	if (readOnly || !onChange) {
		return (
			<div className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 font-medium text-muted-foreground text-xs">
				<MessageSquare className="h-3 w-3" />
				{meta.label}
			</div>
		);
	}

	return (
		<Popover.Root>
			<Popover.Trigger className={PILL_BASE}>
				<MessageSquare className="h-3 w-3" />
				{meta.label}
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Positioner align="end" sideOffset={8}>
					<Popover.Popup className="origin-top-right glow-rim rounded-xl bg-popover/95 backdrop-blur-2xl data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[starting-style]:scale-[0.98] transition-all duration-200 ease-out">
						<div className="w-64 p-1.5">
							<div className="px-2 pt-1 pb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
								Reply length
							</div>
							{MESSAGE_LENGTHS.map((len) => {
								const m = MESSAGE_LENGTH_META[len];
								const selected = len === value;
								return (
									<Popover.Close
										className={cn(
											"flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ease-out hover:bg-muted",
											selected && "bg-muted",
										)}
										key={len}
										onClick={() => onChange(len)}
									>
										<div
											className={cn(
												"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
												selected
													? "bg-primary text-primary-foreground"
													: "bg-secondary text-transparent",
											)}
										>
											<Check className="h-2.5 w-2.5" strokeWidth={3} />
										</div>
										<div className="min-w-0 flex-1">
											<div
												className={cn(
													"font-medium text-xs",
													selected ? "text-foreground" : "text-foreground/85",
												)}
											>
												{m.label}{" "}
												<span className="font-normal text-[10px] text-muted-foreground">
													({m.sentenceRange} sentences)
												</span>
											</div>
											<div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
												{m.description}
											</div>
										</div>
									</Popover.Close>
								);
							})}
						</div>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
}
