import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutopilotPillProps {
	enabled: boolean;
	onToggle: (next: boolean) => void;
	disabled?: boolean;
}

const PILL_BASE =
	"inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium text-xs outline-none transition-all duration-200 ease-out hover:glow-xs focus-visible:ring-3 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

export function AutopilotPill({
	enabled,
	onToggle,
	disabled,
}: AutopilotPillProps) {
	return (
		<button
			aria-pressed={enabled}
			className={cn(
				PILL_BASE,
				enabled
					? "glow-ring bg-secondary text-foreground"
					: "bg-secondary text-muted-foreground hover:text-foreground",
			)}
			disabled={disabled}
			onClick={() => onToggle(!enabled)}
			title={
				enabled
					? "Autopilot is on. The AI answers every question for you."
					: "Turn on Autopilot to let the AI answer every question."
			}
			type="button"
		>
			<Wand2 className="h-3 w-3" />
			Autopilot{enabled ? ", on" : ""}
		</button>
	);
}
