import { Check, Wand2 } from "lucide-react";
import {
	AUTOPILOT_SENTINEL,
	AutopilotBadge,
	isAutopilot,
} from "@/components/tools/autopilot-badge";
import { ToolRewindButton } from "@/components/tools/tool-rewind-button";
import { Button } from "@/components/ui/button";

interface ToolYesNoProps {
	onSubmit: (result: string) => void;
	question: string;
	submitted?: boolean;
	submittedValue?: string;
	onRewind?: () => void;
}

export function ToolYesNo({
	question,
	onSubmit,
	submitted,
	submittedValue,
	onRewind,
}: ToolYesNoProps) {
	if (submitted) {
		return (
			<div className="rounded-xl bg-muted p-4 ring-1 ring-foreground/10">
				<div className="mb-2.5 flex items-start justify-between gap-2">
					<p className="text-muted-foreground text-sm">{question}</p>
					{onRewind && <ToolRewindButton answered onClick={onRewind} />}
				</div>
				{isAutopilot(submittedValue) ? (
					<AutopilotBadge />
				) : (
					<div className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 font-medium text-foreground text-sm ring-1 ring-primary/30">
						<Check className="h-3 w-3 text-primary" />
						{submittedValue}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="animate-tool-in space-y-3 rounded-xl bg-card p-4 glow-rim">
			<div className="flex items-start justify-between gap-2">
				<p className="font-medium text-sm">{question}</p>
				{onRewind && <ToolRewindButton onClick={onRewind} />}
			</div>
			<div className="flex gap-2">
				<Button onClick={() => onSubmit("Yes")} size="sm">
					Yes
				</Button>
				<Button onClick={() => onSubmit("No")} size="sm" variant="outline">
					No
				</Button>
				<Button
					onClick={() => onSubmit(AUTOPILOT_SENTINEL)}
					size="sm"
					variant="outline"
				>
					<Wand2 className="mr-1 h-3 w-3" />
					Let AI decide
				</Button>
			</div>
		</div>
	);
}
