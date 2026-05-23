import { Check, Wand2 } from "lucide-react";
import { AUTOPILOT_SENTINEL } from "@/components/tools/autopilot-badge";
import { ToolFrame } from "@/components/tools/tool-frame";
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
	return (
		<ToolFrame
			answeredView={
				<div className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 font-medium text-foreground text-sm ring-1 ring-primary/30">
					<Check className="h-3 w-3 text-primary" />
					{submittedValue}
				</div>
			}
			onRewind={onRewind}
			question={question}
			submitted={submitted}
			submittedValue={submittedValue}
		>
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
		</ToolFrame>
	);
}
