import { Check, Wand2 } from "lucide-react";
import { useState } from "react";
import {
	AUTOPILOT_SENTINEL,
	AutopilotBadge,
	isAutopilot,
} from "@/components/tools/autopilot-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ToolSuggestOptionsProps {
	onSubmit: (result: string) => void;
	options: string[];
	question: string;
	submitted?: boolean;
	submittedValue?: string;
}

export function ToolSuggestOptions({
	question,
	options,
	onSubmit,
	submitted,
	submittedValue,
}: ToolSuggestOptionsProps) {
	const [selected, setSelected] = useState<string | null>(null);
	const [customMode, setCustomMode] = useState(false);
	const [customValue, setCustomValue] = useState("");

	if (submitted) {
		return (
			<div className="rounded-xl bg-muted p-4 ring-1 ring-foreground/10">
				<p className="mb-2.5 text-muted-foreground text-sm">{question}</p>
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
			<p className="font-medium text-sm">{question}</p>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => (
					<button
						className={cn(
							"rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
							selected === option
								? "bg-secondary text-foreground glow-ring"
								: "bg-secondary text-foreground/85 ring-1 ring-foreground/10 hover:glow-xs hover:text-foreground hover:ring-foreground/20",
						)}
						key={option}
						onClick={() => {
							setSelected(option);
							setCustomMode(false);
						}}
						type="button"
					>
						{option}
					</button>
				))}
				<button
					className={cn(
						"rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
						customMode
							? "bg-secondary text-foreground glow-ring"
							: "border border-foreground/20 border-dashed bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
					)}
					onClick={() => {
						setCustomMode(true);
						setSelected(null);
					}}
					type="button"
				>
					Custom…
				</button>
			</div>

			{customMode && (
				<Input
					autoFocus
					onChange={(e) => setCustomValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && customValue.trim()) {
							onSubmit(customValue.trim());
						}
					}}
					placeholder="Type your own answer…"
					value={customValue}
				/>
			)}

			<div className="flex gap-2">
				<Button
					disabled={!(selected || (customMode && customValue.trim()))}
					onClick={() => {
						if (customMode && customValue.trim()) {
							onSubmit(customValue.trim());
						} else if (selected) {
							onSubmit(selected);
						}
					}}
					size="sm"
				>
					Confirm
				</Button>
				{options.length > 0 && (
					<Button
						onClick={() => onSubmit(AUTOPILOT_SENTINEL)}
						size="sm"
						variant="outline"
					>
						<Wand2 className="mr-1 h-3 w-3" />
						Let AI decide
					</Button>
				)}
			</div>
		</div>
	);
}
