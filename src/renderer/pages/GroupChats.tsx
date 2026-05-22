import { UploadCloud, Users } from "lucide-react";
import {
	type DragEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { GroupChatCard } from "@/components/group-chat-card";
import {
	GroupChatsFilesTriggerButton,
	useGroupChatsFilesSheet,
} from "@/components/group-chats-files-sheet";
import { Button } from "@/components/ui/button";
import type { StoredCharacter, StoredGroupChat } from "@/lib/types";

export function GroupChatsPage() {
	const [groupChats, setGroupChats] = useState<StoredGroupChat[]>([]);
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [pageDragOver, setPageDragOver] = useState(false);
	const { syncGroupChats, open: openFiles } = useGroupChatsFilesSheet();

	useEffect(() => {
		void Promise.all([
			window.api.groupChats.list(),
			window.api.characters.list(),
		]).then(([gcs, cs]) => {
			setGroupChats(gcs);
			setCharacters(cs);
			setLoaded(true);
			syncGroupChats(gcs);
		});
	}, [syncGroupChats]);

	useEffect(() => {
		const refresh = () => {
			void Promise.all([
				window.api.groupChats.list(),
				window.api.characters.list(),
			]).then(([gcs, cs]) => {
				setGroupChats(gcs);
				setCharacters(cs);
				syncGroupChats(gcs);
			});
		};
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, [syncGroupChats]);

	const acceptDrop = useCallback(
		(files: FileList) => {
			const acceptor = (
				window as unknown as {
					__groupChatsFilesSheetAcceptDrop?: (f: FileList) => void;
				}
			).__groupChatsFilesSheetAcceptDrop;
			if (acceptor) {
				acceptor(files);
				openFiles();
				setTimeout(() => {
					void Promise.all([
						window.api.groupChats.list(),
						window.api.characters.list(),
					]).then(([gcs, cs]) => {
						setGroupChats(gcs);
						setCharacters(cs);
						syncGroupChats(gcs);
					});
				}, 400);
			}
		},
		[openFiles, syncGroupChats],
	);

	const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
		if (
			event.dataTransfer.types.includes("Files") ||
			event.dataTransfer.types.includes("application/x-moz-file")
		) {
			event.preventDefault();
			setPageDragOver(true);
		}
	}, []);

	const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
		const related = event.relatedTarget as Node | null;
		if (related && event.currentTarget.contains(related)) return;
		setPageDragOver(false);
	}, []);

	const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
	}, []);

	const handleDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			setPageDragOver(false);
			if (event.dataTransfer.files.length > 0) {
				acceptDrop(event.dataTransfer.files);
			}
		},
		[acceptDrop],
	);

	const charactersById = useMemo(
		() => new Map(characters.map((c) => [c.id, c])),
		[characters],
	);

	if (!loaded) {
		return <div className="flex-1" />;
	}

	if (groupChats.length === 0) {
		return (
			<div
				className="relative flex min-h-0 flex-1 flex-col"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center sm:px-6 lg:px-8 lg:pt-24">
					<div className="flex items-baseline gap-3">
						<span
							aria-hidden
							className="display-figure text-[0.875rem] text-foreground/35 leading-none"
						>
							00
						</span>
						<span className="eyebrow text-foreground/55">Group Chats</span>
					</div>
					<Users className="h-12 w-12 text-foreground/25" />
					<h2 className="-tracking-[0.025em] max-w-[18ch] font-semibold text-[2.5rem] text-foreground leading-[1.02] sm:text-[3rem]">
						Bring your characters
						<br />
						<span className="text-primary">together.</span>
					</h2>
					<p className="max-w-[52ch] text-[0.9375rem] text-muted-foreground leading-relaxed">
						Pick {2}–{6} characters from your library, sketch a scene with the
						AI, and we'll produce a copy-ready title, public blurb,
						multi-speaker scenario, and director's-cut private notes for your
						downstream chat.
					</p>
					<div className="flex flex-wrap items-center justify-center gap-2">
						<a href="#/group-chats/create">
							<Button className="glow-md hover:glow-lg">
								<Users className="mr-1 h-3.5 w-3.5" />
								New Group Chat
							</Button>
						</a>
						<Button onClick={() => openFiles()} variant="outline">
							<UploadCloud className="mr-1 h-3.5 w-3.5" />
							Import
						</Button>
					</div>
				</div>
				<DragOverlay show={pageDragOver} />
			</div>
		);
	}

	const count = groupChats.length;

	return (
		<div
			className="relative mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14"
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<Masthead count={count} />

			<div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
				{groupChats.map((gc, idx) => (
					<GroupChatCard
						charactersById={charactersById}
						data={gc}
						index={idx}
						key={gc.id}
					/>
				))}
			</div>

			<DragOverlay show={pageDragOver} />
		</div>
	);
}

function Masthead({ count }: { count: number }) {
	return (
		<header className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr_auto] sm:items-end sm:gap-10">
			<div className="flex items-end gap-5">
				<span
					aria-hidden
					className="display-figure text-[5.5rem] text-foreground leading-[0.85] sm:text-[6.5rem]"
				>
					{String(count).padStart(2, "0")}
				</span>
				<div className="pb-3">
					<div className="eyebrow text-foreground/55">The roster</div>
					<div className="mt-1.5 text-[0.8125rem] text-muted-foreground">
						{count === 1 ? "Group chat on the shelf" : "Group chats on the shelf"}
					</div>
				</div>
			</div>
			<div
				aria-hidden
				className="hidden h-px self-end bg-gradient-to-r from-foreground/15 via-foreground/8 to-transparent sm:block sm:mb-5"
			/>
			<div className="flex items-center justify-between gap-2 sm:justify-end sm:pb-3">
				<span className="font-medium text-[10.5px] text-foreground/45 uppercase tracking-[0.22em] sm:hidden">
					Group chats
				</span>
				<div className="flex items-center gap-1.5">
					<GroupChatsFilesTriggerButton />
					<a href="#/group-chats/create">
						<Button className="glow-sm hover:glow-md" size="sm">
							<Users className="h-3.5 w-3.5" />
							New Group Chat
						</Button>
					</a>
				</div>
			</div>
		</header>
	);
}

function DragOverlay({ show }: { show: boolean }) {
	if (!show) return null;
	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-3xl bg-background/55 backdrop-blur-[2px] ring-2 ring-[oklch(0.8_0.28_303/0.55)] [box-shadow:0_0_0_1px_oklch(0.8_0.28_303/0.4),0_0_48px_oklch(0.72_0.25_305/0.28)] animate-in fade-in-0"
		>
			<div className="flex flex-col items-center gap-3 rounded-2xl bg-popover/90 px-6 py-5 ring-1 ring-foreground/12 backdrop-blur-2xl">
				<span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
					<UploadCloud className="h-5 w-5" />
				</span>
				<div className="text-center">
					<div className="-tracking-[0.005em] font-semibold text-[1rem] text-foreground leading-tight">
						Release to import
					</div>
					<div className="mt-1 text-[0.8125rem] text-muted-foreground">
						Group Chat Files will open with the result
					</div>
				</div>
			</div>
		</div>
	);
}
