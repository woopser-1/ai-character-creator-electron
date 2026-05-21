import { type ReactNode, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatContainerProps {
	children: ReactNode;
	/**
	 * Whether to auto-scroll to the bottom on every render. Defaults to true —
	 * the canonical chat behaviour. Set to false when the container is also
	 * rendering non-chat UI (e.g. a selection grid) whose re-renders would
	 * otherwise yank the page down with each interaction.
	 */
	autoScroll?: boolean;
}

export function ChatContainer({
	children,
	autoScroll = true,
}: ChatContainerProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!autoScroll) return;
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	});

	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
				{children}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
