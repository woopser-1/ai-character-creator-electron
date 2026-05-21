import {
	Check,
	ChevronDown,
	ChevronUp,
	Loader2,
	Pencil,
	X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export type CollapsibleFieldSaveResult =
	| { success: true }
	| { success: false; error: string };

interface CollapsibleFieldProps {
	label: string;
	value: string;
	icon?: React.ReactNode;
	mono?: boolean;
	maxHeight?: number;
	onSave?: (next: string) => Promise<CollapsibleFieldSaveResult>;
}

export function CollapsibleField({
	label,
	value,
	icon,
	mono,
	maxHeight = 96,
	onSave,
}: CollapsibleFieldProps) {
	const { copied, copy } = useCopyToClipboard();
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const startEdit = () => {
		setDraft(value);
		setError(null);
		setEditing(true);
	};
	const cancelEdit = () => {
		setEditing(false);
		setError(null);
		setSaving(false);
	};
	const submitEdit = async () => {
		if (!onSave) return;
		if (draft.trim().length === 0) {
			setError("Value cannot be empty");
			return;
		}
		if (draft === value) {
			setEditing(false);
			return;
		}
		setSaving(true);
		setError(null);
		const res = await onSave(draft);
		setSaving(false);
		if (res.success) {
			setEditing(false);
		} else {
			setError(res.error);
		}
	};

	useLayoutEffect(() => {
		const el = contentRef.current;
		if (!el) return;
		setOverflows(el.scrollHeight > maxHeight + 1);
	}, [maxHeight]);

	useEffect(() => {
		const el = contentRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			setOverflows(el.scrollHeight > maxHeight + 1);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [maxHeight]);

	const collapsed = !expanded && overflows;

	const approxRows = Math.min(20, Math.max(4, draft.split("\n").length + 1));

	return (
		<div className="group">
			{label && (
				<div className="mb-1.5 flex items-center justify-between">
					<div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
						{icon}
						{label}
						{copied && (
							<span className="font-medium text-primary text-xs normal-case tracking-normal">
								Copied
							</span>
						)}
					</div>
					{!editing && (
						<div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-within:opacity-100">
							{onSave && (
								<button
									aria-label={`Edit ${label || "value"}`}
									className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									onClick={startEdit}
									type="button"
								>
									<Pencil className="h-3 w-3" />
								</button>
							)}
							<CopyButton value={value} />
						</div>
					)}
				</div>
			)}
			{editing ? (
				<div
					className={cn(
						"rounded-lg ring-1 ring-primary/30",
						mono ? "bg-muted" : "bg-background",
					)}
				>
					<textarea
						autoFocus
						className={cn(
							"block w-full resize-y rounded-t-lg bg-transparent p-3 text-sm leading-relaxed outline-none",
							mono ? "font-mono text-xs text-foreground/90" : "text-foreground",
						)}
						disabled={saving}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault();
								cancelEdit();
							}
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								void submitEdit();
							}
						}}
						rows={approxRows}
						value={draft}
					/>
					<div className="flex items-center justify-between gap-3 border-foreground/10 border-t px-2 py-1.5">
						<span className="pl-1 text-[11px] text-muted-foreground">
							{error ? (
								<span className="text-destructive">{error}</span>
							) : (
								<>
									<kbd className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[10px]">
										⌘
									</kbd>
									<kbd className="ml-0.5 rounded bg-foreground/8 px-1 py-0.5 font-mono text-[10px]">
										↵
									</kbd>
									<span className="ml-1">save · </span>
									<kbd className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[10px]">
										esc
									</kbd>
									<span className="ml-1">cancel</span>
								</>
							)}
						</span>
						<div className="flex items-center gap-1.5">
							<Button
								disabled={saving}
								onClick={cancelEdit}
								size="sm"
								variant="ghost"
							>
								<X className="h-3 w-3" />
								Cancel
							</Button>
							<Button
								disabled={saving}
								onClick={() => void submitEdit()}
								size="sm"
							>
								{saving ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<Check className="h-3 w-3" />
								)}
								{saving ? "Saving…" : "Save"}
							</Button>
						</div>
					</div>
				</div>
			) : (
				<>
					<div className="relative">
						<button
							aria-label={`Copy ${label || "value"}`}
							className={cn(
								"block w-full cursor-pointer overflow-hidden whitespace-pre-wrap text-left text-sm leading-relaxed transition-colors duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary/40",
								mono
									? "rounded-lg bg-muted p-3 font-mono text-xs ring-1 ring-foreground/10 hover:bg-secondary"
									: "-mx-1 rounded-md px-1 hover:bg-muted",
								copied && "ring-1 ring-primary/40",
							)}
							onClick={() => void copy(value)}
							style={collapsed ? { maxHeight: `${maxHeight}px` } : undefined}
							type="button"
						>
							<div ref={contentRef}>{value}</div>
						</button>
						{collapsed && (
							<div
								className={cn(
									"pointer-events-none absolute right-0 bottom-0 left-0 h-10 bg-gradient-to-t to-transparent",
									mono ? "from-muted" : "from-background",
								)}
							/>
						)}
					</div>
					{overflows && (
						<button
							className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-muted-foreground text-xs transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
							onClick={() => setExpanded((v) => !v)}
							type="button"
						>
							{expanded ? (
								<>
									<ChevronUp className="h-3 w-3" />
									Show less
								</>
							) : (
								<>
									<ChevronDown className="h-3 w-3" />
									Show more
								</>
							)}
						</button>
					)}
				</>
			)}
		</div>
	);
}
