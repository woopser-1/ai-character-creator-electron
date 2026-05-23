import { Check, Plus, Wand2, X } from "lucide-react";
import { useState } from "react";
import {
	AUTOPILOT_SENTINEL,
	AutopilotBadge,
	isAutopilot,
} from "@/components/tools/autopilot-badge";
import { ToolRewindButton } from "@/components/tools/tool-rewind-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ToolSelectMultipleProps {
	onSubmit: (result: string) => void;
	options: string[];
	question: string;
	submitted?: boolean;
	submittedValue?: string;
	onRewind?: () => void;
}

export function ToolSelectMultiple({
	question,
	options,
	onSubmit,
	submitted,
	submittedValue,
	onRewind,
}: ToolSelectMultipleProps) {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [customItems, setCustomItems] = useState<string[]>([]);
	const [customInput, setCustomInput] = useState("");
	const [showCustomInput, setShowCustomInput] = useState(false);

	const allOptions = [...options, ...customItems];

	function toggle(option: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(option)) {
				next.delete(option);
			} else {
				next.add(option);
			}
			return next;
		});
	}

	function addCustomItem() {
		const trimmed = customInput.trim();
		if (!trimmed || allOptions.includes(trimmed)) {
			return;
		}
		setCustomItems((prev) => [...prev, trimmed]);
		setSelected((prev) => new Set(prev).add(trimmed));
		setCustomInput("");
	}

	function removeCustomItem(item: string) {
		setCustomItems((prev) => prev.filter((i) => i !== item));
		setSelected((prev) => {
			const next = new Set(prev);
			next.delete(item);
			return next;
		});
	}

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
					<div className="flex flex-wrap gap-1.5">
						{(submittedValue ?? "")
							.split("\n")
							.map((v) => v.trim())
							.filter(Boolean)
							.map((v) => (
								<span
									className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-medium text-foreground text-xs ring-1 ring-primary/30"
									key={v}
								>
									<Check className="h-2.5 w-2.5 text-primary" />
									{v}
								</span>
							))}
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
			<div className="flex flex-wrap gap-2">
				{options.map((option) => (
					<button
						className={cn(
							"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
							selected.has(option)
								? "bg-secondary text-foreground glow-ring"
								: "bg-secondary text-foreground/85 ring-1 ring-foreground/10 hover:glow-xs hover:text-foreground hover:ring-foreground/20",
						)}
						key={option}
						onClick={() => toggle(option)}
						type="button"
					>
						{selected.has(option) && <Check className="h-3 w-3 text-primary" />}
						{option}
					</button>
				))}
				{customItems.map((item) => (
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-150 ease-out",
							selected.has(item)
								? "bg-secondary text-foreground glow-ring"
								: "bg-secondary text-foreground/85 ring-1 ring-foreground/10 hover:glow-xs hover:text-foreground hover:ring-foreground/20",
						)}
						key={item}
					>
						<button
							className="inline-flex items-center gap-1.5"
							onClick={() => toggle(item)}
							type="button"
						>
							{selected.has(item) && <Check className="h-3 w-3 text-primary" />}
							{item}
						</button>
						<button
							aria-label={`Remove ${item}`}
							className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
							onClick={() => removeCustomItem(item)}
							type="button"
						>
							<X className="h-2.5 w-2.5" />
						</button>
					</span>
				))}
				<button
					className={cn(
						"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
						showCustomInput
							? "bg-secondary text-foreground glow-ring"
							: "border border-foreground/20 border-dashed bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
					)}
					onClick={() => setShowCustomInput(!showCustomInput)}
					type="button"
				>
					<Plus className="h-3 w-3" />
					Add custom
				</button>
			</div>

			{showCustomInput && (
				<div className="flex gap-2">
					<Input
						autoFocus
						onChange={(e) => setCustomInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && customInput.trim()) {
								addCustomItem();
							}
						}}
						placeholder="Type a custom option and press Enter…"
						value={customInput}
					/>
					<Button
						disabled={!customInput.trim()}
						onClick={addCustomItem}
						size="sm"
						variant="outline"
					>
						Add
					</Button>
				</div>
			)}

			<div className="flex gap-2">
				<Button
					disabled={selected.size === 0}
					onClick={() => {
						const result = Array.from(selected).join("\n");
						onSubmit(result || "None selected");
					}}
					size="sm"
				>
					Confirm ({selected.size} selected)
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
