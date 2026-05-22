// Generic UI parts for the Files-style side sheet. Used by both the
// character Files sheet (`files-sheet.tsx`) and the group-chat Files sheet
// (`group-chats-files-sheet.tsx`). Each consumer brings its own provider,
// its own row renderer, and its own copy strings; the parts in this file
// stay entity-agnostic.

import {
	ArrowDownToLine,
	Folder,
	FolderInput,
	UploadCloud,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	type DragEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { ImportFileOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SheetAsyncState = "idle" | "importing" | "exporting";

export type SheetLogEntry =
	| {
			id: string;
			kind: "import";
			at: number;
			fileOutcomes: ImportFileOutcome[];
			totalCount: number;
	  }
	| {
			id: string;
			kind: "export";
			at: number;
			count: number;
			path: string;
	  }
	| {
			id: string;
			kind: "error";
			at: number;
			message: string;
			fileName?: string;
	  };

export const SHEET_LOG_LIMIT = 8;

export function nowLogId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function relativeTime(at: number): string {
	const seconds = Math.max(1, Math.round((Date.now() - at) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return new Date(at).toLocaleDateString();
}

/**
 * Register a global ⌘<key> toggle for the sheet. The handler runs only when
 * the modifier is held and the lowercase key matches.
 */
export function useGlobalToggleShortcut(
	key: string,
	toggle: () => void,
): void {
	useEffect(() => {
		const lowered = key.toLowerCase();
		const handler = (event: KeyboardEvent) => {
			const meta = event.metaKey || event.ctrlKey;
			if (meta && event.key.toLowerCase() === lowered) {
				event.preventDefault();
				toggle();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [key, toggle]);
}

// ---------------------------------------------------------------------------
// Sheet shell
// ---------------------------------------------------------------------------

export interface LibrarySheetShellProps {
	open: boolean;
	onClose: () => void;
	/** ⌘<shortcutKey> opens/closes the sheet. Shown as a kbd hint in the header. */
	shortcutLabel: string;
	titleCopy: string;
	subtitleCopy: string;
	itemIds: string[];
	selected: Set<string>;
	onSelectedChange: (next: Set<string>) => void;
	onExport: (ids: string[]) => void;
	onDropFiles: (files: FileList | File[]) => void;
	state: SheetAsyncState;
	children: ReactNode;
	bulkSingularLabel: string;
	bulkPluralLabel: string;
}

export function LibrarySheetShell({
	open,
	onClose,
	shortcutLabel,
	titleCopy,
	subtitleCopy,
	itemIds,
	selected,
	onSelectedChange,
	onExport,
	onDropFiles,
	state,
	children,
	bulkSingularLabel,
	bulkPluralLabel,
}: LibrarySheetShellProps) {
	const [dragOver, setDragOver] = useState(false);
	const [dragCount, setDragCount] = useState(0);
	const panelRef = useRef<HTMLDivElement | null>(null);

	// Keyboard handling inside the sheet: Esc, ⌘A, Enter.
	useEffect(() => {
		if (!open) return;
		const handler = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				if (selected.size > 0) {
					onSelectedChange(new Set());
				} else {
					onClose();
				}
				return;
			}
			const meta = event.metaKey || event.ctrlKey;
			if (meta && event.key.toLowerCase() === "a") {
				event.preventDefault();
				onSelectedChange(new Set(itemIds));
				return;
			}
			if (event.key === "Enter" && selected.size > 0) {
				event.preventDefault();
				onExport(Array.from(selected));
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [itemIds, onClose, onExport, onSelectedChange, open, selected]);

	// Focus the panel when it opens so global keys reach it.
	useEffect(() => {
		if (open && panelRef.current) {
			panelRef.current.focus();
		}
	}, [open]);

	const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setDragCount((n) => n + 1);
		setDragOver(true);
	}, []);

	const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setDragCount((n) => {
			const next = Math.max(0, n - 1);
			if (next === 0) setDragOver(false);
			return next;
		});
	}, []);

	const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "copy";
	}, []);

	const handleDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			setDragOver(false);
			setDragCount(0);
			if (event.dataTransfer.files.length > 0) {
				onDropFiles(event.dataTransfer.files);
			}
		},
		[onDropFiles],
	);

	const totalSelected = selected.size;
	void dragCount;

	return (
		<AnimatePresence>
			{open && (
				<div
					aria-label={titleCopy}
					aria-modal="true"
					className="fixed inset-0 z-50 flex justify-end"
					role="dialog"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<motion.div
						animate={{ opacity: 1 }}
						className="absolute inset-0 bg-background/55 backdrop-blur-[2px] [background-image:radial-gradient(ellipse_60%_50%_at_50%_50%,oklch(0.72_0.25_305_/_0.08),transparent_60%)]"
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						onClick={onClose}
						style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
					/>
					<motion.div
						animate={{ x: 0 }}
						className="relative ml-auto flex h-full w-full max-w-[28rem] flex-col overflow-hidden bg-popover outline-none ring-1 ring-foreground/12 [box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.22),0_-40px_120px_oklch(0.72_0.25_305_/_0.12)] sm:max-w-[30rem]"
						exit={{ x: "100%" }}
						initial={{ x: "100%" }}
						onDragEnter={handleDragEnter}
						onDragLeave={handleDragLeave}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
						ref={panelRef}
						style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						tabIndex={-1}
						transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
					>
						<SheetHeader
							onClose={onClose}
							shortcutLabel={shortcutLabel}
							subtitleCopy={subtitleCopy}
							titleCopy={titleCopy}
						/>

						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							{children}
						</div>

						<AnimatePresence>
							{totalSelected > 0 && (
								<BulkFooter
									busy={state === "exporting"}
									count={totalSelected}
									onClear={() => onSelectedChange(new Set())}
									onExport={() => onExport(Array.from(selected))}
									pluralLabel={bulkPluralLabel}
									singularLabel={bulkSingularLabel}
								/>
							)}
						</AnimatePresence>

						<AnimatePresence>
							{dragOver && (
								<motion.div
									animate={{ opacity: 1 }}
									aria-hidden
									className="pointer-events-none absolute inset-2 rounded-2xl ring-2 ring-[oklch(0.8_0.28_303/0.65)] [box-shadow:0_0_0_1px_oklch(0.8_0.28_303/0.5),0_0_48px_oklch(0.72_0.25_305/0.32)]"
									exit={{ opacity: 0 }}
									initial={{ opacity: 0 }}
									transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
								/>
							)}
						</AnimatePresence>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}

function SheetHeader({
	onClose,
	shortcutLabel,
	subtitleCopy,
	titleCopy,
}: {
	onClose: () => void;
	shortcutLabel: string;
	subtitleCopy: string;
	titleCopy: string;
}) {
	return (
		<header className="flex shrink-0 items-center justify-between gap-3 border-foreground/10 border-b px-5 py-4">
			<div className="flex min-w-0 items-center gap-2.5">
				<span
					aria-hidden
					className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground ring-1 ring-foreground/10 glow-xs"
				>
					<Folder className="h-3.5 w-3.5" />
				</span>
				<div className="min-w-0">
					<div className="-tracking-[0.005em] font-semibold text-[0.95rem] text-foreground leading-tight">
						{titleCopy}
					</div>
					<div className="eyebrow text-foreground/55">{subtitleCopy}</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<kbd className="hidden h-6 items-center rounded-md bg-muted px-1.5 font-mono text-[10px] text-muted-foreground ring-1 ring-foreground/10 sm:inline-flex">
					{shortcutLabel}
				</kbd>
				<button
					aria-label={`Close ${titleCopy}`}
					className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/55 transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
					onClick={onClose}
					type="button"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>
		</header>
	);
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

export function DropZone({
	dragOver,
	busy,
	onBrowse,
	idleCopy,
	busyCopy,
	releaseCopy,
	subhead,
}: {
	dragOver: boolean;
	busy: boolean;
	onBrowse: () => void;
	idleCopy: string;
	busyCopy: string;
	releaseCopy: string;
	subhead: string;
}) {
	return (
		<div className="px-5 pt-5 pb-4">
			<button
				className={cn(
					"group/zone relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-foreground/10 border-dashed bg-muted/40 px-5 py-7 text-center outline-none transition-all duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/50",
					dragOver
						? "border-[oklch(0.8_0.28_303/0.65)] bg-primary/8 [box-shadow:0_0_0_1px_oklch(0.8_0.28_303/0.5),0_0_40px_oklch(0.72_0.25_305/0.28)]"
						: "hover:border-foreground/20 hover:bg-muted/55 hover:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305/0.25),0_0_16px_oklch(0.72_0.25_305/0.08)]",
				)}
				disabled={busy}
				onClick={onBrowse}
				type="button"
			>
				<span
					aria-hidden
					className={cn(
						"flex h-9 w-9 items-center justify-center rounded-full bg-secondary ring-1 ring-foreground/10 transition-colors duration-200",
						dragOver && "bg-primary/15 text-primary ring-primary/30",
					)}
				>
					{busy ? (
						<span className="flex items-center gap-1">
							<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary/80" />
							<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary/80 [animation-delay:200ms]" />
							<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary/80 [animation-delay:400ms]" />
						</span>
					) : (
						<UploadCloud className="h-4 w-4" />
					)}
				</span>
				<div className="-tracking-[0.005em] font-semibold text-[0.95rem] text-foreground leading-tight">
					{busy ? busyCopy : dragOver ? releaseCopy : idleCopy}
				</div>
				{!busy && (
					<div className="text-[0.75rem] text-muted-foreground leading-tight">
						{subhead}
					</div>
				)}
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Library table (generic)
// ---------------------------------------------------------------------------

export interface LibraryTableProps<T> {
	items: T[];
	getId: (item: T) => string;
	allSelected: boolean;
	selected: Set<string>;
	onSelectAllChange: (checked: boolean) => void;
	loaded: boolean;
	isEmpty: boolean;
	emptyCopy: string;
	countLabel: string;
	renderRow: (item: T) => ReactNode;
}

export function LibraryTable<T>({
	items,
	getId,
	allSelected,
	selected,
	onSelectAllChange,
	loaded,
	isEmpty,
	emptyCopy,
	countLabel,
	renderRow,
}: LibraryTableProps<T>) {
	if (!loaded) {
		return (
			<div className="flex items-center justify-center px-5 py-10">
				<div className="flex items-center gap-1.5">
					<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary/70" />
					<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
					<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
				</div>
			</div>
		);
	}

	if (isEmpty) {
		return (
			<div className="mx-5 mt-2 mb-4 rounded-xl border border-foreground/10 border-dashed bg-card/50 px-5 py-6 text-center">
				<div className="eyebrow text-foreground/55">Empty shelf</div>
				<p className="mt-2 text-[0.8125rem] text-muted-foreground leading-relaxed">
					{emptyCopy}
				</p>
			</div>
		);
	}

	return (
		<div className="mt-1 px-5">
			<div className="flex items-center justify-between gap-3 pb-2">
				<div className="eyebrow text-foreground/55">
					{countLabel} {String(items.length).padStart(2, "0")}
				</div>
				<button
					className={cn(
						"font-medium text-[0.7rem] tracking-[0.18em] uppercase transition-colors duration-150 ease-out",
						selected.size > 0
							? "text-primary hover:text-foreground"
							: "text-foreground/45 hover:text-foreground",
					)}
					onClick={() => onSelectAllChange(!allSelected)}
					type="button"
				>
					{allSelected ? "Clear" : "Select all"}
				</button>
			</div>
			<ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl ring-1 ring-foreground/10">
				{items.map((item) => (
					<li
						key={getId(item)}
						className="group/row relative first:rounded-t-xl last:rounded-b-xl"
					>
						{renderRow(item)}
					</li>
				))}
			</ul>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Operations log
// ---------------------------------------------------------------------------

export function OperationsLog({
	entries,
	entityLabelSingular,
	entityLabelPlural,
}: {
	entries: SheetLogEntry[];
	entityLabelSingular: string;
	entityLabelPlural: string;
}) {
	if (entries.length === 0) return null;
	return (
		<div className="mt-5 px-5 pb-4">
			<div className="mb-2 eyebrow text-foreground/55">Recent</div>
			<ol className="space-y-1.5">
				{entries.map((e) => (
					<li
						key={e.id}
						className="flex items-start gap-2 font-mono text-[11px] leading-relaxed"
					>
						<span
							aria-hidden
							className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/55"
						/>
						<div className="min-w-0 flex-1">
							{e.kind === "import" ? (
								<>
									<span className="text-foreground/80">Imported </span>
									<span className="text-foreground">
										{e.fileOutcomes.find((f) => f.ok)?.fileName ?? "files"}
									</span>
									<span className="text-foreground/60">
										{" "}
										· {e.totalCount}{" "}
										{e.totalCount === 1
											? entityLabelSingular
											: entityLabelPlural}
									</span>
								</>
							) : null}
							{e.kind === "export" ? (
								<>
									<span className="text-foreground/80">Exported </span>
									<span className="text-foreground">
										{e.count}{" "}
										{e.count === 1 ? entityLabelSingular : entityLabelPlural}
									</span>
									<span className="text-foreground/60"> to {e.path}</span>
								</>
							) : null}
							{e.kind === "error" ? (
								<span className="text-destructive/90">
									{e.fileName ? `${e.fileName}: ` : ""}
									{e.message}
								</span>
							) : null}
							<span className="ml-2 text-foreground/40">
								{relativeTime(e.at)}
							</span>
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Bulk footer
// ---------------------------------------------------------------------------

function BulkFooter({
	busy,
	count,
	onClear,
	onExport,
	singularLabel,
	pluralLabel,
}: {
	busy: boolean;
	count: number;
	onClear: () => void;
	onExport: () => void;
	singularLabel: string;
	pluralLabel: string;
}) {
	return (
		<motion.div
			animate={{ y: 0, opacity: 1 }}
			className="shrink-0 border-foreground/10 border-t bg-card/95 backdrop-blur-2xl"
			exit={{ y: 12, opacity: 0 }}
			initial={{ y: 12, opacity: 0 }}
			transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
		>
			<div className="flex items-center justify-between gap-3 px-5 py-3.5">
				<div className="flex items-center gap-2 eyebrow text-foreground/65">
					<span className="tabular-nums text-foreground">
						{String(count).padStart(2, "0")}
					</span>
					selected
				</div>
				<div className="flex items-center gap-1.5">
					<button
						className="rounded-lg px-2.5 py-1.5 font-medium text-[0.75rem] text-foreground/65 transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
						onClick={onClear}
						type="button"
					>
						Clear
					</button>
					<button
						className="glow-sm hover:glow-md flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-[0.75rem] text-primary-foreground transition-shadow duration-200 ease-out disabled:pointer-events-none disabled:opacity-60"
						disabled={busy}
						onClick={onExport}
						type="button"
					>
						{busy ? (
							<>
								<span className="flex items-center gap-1">
									<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary-foreground/80" />
									<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary-foreground/80 [animation-delay:200ms]" />
									<span className="h-1 w-1 animate-thinking-dot rounded-full bg-primary-foreground/80 [animation-delay:400ms]" />
								</span>
								Exporting
							</>
						) : (
							<>
								<ArrowDownToLine className="h-3.5 w-3.5" />
								Export {count} {count === 1 ? singularLabel : pluralLabel}
							</>
						)}
					</button>
				</div>
			</div>
		</motion.div>
	);
}

// ---------------------------------------------------------------------------
// Trigger button
// ---------------------------------------------------------------------------

export function SheetTriggerButton({
	className,
	label,
	shortcutLabel,
	onClick,
}: {
	className?: string;
	label: string;
	shortcutLabel: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-label={`Open ${label}`}
			className={cn(
				"flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 font-medium text-[0.8rem] text-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
				className,
			)}
			onClick={onClick}
			type="button"
		>
			<FolderInput className="h-3.5 w-3.5" />
			{label}
			<kbd className="ml-1 hidden h-4 items-center rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground sm:inline-flex">
				{shortcutLabel}
			</kbd>
		</button>
	);
}
