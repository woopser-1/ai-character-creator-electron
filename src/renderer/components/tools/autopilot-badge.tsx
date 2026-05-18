import { Wand2 } from "lucide-react";

export const AUTOPILOT_SENTINEL = "__AUTOPILOT__";

interface AutopilotBadgeProps {
	label?: string;
}

export function AutopilotBadge({
	label = "Let AI decide",
}: AutopilotBadgeProps) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 font-medium text-foreground text-sm italic ring-1 ring-primary/30">
			<Wand2 className="h-3 w-3 text-primary" />
			{label}
		</span>
	);
}

export function isAutopilot(value: string | undefined | null): boolean {
	return value === AUTOPILOT_SENTINEL;
}
