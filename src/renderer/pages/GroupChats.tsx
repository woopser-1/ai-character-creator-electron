import { UploadCloud, Users } from "lucide-react";
import {
	type DragEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { ConversationLibraryPage } from "@/components/conversation-target-library";
import {
	GroupChatsFilesTriggerButton,
	useGroupChatsFilesSheet,
} from "@/components/group-chats-files-sheet";
import { Button } from "@/components/ui/button";
import { toGroupChatTarget } from "@/lib/conversation-target";
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
	const targets = groupChats.map((groupChat) =>
		toGroupChatTarget(groupChat, charactersById),
	);

	return (
		<ConversationLibraryPage
			actions={
				<>
					<GroupChatsFilesTriggerButton />
					<a href="#/group-chats/create">
						<Button className="glow-sm hover:glow-md" size="sm">
							<Users className="h-3.5 w-3.5" />
							New Group Chat
						</Button>
					</a>
				</>
			}
			countLabel={
				groupChats.length === 1
					? "Group chat on the shelf"
					: "Group chats on the shelf"
			}
			empty={<EmptyGroupChats onImport={() => openFiles()} />}
			loaded={loaded}
			mobileLabel="Group chats"
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			pageDragOver={pageDragOver}
			targets={targets}
			title="Conversation targets"
		/>
	);
}

function EmptyGroupChats({ onImport }: { onImport: () => void }) {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center sm:px-6 lg:px-8 lg:pt-24">
			<div className="flex items-baseline gap-3">
				<span
					aria-hidden
					className="display-figure text-[0.875rem] text-foreground/35 leading-none"
				>
					00
				</span>
				<span className="eyebrow text-foreground/55">
					Conversation targets
				</span>
			</div>
			<Users className="h-12 w-12 text-foreground/25" />
			<h2 className="-tracking-[0.025em] max-w-[18ch] font-semibold text-[2.5rem] text-foreground leading-[1.02] sm:text-[3rem]">
				Bring your characters
				<br />
				<span className="text-primary">together.</span>
			</h2>
			<p className="max-w-[52ch] text-[0.9375rem] text-muted-foreground leading-relaxed">
				Pick {2}–{6} characters from your library, sketch a scene with the AI,
				and we'll produce a copy-ready title, public blurb, multi-speaker
				scenario, and director's-cut private notes for your downstream chat.
			</p>
			<div className="flex flex-wrap items-center justify-center gap-2">
				<a href="#/group-chats/create">
					<Button className="glow-md hover:glow-lg">
						<Users className="mr-1 h-3.5 w-3.5" />
						New Group Chat
					</Button>
				</a>
				<Button onClick={onImport} variant="outline">
					<UploadCloud className="mr-1 h-3.5 w-3.5" />
					Import
				</Button>
			</div>
		</div>
	);
}
