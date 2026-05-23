import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolRewindButtonProps {
	onClick: () => void;
	/** When true, the parent tool has an answer — the button reads as "Undo". */
	answered?: boolean;
	className?: string;
}

export function ToolRewindButton({
	onClick,
	answered,
	className,
}: ToolRewindButtonProps) {
	const label = answered ? "Undo answer" : "Rewind here";
	return (
		<button
			aria-label={label}
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground",
				className,
			)}
			onClick={onClick}
			title={
				answered
					? "Discard this answer and let the AI re-ask this question"
					: "Rewind the conversation to right before this question"
			}
			type="button"
		>
			<RotateCcw className="h-3 w-3" />
			<span>{label}</span>
		</button>
	);
}
