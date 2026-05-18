import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

interface ChromeSlots {
	subHeaderEl: HTMLElement | null;
	chatDockEl: HTMLElement | null;
}

interface ChromeContextValue extends ChromeSlots {
	setSubHeaderEl: (el: HTMLElement | null) => void;
	setChatDockEl: (el: HTMLElement | null) => void;
}

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function ChromeProvider({ children }: { children: ReactNode }) {
	const [subHeaderEl, setSubHeaderElState] = useState<HTMLElement | null>(null);
	const [chatDockEl, setChatDockElState] = useState<HTMLElement | null>(null);

	const setSubHeaderEl = useCallback((el: HTMLElement | null) => {
		setSubHeaderElState(el);
	}, []);
	const setChatDockEl = useCallback((el: HTMLElement | null) => {
		setChatDockElState(el);
	}, []);

	const value = useMemo<ChromeContextValue>(
		() => ({ subHeaderEl, chatDockEl, setSubHeaderEl, setChatDockEl }),
		[subHeaderEl, chatDockEl, setSubHeaderEl, setChatDockEl],
	);

	return (
		<ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
	);
}

export function useChromeSlots(): ChromeSlots {
	const ctx = useContext(ChromeContext);
	if (!ctx)
		throw new Error("useChromeSlots must be used inside ChromeProvider");
	return { subHeaderEl: ctx.subHeaderEl, chatDockEl: ctx.chatDockEl };
}

export function useChromeRefs(): {
	setSubHeaderEl: (el: HTMLElement | null) => void;
	setChatDockEl: (el: HTMLElement | null) => void;
} {
	const ctx = useContext(ChromeContext);
	if (!ctx) throw new Error("useChromeRefs must be used inside ChromeProvider");
	return {
		setSubHeaderEl: ctx.setSubHeaderEl,
		setChatDockEl: ctx.setChatDockEl,
	};
}
