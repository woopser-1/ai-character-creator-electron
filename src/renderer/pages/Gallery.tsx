import { Plus, UploadCloud } from "lucide-react";
import { type DragEvent, useCallback, useEffect, useState } from "react";
import { CharacterCard } from "@/components/character-card";
import { FilesTriggerButton, useFilesSheet } from "@/components/files-sheet";
import { Button } from "@/components/ui/button";
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

	// Re-fetch when the sheet might have changed the underlying list.
	// The provider holds its own copy too, but Gallery is the canonical surface.
	useEffect(() => {
		const handler = () => {
			void window.api.characters.list().then((list) => {
				setCharacters(list);
				syncCharacters(list);
			});
		};
		window.addEventListener("focus", handler);
		return () => window.removeEventListener("focus", handler);
	}, [syncCharacters]);

	const acceptDrop = useCallback(
		(files: FileList) => {
			const acceptor = (
				window as unknown as { __filesSheetAcceptDrop?: (f: FileList) => void }
			).__filesSheetAcceptDrop;
			if (acceptor) {
				acceptor(files);
				openFiles();
				// Refresh shortly after; the sheet will refresh state itself, but the
				// Gallery grid needs to pick up the new rows too.
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
		// Only clear when leaving the container entirely.
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

	if (!loaded) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<div className="flex items-center gap-1.5">
					<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70" />
					<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:200ms]" />
					<span className="h-1.5 w-1.5 animate-thinking-dot rounded-full bg-primary/70 [animation-delay:400ms]" />
				</div>
			</div>
		);
	}

	if (characters.length === 0) {
		return (
			<div
				className="relative flex min-h-0 flex-1 flex-col"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<EmptyStudio onImport={() => openFiles()} />
				<DragOverlay show={pageDragOver} />
			</div>
		);
	}

	return (
		<div
			className="relative mx-auto w-full max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14"
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<Masthead count={characters.length} />

			<div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
				{characters.map((c, i) => (
					<CharacterCard data={c} index={i} key={c.id} />
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
					<div className="eyebrow text-foreground/55">The index</div>
					<div className="mt-1.5 text-[0.8125rem] text-muted-foreground">
						{count === 1 ? "Character on the shelf" : "Characters on the shelf"}
					</div>
				</div>
			</div>
			<div
				aria-hidden
				className="hidden h-px self-end bg-gradient-to-r from-foreground/15 via-foreground/8 to-transparent sm:block sm:mb-5"
			/>
			<div className="flex items-center justify-between gap-2 sm:justify-end sm:pb-3">
				<span className="font-medium text-[10.5px] text-foreground/45 uppercase tracking-[0.22em] sm:hidden">
					The studio
				</span>
				<div className="flex items-center gap-1.5">
					<FilesTriggerButton />
					<a href="#/create">
						<Button className="glow-sm hover:glow-md" size="sm">
							<Plus className="h-3.5 w-3.5" />
							New character
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
						Files will open with the result
					</div>
				</div>
			</div>
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
