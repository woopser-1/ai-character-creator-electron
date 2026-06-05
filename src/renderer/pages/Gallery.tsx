import { ourdreamChatUrl } from "@shared/ourdream-urls";
import { ExternalLink, Link as LinkIcon, Plus, UploadCloud } from "lucide-react";
import { type DragEvent, useCallback, useEffect, useState } from "react";
import { ConversationLibraryPage } from "@/components/conversation-target-library";
import { FilesTriggerButton, useFilesSheet } from "@/components/files-sheet";
import { Button } from "@/components/ui/button";
import type { ConversationTarget } from "@/lib/conversation-target";
import { toCharacterTarget } from "@/lib/conversation-target";
import type { StoredCharacter } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GalleryPage() {
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [pageDragOver, setPageDragOver] = useState(false);
	const { syncCharacters, open: openFiles } = useFilesSheet();

	useEffect(() => {
		window.api.characters.list().then((list) => {
			setCharacters(list);
			setLoaded(true);
			syncCharacters(list);
		});
	}, [syncCharacters]);

	useEffect(() => {
		const handler = () => {
			void window.api.characters.list().then((list) => {
				setCharacters(list);
				syncCharacters(list);
			});
		};
		window.addEventListener("focus", handler);
		const offRefresh = window.api.images.onComplete(handler);
		return () => {
			window.removeEventListener("focus", handler);
			offRefresh();
		};
	}, [syncCharacters]);

	const acceptDrop = useCallback(
		(files: FileList) => {
			const acceptor = (
				window as unknown as { __filesSheetAcceptDrop?: (f: FileList) => void }
			).__filesSheetAcceptDrop;
			if (acceptor) {
				acceptor(files);
				openFiles();
				setTimeout(() => {
					void window.api.characters.list().then((list) => {
						setCharacters(list);
						syncCharacters(list);
					});
				}, 400);
			}
		},
		[openFiles, syncCharacters],
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

	const targets = characters.map(toCharacterTarget);
	const charactersById = new Map(characters.map((character) => [character.id, character]));

	return (
		<ConversationLibraryPage
			actions={
				<>
					<FilesTriggerButton />
					<a href="#/create">
						<Button className="glow-sm hover:glow-md" size="sm">
							<Plus className="h-3.5 w-3.5" />
							New character
						</Button>
					</a>
				</>
			}
			countLabel={
				characters.length === 1
					? "Character on the shelf"
					: "Characters on the shelf"
			}
			empty={<EmptyStudio onImport={() => openFiles()} />}
			loaded={loaded}
			mobileLabel="Characters"
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			pageDragOver={pageDragOver}
			renderActions={(target) => (
				<CharacterTargetActions
					character={charactersById.get(target.id)}
					target={target}
				/>
			)}
			targets={targets}
			title="Conversation targets"
		/>
	);
}

function CharacterTargetActions({
	character,
	target,
}: {
	character?: StoredCharacter;
	target: ConversationTarget;
}) {
	if (!character?.ourdreamUrl || target.kind !== "character") return null;

	const ourdreamUrl = character.ourdreamUrl;

	return (
		<div
			className="reveal-on-hover absolute top-3.5 right-4 z-10 flex items-center gap-1.5"
			style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
		>
			<button
				aria-label="Open OurDream chat"
				className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/40 backdrop-blur-sm transition-shadow duration-200 ease-out hover:glow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					window.open(
						ourdreamChatUrl(ourdreamUrl),
						"_blank",
						"noopener,noreferrer",
					);
				}}
				title="Open OurDream chat"
				type="button"
			>
				<ExternalLink className="h-3.5 w-3.5" />
			</button>
			<button
				aria-label="Open OurDream profile"
				className="flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-foreground ring-1 ring-foreground/15 backdrop-blur-sm transition-colors duration-150 ease-out hover:bg-background/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					window.open(ourdreamUrl, "_blank", "noopener,noreferrer");
				}}
				title="Open OurDream profile"
				type="button"
			>
				<LinkIcon className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

function EmptyStudio({ onImport }: { onImport: () => void }) {
	return (
		<div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
			<div className="grid grid-cols-1 items-center gap-10 sm:grid-cols-[1fr_auto]">
				<div>
					<div className="eyebrow">Empty studio</div>
					<h1
						className={cn(
							"-tracking-[0.025em] mt-4 font-semibold text-[2.5rem] text-foreground leading-[1.02] sm:text-[3rem]",
						)}
					>
						Nothing on
						<br />
						the shelf <span className="text-primary">yet.</span>
					</h1>
					<p className="mt-5 max-w-md text-[0.9375rem] text-muted-foreground leading-relaxed">
						Describe a character concept and the agent will draft an identity, a
						scenario, and the scene prompts to go with it. Or drop a saved file
						here to pick up where you left off.
					</p>
					<div className="mt-7 flex flex-wrap items-center gap-2">
						<a href="#/create">
							<Button className="glow-md hover:glow-lg" size="lg">
								<Plus className="h-4 w-4" />
								Begin a character
							</Button>
						</a>
						<Button onClick={onImport} size="lg" variant="outline">
							<UploadCloud className="h-4 w-4" />
							Open Files
						</Button>
					</div>
				</div>
				<div
					aria-hidden
					className="display-figure relative hidden text-[10rem] text-foreground/8 leading-none sm:block"
				>
					00
				</div>
			</div>
		</div>
	);
}
