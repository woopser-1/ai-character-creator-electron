import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useChromeSlots } from "@/lib/chrome-context";

export function SubHeaderSlot({ children }: { children: ReactNode }) {
	const { subHeaderEl } = useChromeSlots();
	if (!subHeaderEl) return null;
	return createPortal(children, subHeaderEl);
}

export function ChatDockSlot({ children }: { children: ReactNode }) {
	const { chatDockEl } = useChromeSlots();
	if (!chatDockEl) return null;
	return createPortal(children, chatDockEl);
}
