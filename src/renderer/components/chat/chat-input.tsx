import { ArrowUp } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
	disabled?: boolean;
	onSend: (message: string) => void;
	placeholder?: string;
}

export function ChatInput({
	onSend,
	disabled,
	placeholder = "Describe your character concept...",
}: ChatInputProps) {
	const [value, setValue] = useState("");

	function handleSend() {
		if (!value.trim() || disabled) {
			return;
		}
		onSend(value.trim());
		setValue("");
	}

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	return (
		<div className="relative flex items-end gap-2 rounded-xl bg-muted p-1.5 ring-1 ring-foreground/10 transition-shadow duration-250 ease-out focus-within:glow-xs focus-within:ring-primary/40">
			<Textarea
				className="min-h-[44px] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none ring-0 placeholder:text-muted-foreground/70 focus-visible:ring-0"
				disabled={disabled}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				rows={1}
				value={value}
			/>
			<Button
				aria-label="Send"
				className={cn(
					"h-8 w-8 shrink-0 rounded-lg",
					value.trim() && !disabled && "glow-sm",
				)}
				disabled={!value.trim() || disabled}
				onClick={handleSend}
				size="icon"
			>
				<ArrowUp className="h-4 w-4" />
			</Button>
		</div>
	);
}
