import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { ChatInput } from "@/components/chat/chat-input";

interface ChatDockProps {
	onSend: (text: string) => void;
	placeholder?: string;
	disabled?: boolean;
	extraAbove?: ReactNode;
}

export function ChatDock({
	onSend,
	placeholder,
	disabled,
	extraAbove,
}: ChatDockProps) {
	return (
		<motion.div
			animate={{ y: 0, opacity: 1 }}
			className="relative border-border border-t bg-background/80 backdrop-blur-xl [background-image:radial-gradient(ellipse_70%_120%_at_50%_100%,oklch(0.72_0.25_305_/_0.08),transparent_60%)]"
			initial={{ y: 8, opacity: 0 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
		>
			<motion.div
				className="mx-auto w-full max-w-3xl px-4 py-2.5 sm:px-6"
				layout="position"
				transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
			>
				<AnimatePresence initial={false} mode="popLayout">
					{extraAbove && (
						<motion.div
							animate={{ height: "auto", opacity: 1 }}
							className="overflow-hidden"
							exit={{ height: 0, opacity: 0 }}
							initial={{ height: 0, opacity: 0 }}
							key="extra"
							transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
						>
							<div className="pb-2.5">{extraAbove}</div>
						</motion.div>
					)}
				</AnimatePresence>
				<ChatInput
					disabled={disabled}
					onSend={onSend}
					placeholder={placeholder}
				/>
			</motion.div>
		</motion.div>
	);
}
