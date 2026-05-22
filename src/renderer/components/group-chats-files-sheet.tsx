import { Users } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useToast } from "@/components/ui/toast";
import type { StoredCharacter, StoredGroupChat } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	DropZone,
	LibrarySheetShell,
	LibraryTable,
	nowLogId,
	OperationsLog,
	type SheetAsyncState,
	type SheetLogEntry,
	SheetTriggerButton,
	useGlobalToggleShortcut,
} from "./library-sheet-parts";

const SHORTCUT_KEY = "k";
const SHORTCUT_LABEL = "⌘K";

interface GroupChatsFilesSheetContextValue {
	open: () => void;
	close: () => void;
	toggle: () => void;
	isOpen: boolean;
	/** Notify the sheet that a new group-chat list is canonical (after page ops). */
	syncGroupChats: (next: StoredGroupChat[]) => void;
}

const GroupChatsFilesSheetContext =
	createContext<GroupChatsFilesSheetContextValue | null>(null);

export function GroupChatsFilesSheetProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [groupChats, setGroupChats] = useState<StoredGroupChat[]>([]);
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [state, setState] = useState<SheetAsyncState>("idle");
	const [log, setLog] = useState<SheetLogEntry[]>([]);
	const [justArrivedIds, setJustArrivedIds] = useState<Set<string>>(new Set());
	const lastFocusedRef = useRef<HTMLElement | null>(null);
	const toast = useToast();

	const refresh = useCallback(async () => {
		const [gcs, cs] = await Promise.all([
			window.api.groupChats.list(),
			window.api.characters.list(),
		]);
		setGroupChats(gcs);
		setCharacters(cs);
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

	const syncGroupChats = useCallback((next: StoredGroupChat[]) => {
		setGroupChats(next);
		setLoaded(true);
	}, []);

	useGlobalToggleShortcut(SHORTCUT_KEY, toggle);

	const pushLog = useCallback((entry: SheetLogEntry) => {
		setLog((prev) => [entry, ...prev].slice(0, 8));
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
					? await window.api.groupChats.importFromFile()
					: await window.api.groupChats.importFromPaths(paths ?? []);
			setState("idle");

			if (!res.success && "canceled" in res) {
				return;
			}

			if (!res.success) {
				pushLog({
					id: nowLogId(),
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
				id: nowLogId(),
				kind: "import",
				at: Date.now(),
				fileOutcomes: res.fileOutcomes,
				totalCount: res.imported.length,
			});
			flashJustArrived(res.imported.map((g) => g.id));
			await refresh();

			const okFiles = res.fileOutcomes.filter((f) => f.ok);
			const primaryName = okFiles[0]?.fileName;
			const moreCount = okFiles.length > 1 ? ` + ${okFiles.length - 1} more` : "";
			toast.push({
				tone: "success",
				title: `Imported ${res.imported.length} group chat${res.imported.length === 1 ? "" : "s"}`,
				description: primaryName ? `${primaryName}${moreCount}` : undefined,
			});

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
			const res = await window.api.groupChats.exportToFile(ids);
			setState("idle");

			if (!res.success && "canceled" in res) {
				return;
			}

			if (!res.success) {
				pushLog({
					id: nowLogId(),
					kind: "error",
					at: Date.now(),
					message: res.error,
				});
				toast.push({
					tone: "error",
					title: "Export failed",
					description: res.error,
				});
				return;
			}

			pushLog({
				id: nowLogId(),
				kind: "export",
				at: Date.now(),
				count: res.count,
				path: res.path,
			});
			toast.push({
				tone: "success",
				title: `Saved ${res.count} group chat${res.count === 1 ? "" : "s"}`,
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

	// Drop handler — accept .json files dragged from the desktop.
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
					description: "Try clicking Browse inside Group Chat Files instead.",
				});
				return;
			}
			void runImport("paths", paths);
		},
		[runImport, toast],
	);

	const value = useMemo<GroupChatsFilesSheetContextValue>(
		() => ({ open, close, toggle, isOpen, syncGroupChats }),
		[open, close, toggle, isOpen, syncGroupChats],
	);

	// Expose drop handler globally so pages can forward root-level drops.
	useEffect(() => {
		(
			window as unknown as {
				__groupChatsFilesSheetAcceptDrop?: typeof acceptDroppedFiles;
			}
		).__groupChatsFilesSheetAcceptDrop = acceptDroppedFiles;
		return () => {
			(
				window as unknown as {
					__groupChatsFilesSheetAcceptDrop?: typeof acceptDroppedFiles;
				}
			).__groupChatsFilesSheetAcceptDrop = undefined;
		};
	}, [acceptDroppedFiles]);

	const itemIds = useMemo(() => groupChats.map((g) => g.id), [groupChats]);
	const allSelected =
		selected.size > 0 && selected.size === groupChats.length;
	const isEmpty = loaded && groupChats.length === 0;
	const charactersById = useMemo(
		() => new Map(characters.map((c) => [c.id, c])),
		[characters],
	);

	const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
	const toggleRow = useCallback(
		(id: string, event?: { shiftKey?: boolean }) => {
			const next = new Set(selected);
			if (event?.shiftKey && lastSelectedId) {
				const a = itemIds.indexOf(lastSelectedId);
				const b = itemIds.indexOf(id);
				if (a !== -1 && b !== -1) {
					const [lo, hi] = a < b ? [a, b] : [b, a];
					for (let i = lo; i <= hi; i++) {
						const target = itemIds[i];
						if (target) next.add(target);
					}
					setSelected(next);
					setLastSelectedId(id);
					return;
				}
			}
			if (next.has(id)) next.delete(id);
			else next.add(id);
			setSelected(next);
			setLastSelectedId(id);
		},
		[itemIds, lastSelectedId, selected],
	);

	return (
		<GroupChatsFilesSheetContext.Provider value={value}>
			{children}
			<LibrarySheetShell
				bulkPluralLabel="group chats"
				bulkSingularLabel="group chat"
				itemIds={itemIds}
				onClose={close}
				onDropFiles={acceptDroppedFiles}
				onExport={(ids) => void runExport(ids)}
				onSelectedChange={setSelected}
				open={isOpen}
				selected={selected}
				shortcutLabel={SHORTCUT_LABEL}
				state={state}
				subtitleCopy={
					groupChats.length === 0
						? "Nothing on the shelf"
						: `${String(groupChats.length).padStart(2, "0")} on the shelf`
				}
				titleCopy="Group Chat Files"
			>
				<DropZone
					busy={state === "importing"}
					busyCopy="Parsing files…"
					dragOver={false}
					idleCopy="Drop .json files to import"
					onBrowse={() => void runImport("browse")}
					releaseCopy="Release to import"
					subhead="or click to browse the disk"
				/>

				<LibraryTable
					allSelected={allSelected}
					countLabel="Group Chats"
					emptyCopy="Drop a group chat file above, or build a new one on the Group Chats page."
					getId={(g: StoredGroupChat) => g.id}
					isEmpty={isEmpty}
					items={groupChats}
					loaded={loaded}
					onSelectAllChange={(checked) =>
						setSelected(
							checked ? new Set(groupChats.map((g) => g.id)) : new Set(),
						)
					}
					renderRow={(g) => (
						<GroupChatRow
							charactersById={charactersById}
							isJustArrived={justArrivedIds.has(g.id)}
							isSelected={selected.has(g.id)}
							item={g}
							onToggle={toggleRow}
						/>
					)}
					selected={selected}
				/>

				<OperationsLog
					entityLabelPlural="group chats"
					entityLabelSingular="group chat"
					entries={log}
				/>
			</LibrarySheetShell>
		</GroupChatsFilesSheetContext.Provider>
	);
}

export function useGroupChatsFilesSheet(): GroupChatsFilesSheetContextValue {
	const ctx = useContext(GroupChatsFilesSheetContext);
	if (!ctx) {
		throw new Error(
			"useGroupChatsFilesSheet must be used inside a GroupChatsFilesSheetProvider",
		);
	}
	return ctx;
}

function GroupChatRow({
	item,
	isSelected,
	isJustArrived,
	charactersById,
	onToggle,
}: {
	item: StoredGroupChat;
	isSelected: boolean;
	isJustArrived: boolean;
	charactersById: Map<string, StoredCharacter>;
	onToggle: (id: string, event?: { shiftKey?: boolean }) => void;
}) {
	const title = item.groupChat.title;
	const cast = item.characterIds
		.map((id) => charactersById.get(id))
		.filter((c): c is StoredCharacter => Boolean(c));
	const castNames =
		cast.length === 0
			? "No cast linked"
			: cast.length <= 3
				? cast
						.map((c) => `${c.character.firstName} ${c.character.lastName}`.trim())
						.join(", ")
				: `${cast
						.slice(0, 2)
						.map((c) => c.character.firstName)
						.join(", ")} + ${cast.length - 2}`;
	const date = new Date(item.createdAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	return (
		<button
			aria-pressed={isSelected}
			className={cn(
				"flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/45",
				isSelected ? "bg-primary/10" : "hover:bg-muted/60",
				isJustArrived && "just-arrived",
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

			<span
				aria-hidden
				className="display-figure flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-[0.75rem] text-foreground/55 ring-1 ring-foreground/10"
			>
				<Users className="h-4 w-4" />
			</span>

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline gap-2">
					<span className="-tracking-[0.005em] truncate font-semibold text-[0.875rem] text-foreground leading-tight">
						{title}
					</span>
				</div>
				<div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-foreground/55 leading-none">
					<span className="truncate">{castNames}</span>
					<span
						aria-hidden
						className="h-0.5 w-0.5 shrink-0 rounded-full bg-foreground/25"
					/>
					<span className="shrink-0 tabular-nums">{date}</span>
				</div>
			</div>

			<span className="hidden font-medium text-[10px] text-foreground/40 uppercase tracking-[0.18em] sm:inline-block">
				{cast.length} cast
			</span>
		</button>
	);
}

export function GroupChatsFilesTriggerButton({
	className,
	label = "Group Chat Files",
}: {
	className?: string;
	label?: string;
}) {
	const { toggle } = useGroupChatsFilesSheet();
	return (
		<SheetTriggerButton
			className={className}
			label={label}
			onClick={toggle}
			shortcutLabel={SHORTCUT_LABEL}
		/>
	);
}
