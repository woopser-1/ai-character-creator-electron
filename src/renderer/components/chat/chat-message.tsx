import type { UIMessage } from "@shared/chat";
import { Bot, Check, Pencil, RotateCcw, Trash2, User, X } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolAskUser } from "@/components/tools/tool-ask-user";
import { ToolSelectMultiple } from "@/components/tools/tool-select-multiple";
import { ToolSuggestOptions } from "@/components/tools/tool-suggest-options";
import { ToolYesNo } from "@/components/tools/tool-yes-no";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
	addToolOutput: (params: {
		tool: string;
		toolCallId: string;
		output: unknown;
	}) => void;
	message: UIMessage;
	onDelete?: (id: string) => void;
	onEdit?: (id: string, newText: string) => void;
	onRegenerateFrom?: (id: string) => void;
}

function ToolThinkingIndicator() {
	return (
		<div className="flex animate-tool-in items-center gap-2.5 rounded-xl bg-muted px-3.5 py-2.5 ring-1 ring-foreground/10">
			<div className="flex items-center gap-1">
				<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
				<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
				<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
			</div>
			<span className="text-muted-foreground text-xs">
				Preparing a question…
			</span>
		</div>
	);
}

function collectText(message: UIMessage): string {
	return message.parts
		.filter((p) => p.type === "text")
		.map((p) => (p as { text: string }).text)
		.join("");
}

export function ChatMessage({
	message,
	addToolOutput,
	onDelete,
	onEdit,
	onRegenerateFrom,
}: ChatMessageProps) {
	const isUser = message.role === "user";
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");

	const hasText = message.parts.some((p) => p.type === "text");
	const editable = isUser && hasText && !!onEdit;
	const showActions = !!(onDelete || onEdit || onRegenerateFrom) && !editing;

	const handleBeginEdit = () => {
		setDraft(collectText(message));
		setEditing(true);
	};

	const handleSaveEdit = () => {
		const next = draft.trim();
		if (!next) return;
		setEditing(false);
		onEdit?.(message.id, next);
	};

	return (
		<div
			className={cn(
				"group/message relative flex animate-message-in gap-3",
				isUser ? "flex-row-reverse" : "flex-row",
			)}
		>
			<div
				className={cn(
					"flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
					isUser
						? "bg-secondary text-foreground"
						: "bg-secondary text-muted-foreground",
				)}
			>
				{isUser ? (
					<User className="h-3.5 w-3.5" />
				) : (
					<Bot className="h-3.5 w-3.5" />
				)}
			</div>
			<div
				className={cn(
					"relative flex min-w-0 max-w-[85%] flex-col gap-2",
					isUser ? "items-end" : "items-start",
				)}
			>
				{editing ? (
					<div className="flex w-full min-w-[20rem] flex-col gap-2 rounded-xl bg-muted p-2 ring-1 ring-foreground/10">
						<textarea
							className="min-h-[5rem] w-full resize-y rounded-lg bg-background p-2 font-mono text-sm text-foreground outline-none ring-1 ring-foreground/10 transition-shadow duration-150 ease-out focus:ring-3 focus:ring-primary/40"
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
									e.preventDefault();
									handleSaveEdit();
								} else if (e.key === "Escape") {
									e.preventDefault();
									setEditing(false);
								}
							}}
							value={draft}
						/>
						<div className="flex items-center justify-end gap-2">
							<Button
								onClick={() => setEditing(false)}
								size="sm"
								variant="ghost"
							>
								<X className="mr-1 h-3 w-3" />
								Cancel
							</Button>
							<Button onClick={handleSaveEdit} size="sm">
								<Check className="mr-1 h-3 w-3" />
								Save and resend
							</Button>
						</div>
					</div>
				) : (
					message.parts.map((part, i) => {
						const key = `${message.id}-${i}`;

						if (part.type === "text" && part.text.trim()) {
							if (isUser) {
								return (
									<div
										className="whitespace-pre-wrap rounded-xl bg-muted px-3.5 py-2 text-foreground text-sm leading-relaxed ring-1 ring-foreground/10 transition-shadow duration-250 ease-out group-hover/message:[box-shadow:inset_0_0_0_1px_oklch(0.78_0.27_305_/_0.2)]"
										key={key}
									>
										{part.text}
									</div>
								);
							}

							return (
								<div
									className="chat-markdown text-foreground text-sm leading-relaxed"
									key={key}
								>
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{part.text}
									</ReactMarkdown>
								</div>
							);
						}

						if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
							const toolPart = part as {
								type: string;
								toolName?: string;
								toolCallId: string;
								state: string;
								input: Record<string, unknown>;
								output?: unknown;
							};

							const toolName =
								toolPart.toolName ?? part.type.replace("tool-", "");
							const isComplete = toolPart.state === "output-available";
							const input = toolPart.input ?? {};

							const handleSubmit = (result: string) => {
								addToolOutput({
									tool: toolName,
									toolCallId: toolPart.toolCallId,
									output: result,
								});
							};

							if (toolPart.state === "input-streaming") {
								return <ToolThinkingIndicator key={key} />;
							}

							switch (toolName) {
								case "suggestOptions":
									return (
										<ToolSuggestOptions
											key={key}
											onSubmit={handleSubmit}
											options={input.options as string[]}
											question={input.question as string}
											submitted={isComplete}
											submittedValue={
												isComplete ? String(toolPart.output) : undefined
											}
										/>
									);
								case "askUser":
									return (
										<ToolAskUser
											key={key}
											onSubmit={handleSubmit}
											question={input.question as string}
											submitted={isComplete}
											submittedValue={
												isComplete ? String(toolPart.output) : undefined
											}
										/>
									);
								case "askYesNo":
									return (
										<ToolYesNo
											key={key}
											onSubmit={handleSubmit}
											question={input.question as string}
											submitted={isComplete}
											submittedValue={
												isComplete ? String(toolPart.output) : undefined
											}
										/>
									);
								case "selectMultiple":
									return (
										<ToolSelectMultiple
											key={key}
											onSubmit={handleSubmit}
											options={input.options as string[]}
											question={input.question as string}
											submitted={isComplete}
											submittedValue={
												isComplete ? String(toolPart.output) : undefined
											}
										/>
									);
								default:
									return null;
							}
						}

						return null;
					})
				)}

				{showActions && (
					<div
						className={cn(
							"-top-3 absolute z-10 flex items-center gap-0.5 rounded-full bg-popover/95 px-1 py-0.5 opacity-0 ring-1 ring-foreground/10 backdrop-blur-xl transition-opacity duration-150 ease-out group-hover/message:opacity-100",
							isUser ? "right-2" : "left-2",
						)}
					>
						{editable && (
							<button
								aria-label="Edit message"
								className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
								onClick={handleBeginEdit}
								title="Edit and resend"
								type="button"
							>
								<Pencil className="h-3 w-3" />
							</button>
						)}
						{!isUser && onRegenerateFrom && (
							<button
								aria-label="Regenerate from here"
								className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
								onClick={() => onRegenerateFrom(message.id)}
								title="Regenerate from here"
								type="button"
							>
								<RotateCcw className="h-3 w-3" />
							</button>
						)}
						{onDelete && (
							<button
								aria-label="Delete message"
								className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-destructive/15 hover:text-destructive"
								onClick={() => onDelete(message.id)}
								title="Delete message"
								type="button"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
