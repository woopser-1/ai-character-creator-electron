import { Wand2 } from "lucide-react";
import { useState } from "react";
import {
	AUTOPILOT_SENTINEL,
	AutopilotBadge,
	isAutopilot,
} from "@/components/tools/autopilot-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ToolAskUserProps {
	onSubmit: (result: string) => void;
	question: string;
	submitted?: boolean;
	submittedValue?: string;
}

export function ToolAskUser({
	question,
	onSubmit,
	submitted,
	submittedValue,
}: ToolAskUserProps) {
	const [value, setValue] = useState("");

	if (submitted) {
		return (
			<div className="rounded-xl bg-muted p-4 ring-1 ring-foreground/10">
				<p className="mb-2.5 text-muted-foreground text-sm">{question}</p>
				{isAutopilot(submittedValue) ? (
					<AutopilotBadge />
				) : (
					<p className="text-sm">{submittedValue}</p>
				)}
			</div>
		);
	}

	return (
		<div className="animate-tool-in space-y-3 rounded-xl bg-card p-4 glow-rim">
			<p className="font-medium text-sm">{question}</p>
			<Textarea
				onChange={(e) => setValue(e.target.value)}
				placeholder="Type your answer…"
				rows={3}
				value={value}
			/>
			<div className="flex gap-2">
				<Button
					disabled={!value.trim()}
					onClick={() => onSubmit(value.trim())}
					size="sm"
				>
					Submit
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
