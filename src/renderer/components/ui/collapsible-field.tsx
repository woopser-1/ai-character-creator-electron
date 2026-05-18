import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

interface CollapsibleFieldProps {
	label: string;
	value: string;
	icon?: React.ReactNode;
	mono?: boolean;
	maxHeight?: number;
}

export function CollapsibleField({
	label,
	value,
	icon,
	mono,
	maxHeight = 96,
}: CollapsibleFieldProps) {
	const { copied, copy } = useCopyToClipboard();
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

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
					<CopyButton
						className="opacity-0 transition-opacity group-hover:opacity-100"
						value={value}
					/>
				</div>
			)}
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
		</div>
	);
}
