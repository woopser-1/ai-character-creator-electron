import { Wand2 } from "lucide-react";
import { useState } from "react";
import { AUTOPILOT_SENTINEL } from "@/components/tools/autopilot-badge";
import { ToolFrame } from "@/components/tools/tool-frame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ToolAskUserProps {
	onSubmit: (result: string) => void;
	question: string;
	submitted?: boolean;
	submittedValue?: string;
	onRewind?: () => void;
}

export function ToolAskUser({
	question,
	onSubmit,
	submitted,
	submittedValue,
	onRewind,
}: ToolAskUserProps) {
	const [value, setValue] = useState("");

	return (
		<ToolFrame
			answeredView={<p className="text-sm">{submittedValue}</p>}
			onRewind={onRewind}
			question={question}
			submitted={submitted}
			submittedValue={submittedValue}
		>
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
		</ToolFrame>
	);
}
