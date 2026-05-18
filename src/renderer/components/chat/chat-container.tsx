import { type ReactNode, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatContainerProps {
	children: ReactNode;
}

export function ChatContainer({ children }: ChatContainerProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
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
