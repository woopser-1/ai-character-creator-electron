import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GroupChatCard } from "@/components/group-chat-card";
import { Button } from "@/components/ui/button";
import type { StoredCharacter, StoredGroupChat } from "@/lib/types";

export function GroupChatsPage() {
	const [groupChats, setGroupChats] = useState<StoredGroupChat[]>([]);
	const [characters, setCharacters] = useState<StoredCharacter[]>([]);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		void Promise.all([
			window.api.groupChats.list(),
			window.api.characters.list(),
		]).then(([gcs, cs]) => {
			setGroupChats(gcs);
			setCharacters(cs);
			setLoaded(true);
		});
	}, []);

	useEffect(() => {
		const refresh = () => {
			void Promise.all([
				window.api.groupChats.list(),
				window.api.characters.list(),
			]).then(([gcs, cs]) => {
				setGroupChats(gcs);
				setCharacters(cs);
			});
		};
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

	const charactersById = useMemo(
		() => new Map(characters.map((c) => [c.id, c])),
		[characters],
	);

	if (!loaded) {
		return <div className="flex-1" />;
	}

	if (groupChats.length === 0) {
		return (
			<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pt-24 pb-16 text-center">
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
					AI, and we'll produce a copy-ready title, public blurb, multi-speaker
					scenario, and director's-cut private notes for your downstream chat.
				</p>
				<a href="#/group-chats/create">
					<Button className="glow-md hover:glow-lg">
						<Users className="mr-1 h-3.5 w-3.5" />
						New Group Chat
					</Button>
				</a>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 pt-8 pb-16">
			<div className="flex items-end justify-between gap-4">
				<div className="flex flex-col gap-2">
					<span className="eyebrow text-foreground/55">Group Chats</span>
					<h1 className="-tracking-[0.02em] font-semibold text-[2rem] text-foreground leading-tight sm:text-[2.5rem]">
						Multi-character scenarios
					</h1>
				</div>
				<a href="#/group-chats/create">
					<Button size="sm">
						<Users className="mr-1 h-3.5 w-3.5" />
						New Group Chat
					</Button>
				</a>
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{groupChats.map((gc, idx) => (
					<GroupChatCard
						charactersById={charactersById}
						data={gc}
						index={idx}
						key={gc.id}
					/>
				))}
			</div>
		</div>
	);
}
