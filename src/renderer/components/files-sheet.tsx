import {
	ArrowDownToLine,
	Folder,
	FolderInput,
	UploadCloud,
	X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	createContext,
	type DragEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useToast } from "@/components/ui/toast";
import type { ImportFileOutcome, StoredCharacter } from "@/lib/types";
import { getFullName, getStoredImageModel, IMAGE_MODEL_META } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilesSheetContextValue {
	open: () => void;
	close: () => void;
	toggle: () => void;
	isOpen: boolean;
	/** Notify the sheet that a new character list is canonical (after Gallery ops). */
	syncCharacters: (next: StoredCharacter[]) => void;
}

const FilesSheetContext = createContext<FilesSheetContextValue | null>(null);

type LogEntry =
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

type AsyncState = "idle" | "importing" | "exporting";

const LOG_LIMIT = 8;

function nowId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function relativeTime(at: number): string {
	const seconds = Math.max(1, Math.round((Date.now() - at) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return new Date(at).toLocaleDateString();
}

export function FilesSheetProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [state, setState] = useState<AsyncState>("idle");
	const [log, setLog] = useState<LogEntry[]>([]);
	const [justArrivedIds, setJustArrivedIds] = useState<Set<string>>(new Set());
	const lastFocusedRef = useRef<HTMLElement | null>(null);
	const toast = useToast();

	const refresh = useCallback(async () => {
		const next = await window.api.characters.list();
		setCharacters(next);
		setLoaded(true);
	}, []);

	const open = useCallback(() => {
		if (typeof document !== "undefined") {
			lastFocusedRef.current = document.activeElement as HTMLElement | null;
		}
		setIsOpen(true);
		void refresh();
	}, [refresh]);

	const close = useCallback(() => {
		setIsOpen(false);
		setSelected(new Set());
		// Restore focus to whatever opened the sheet.
		queueMicrotask(() => {
			lastFocusedRef.current?.focus?.();
		});
	}, []);

	const toggle = useCallback(() => {
		setIsOpen((prev) => {
			if (prev) {
				setSelected(new Set());
				return false;
			}
			void refresh();
			return true;
		});
	}, [refresh]);

	const syncCharacters = useCallback((next: StoredCharacter[]) => {
		setCharacters(next);
		setLoaded(true);
	}, []);

	// Global keyboard: ⌘L toggles, Esc handled inside the sheet panel.
	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			const cmdL = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l";
			if (cmdL) {
				event.preventDefault();
				toggle();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [toggle]);

	const pushLog = useCallback((entry: LogEntry) => {
		setLog((prev) => [entry, ...prev].slice(0, LOG_LIMIT));
	}, []);

	const flashJustArrived = useCallback((ids: string[]) => {
		setJustArrivedIds((prev) => {
			const next = new Set(prev);
			for (const id of ids) next.add(id);
			return next;
		});
		setTimeout(() => {
			setJustArrivedIds((prev) => {
				const next = new Set(prev);
				for (const id of ids) next.delete(id);
				return next;
			});
		}, 2200);
	}, []);

	const runImport = useCallback(
		async (kind: "browse" | "paths", paths?: string[]) => {
			setState("importing");
			const res =
				kind === "browse"
					? await window.api.characters.importFromFile()
					: await window.api.characters.importFromPaths(paths ?? []);
			setState("idle");

			if (!res.success && "canceled" in res) {
				return;
			}

			if (!res.success) {
				pushLog({
					id: nowId(),
					kind: "error",
					at: Date.now(),
					message: res.error,
					fileName: res.fileOutcomes?.[0]?.fileName,
				});
				toast.push({
					tone: "error",
					title: "Import failed",
					description: res.error,
				});
				return;
			}

			pushLog({
				id: nowId(),
				kind: "import",
				at: Date.now(),
				fileOutcomes: res.fileOutcomes,
				totalCount: res.imported.length,
			});
			flashJustArrived(res.imported.map((c) => c.id));
			await refresh();

			const okFiles = res.fileOutcomes.filter((f) => f.ok);
			const primaryName = okFiles[0]?.fileName;
			const moreCount = okFiles.length > 1 ? ` + ${okFiles.length - 1} more` : "";
			toast.push({
				tone: "success",
				title: `Imported ${res.imported.length} character${res.imported.length === 1 ? "" : "s"}`,
				description: primaryName ? `${primaryName}${moreCount}` : undefined,
			});

			// Report any partial failures.
			const failed = res.fileOutcomes.filter((f) => !f.ok);
			for (const f of failed) {
				toast.push({
					tone: "error",
					title: "Skipped one file",
					description: `${f.fileName}: ${f.error ?? "invalid"}`,
				});
			}
		},
		[flashJustArrived, pushLog, refresh, toast],
	);

	const runExport = useCallback(
		async (ids: string[]) => {
			if (ids.length === 0) return;
			setState("exporting");
			const res = await window.api.characters.exportToFile(ids);
			setState("idle");

			if (!res.success && "canceled" in res) {
				return;
			}

			if (!res.success) {
				pushLog({
					id: nowId(),
					kind: "error",
					at: Date.now(),
					message: res.error,
				});
				toast.push({ tone: "error", title: "Export failed", description: res.error });
				return;
			}

			pushLog({
				id: nowId(),
				kind: "export",
				at: Date.now(),
				count: res.count,
				path: res.path,
			});
			toast.push({
				tone: "success",
				title: `Saved ${res.count} character${res.count === 1 ? "" : "s"}`,
				description: res.path,
				action: {
					label: "Show in Finder",
					onClick: () => void window.api.shell.showInFolder(res.path),
				},
			});
			setSelected(new Set());
		},
		[pushLog, toast],
	);

	// Drop handling can be triggered from anywhere via the context, but the
	// sheet body handles its own drop. We expose a public drop handler too so
	// the Gallery can accept root-level drops without the sheet being open.
	const acceptDroppedFiles = useCallback(
		(files: FileList | File[]) => {
			const paths: string[] = [];
			for (const file of Array.from(files)) {
				const filePath = (file as File & { path?: string }).path;
				if (filePath) paths.push(filePath);
			}
			if (paths.length === 0) {
				toast.push({
					tone: "error",
					title: "Couldn't read file path",
					description: "Try clicking Browse inside Files instead.",
				});
				return;
			}
			void runImport("paths", paths);
		},
		[runImport, toast],
	);

	const value = useMemo<FilesSheetContextValue>(
		() => ({ open, close, toggle, isOpen, syncCharacters }),
		[open, close, toggle, isOpen, syncCharacters],
	);

	// Expose drop handler as a stable callback property on the context window.
	useEffect(() => {
		// Stored under a known symbol so consumers (Gallery) can listen.
		(window as unknown as { __filesSheetAcceptDrop?: typeof acceptDroppedFiles }).__filesSheetAcceptDrop =
			acceptDroppedFiles;
		return () => {
			(window as unknown as { __filesSheetAcceptDrop?: typeof acceptDroppedFiles }).__filesSheetAcceptDrop = undefined;
		};
	}, [acceptDroppedFiles]);

	return (
		<FilesSheetContext.Provider value={value}>
			{children}
			<FilesSheet
				characters={characters}
				justArrivedIds={justArrivedIds}
				loaded={loaded}
				log={log}
				onBrowseImport={() => void runImport("browse")}
				onClose={close}
				onDropFiles={acceptDroppedFiles}
				onExport={(ids) => void runExport(ids)}
				onSelectedChange={setSelected}
				open={isOpen}
				selected={selected}
				state={state}
			/>
		</FilesSheetContext.Provider>
	);
}

export function useFilesSheet(): FilesSheetContextValue {
	const ctx = useContext(FilesSheetContext);
	if (!ctx) {
		throw new Error("useFilesSheet must be used inside a FilesSheetProvider");
	}
	return ctx;
}

// ---------------------------------------------------------------------------
// Sheet panel
// ---------------------------------------------------------------------------

interface FilesSheetProps {
	characters: StoredCharacter[];
	justArrivedIds: Set<string>;
	loaded: boolean;
	log: LogEntry[];
	onBrowseImport: () => void;
	onClose: () => void;
	onDropFiles: (files: FileList | File[]) => void;
	onExport: (ids: string[]) => void;
	onSelectedChange: (next: Set<string>) => void;
	open: boolean;
	selected: Set<string>;
	state: AsyncState;
}

function FilesSheet({
	characters,
	justArrivedIds,
	loaded,
	log,
	onBrowseImport,
	onClose,
	onDropFiles,
	onExport,
	onSelectedChange,
	open,
	selected,
	state,
}: FilesSheetProps) {
	const [dragOver, setDragOver] = useState(false);
	const [dragCount, setDragCount] = useState(0);
	const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
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
				onSelectedChange(new Set(characters.map((c) => c.id)));
				return;
			}
			if (event.key === "Enter" && selected.size > 0) {
				event.preventDefault();
				onExport(Array.from(selected));
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [characters, onClose, onExport, onSelectedChange, open, selected]);

	// Focus the panel when it opens so global keys reach it.
	useEffect(() => {
		if (open && panelRef.current) {
			panelRef.current.focus();
		}
	}, [open]);

	const toggleRow = useCallback(
		(id: string, event?: { shiftKey?: boolean }) => {
			const idsInOrder = characters.map((c) => c.id);
			const next = new Set(selected);

			if (event?.shiftKey && lastSelectedId) {
				const a = idsInOrder.indexOf(lastSelectedId);
				const b = idsInOrder.indexOf(id);
				if (a !== -1 && b !== -1) {
					const [lo, hi] = a < b ? [a, b] : [b, a];
					for (let i = lo; i <= hi; i++) {
						const target = idsInOrder[i];
						if (target) next.add(target);
					}
					onSelectedChange(next);
					setLastSelectedId(id);
					return;
				}
			}

			if (next.has(id)) next.delete(id);
			else next.add(id);
			onSelectedChange(next);
			setLastSelectedId(id);
		},
		[characters, lastSelectedId, onSelectedChange, selected],
	);

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
	const allSelected = totalSelected > 0 && totalSelected === characters.length;
	const isEmpty = loaded && characters.length === 0;

	return (
		<AnimatePresence>
			{open && (
				<div
					aria-label="Files"
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
						<SheetHeader onClose={onClose} totalCount={characters.length} />

						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							<DropZone
								busy={state === "importing"}
								dragOver={dragOver}
								onBrowse={onBrowseImport}
							/>

							<LibraryTable
								allSelected={allSelected}
								characters={characters}
								isEmpty={isEmpty}
								justArrivedIds={justArrivedIds}
								loaded={loaded}
								onSelectAllChange={(checked) =>
									onSelectedChange(
										checked ? new Set(characters.map((c) => c.id)) : new Set(),
									)
								}
								onToggle={toggleRow}
								selected={selected}
							/>

							<OperationsLog entries={log} />
						</div>

						<AnimatePresence>
							{totalSelected > 0 && (
								<BulkFooter
									busy={state === "exporting"}
									count={totalSelected}
									onClear={() => onSelectedChange(new Set())}
									onExport={() => onExport(Array.from(selected))}
								/>
							)}
						</AnimatePresence>

						{/* Drag-over highlight overlay (the whole panel is the drop target). */}
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
	totalCount,
}: {
	onClose: () => void;
	totalCount: number;
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
						Files
					</div>
					<div className="eyebrow text-foreground/55">
						{totalCount === 0
							? "Nothing on the shelf"
							: `${String(totalCount).padStart(2, "0")} on the shelf`}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<kbd className="hidden h-6 items-center rounded-md bg-muted px-1.5 font-mono text-[10px] text-muted-foreground ring-1 ring-foreground/10 sm:inline-flex">
					⌘L
				</kbd>
				<button
					aria-label="Close Files"
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

function DropZone({
	dragOver,
	busy,
	onBrowse,
}: {
	dragOver: boolean;
	busy: boolean;
	onBrowse: () => void;
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
					{busy
						? "Parsing files…"
						: dragOver
							? "Release to import"
							: "Drop .json files to import"}
				</div>
				{!busy && (
					<div className="text-[0.75rem] text-muted-foreground leading-tight">
						or click to browse the disk
					</div>
				)}
			</button>
		</div>
	);
}

function LibraryTable({
	allSelected,
	characters,
	isEmpty,
	justArrivedIds,
	loaded,
	onSelectAllChange,
	onToggle,
	selected,
}: {
	allSelected: boolean;
	characters: StoredCharacter[];
	isEmpty: boolean;
	justArrivedIds: Set<string>;
	loaded: boolean;
	onSelectAllChange: (checked: boolean) => void;
	onToggle: (id: string, event?: { shiftKey?: boolean }) => void;
	selected: Set<string>;
}) {
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
					Drop a character file above, or start a new one in Create.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-1 px-5">
			<div className="flex items-center justify-between gap-3 pb-2">
				<div className="eyebrow text-foreground/55">
					Library {String(characters.length).padStart(2, "0")}
				</div>
				<button
					className={cn(
						"font-medium text-[0.7rem] tracking-[0.18em] uppercase transition-colors duration-150 ease-out",
						selected.size > 0 ? "text-primary hover:text-foreground" : "text-foreground/45 hover:text-foreground",
					)}
					onClick={() => onSelectAllChange(!allSelected)}
					type="button"
				>
					{allSelected ? "Clear" : "Select all"}
				</button>
			</div>
			<ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl ring-1 ring-foreground/10">
				{characters.map((c) => (
					<LibraryRow
						isJustArrived={justArrivedIds.has(c.id)}
						isSelected={selected.has(c.id)}
						item={c}
						key={c.id}
						onToggle={onToggle}
					/>
				))}
			</ul>
		</div>
	);
}

function LibraryRow({
	item,
	isSelected,
	isJustArrived,
	onToggle,
}: {
	item: StoredCharacter;
	isSelected: boolean;
	isJustArrived: boolean;
	onToggle: (id: string, event?: { shiftKey?: boolean }) => void;
}) {
	const name = getFullName(item.character);
	const model = IMAGE_MODEL_META[getStoredImageModel(item)].label;
	const date = new Date(item.createdAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");

	return (
		<li
			className={cn(
				"group/row relative first:rounded-t-xl last:rounded-b-xl",
				isJustArrived && "just-arrived",
			)}
		>
			<button
				aria-pressed={isSelected}
				className={cn(
					"flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/45",
					isSelected
						? "bg-primary/10"
						: "hover:bg-muted/60",
				)}
				onClick={(event) => onToggle(item.id, event)}
				type="button"
			>
				<span
					aria-hidden
					className={cn(
						"flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ring-1 transition-all duration-150 ease-out",
						isSelected
							? "bg-primary text-primary-foreground ring-primary/50 glow-xs"
							: "bg-transparent ring-foreground/25 group-hover/row:ring-foreground/45",
					)}
				>
					{isSelected && (
						<svg
							className="h-2.5 w-2.5"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="3"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					)}
				</span>

				{item.profileImageUrl ? (
					<img
						alt=""
						className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-foreground/12"
						loading="lazy"
						src={item.profileImageUrl}
					/>
				) : (
					<span
						aria-hidden
						className="display-figure flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-[0.75rem] text-foreground/55 ring-1 ring-foreground/10"
					>
						{initials || "·"}
					</span>
				)}

				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2">
						<span className="-tracking-[0.005em] truncate font-semibold text-[0.875rem] text-foreground leading-tight">
							{name}
						</span>
					</div>
					<div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-foreground/55 leading-none">
						<span className="truncate">{item.character.occupationLabel}</span>
						<span aria-hidden className="h-0.5 w-0.5 shrink-0 rounded-full bg-foreground/25" />
						<span className="shrink-0 tabular-nums">{date}</span>
					</div>
				</div>

				<span className="hidden font-medium text-[10px] text-foreground/40 uppercase tracking-[0.18em] sm:inline-block">
					{model}
				</span>
			</button>
		</li>
	);
}

function OperationsLog({ entries }: { entries: LogEntry[] }) {
	if (entries.length === 0) return null;
	return (
		<div className="mt-5 px-5 pb-4">
			<div className="mb-2 eyebrow text-foreground/55">Recent</div>
			<ol className="space-y-1.5">
				{entries.map((e) => (
					<li key={e.id} className="flex items-start gap-2 font-mono text-[11px] leading-relaxed">
						<span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/55" />
						<div className="min-w-0 flex-1">
							{e.kind === "import" ? (
								<>
									<span className="text-foreground/80">Imported </span>
									<span className="text-foreground">
										{e.fileOutcomes.find((f) => f.ok)?.fileName ?? "files"}
									</span>
									<span className="text-foreground/60">
										{" "}
										· {e.totalCount} character{e.totalCount === 1 ? "" : "s"}
									</span>
								</>
							) : null}
							{e.kind === "export" ? (
								<>
									<span className="text-foreground/80">Exported </span>
									<span className="text-foreground">
										{e.count} character{e.count === 1 ? "" : "s"}
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
							<span className="ml-2 text-foreground/40">{relativeTime(e.at)}</span>
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}

function BulkFooter({
	busy,
	count,
	onClear,
	onExport,
}: {
	busy: boolean;
	count: number;
	onClear: () => void;
	onExport: () => void;
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
					<span className="tabular-nums text-foreground">{String(count).padStart(2, "0")}</span>
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
								Export {count}
							</>
						)}
					</button>
				</div>
			</div>
		</motion.div>
	);
}

// Default Files-trigger button. Tightly styled to match the masthead chrome.
export function FilesTriggerButton({
	className,
	label = "Files",
}: {
	className?: string;
	label?: string;
}) {
	const { toggle } = useFilesSheet();
	return (
		<button
			aria-label="Open Files"
			className={cn(
				"flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 font-medium text-[0.8rem] text-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
				className,
			)}
			onClick={toggle}
			type="button"
		>
			<FolderInput className="h-3.5 w-3.5" />
			{label}
			<kbd className="ml-1 hidden h-4 items-center rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground sm:inline-flex">
				⌘L
			</kbd>
		</button>
	);
}
