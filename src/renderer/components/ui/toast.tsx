import { AlertTriangle, Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface ToastInput {
	id?: string;
	tone?: ToastTone;
	title: string;
	description?: string;
	action?: ToastAction;
	duration?: number;
}

interface InternalToast extends Required<Omit<ToastInput, "action" | "duration" | "description">> {
	description?: string;
	action?: ToastAction;
	duration: number;
}

interface ToastContextValue {
	push: (toast: ToastInput) => string;
	dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;
const MAX_STACK = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<InternalToast[]>([]);
	const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	const dismiss = useCallback((id: string) => {
		const timeouts = timeoutsRef.current;
		const handle = timeouts.get(id);
		if (handle) {
			clearTimeout(handle);
			timeouts.delete(id);
		}
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const push = useCallback(
		(toast: ToastInput): string => {
			const id =
				toast.id ??
				`toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const tone: ToastTone = toast.tone ?? "info";
			const duration = toast.duration ?? DEFAULT_DURATION_MS;
			const next: InternalToast = {
				id,
				tone,
				title: toast.title,
				description: toast.description,
				action: toast.action,
				duration,
			};
			setToasts((prev) => {
				const trimmed = prev.length >= MAX_STACK ? prev.slice(-MAX_STACK + 1) : prev;
				return [...trimmed, next];
			});
			if (duration > 0) {
				const handle = setTimeout(() => dismiss(id), duration);
				timeoutsRef.current.set(id, handle);
			}
			return id;
		},
		[dismiss],
	);

	useEffect(
		() => () => {
			for (const handle of timeoutsRef.current.values()) clearTimeout(handle);
			timeoutsRef.current.clear();
		},
		[],
	);

	const value = useMemo<ToastContextValue>(
		() => ({ push, dismiss }),
		[push, dismiss],
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<ToastViewport onDismiss={dismiss} toasts={toasts} />
		</ToastContext.Provider>
	);
}

function ToastViewport({
	toasts,
	onDismiss,
}: {
	toasts: InternalToast[];
	onDismiss: (id: string) => void;
}) {
	return (
		<div
			aria-live="polite"
			className="pointer-events-none fixed top-16 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col items-end gap-2 sm:right-6 sm:top-20"
		>
			<AnimatePresence initial={false}>
				{toasts.map((t) => (
					<ToastCard key={t.id} onDismiss={() => onDismiss(t.id)} toast={t} />
				))}
			</AnimatePresence>
		</div>
	);
}

function ToastCard({
	toast,
	onDismiss,
}: {
	toast: InternalToast;
	onDismiss: () => void;
}) {
	const tone = toast.tone;
	const Icon = tone === "error" ? AlertTriangle : Check;
	return (
		<motion.div
			animate={{ opacity: 1, x: 0, scale: 1 }}
			className={cn(
				"pointer-events-auto relative w-full overflow-hidden rounded-xl bg-popover/95 backdrop-blur-2xl",
				tone === "error"
					? "ring-1 ring-destructive/40 [box-shadow:0_0_0_1px_oklch(0.66_0.22_25/0.35),0_0_28px_oklch(0.66_0.22_25/0.18)]"
					: "ring-1 ring-foreground/10 glow-rim",
			)}
			exit={{ opacity: 0, x: 24, scale: 0.96 }}
			initial={{ opacity: 0, x: 24, scale: 0.96 }}
			layout
			transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
		>
			<div className="flex items-start gap-3 p-3.5 pr-9">
				<span
					aria-hidden
					className={cn(
						"mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1",
						tone === "error"
							? "bg-destructive/15 text-destructive ring-destructive/30"
							: "bg-primary/15 text-primary ring-primary/30",
					)}
				>
					<Icon className="h-3.5 w-3.5" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="-tracking-[0.005em] truncate font-semibold text-[0.875rem] text-foreground leading-tight">
						{toast.title}
					</div>
					{toast.description && (
						<div className="mt-1 break-words font-mono text-[11px] text-muted-foreground leading-relaxed">
							{toast.description}
						</div>
					)}
					{toast.action && (
						<button
							className="mt-2 inline-flex items-center font-medium text-[0.75rem] text-primary tracking-[0.01em] transition-colors duration-150 ease-out hover:text-[oklch(0.8_0.28_303)]"
							onClick={() => {
								toast.action?.onClick();
								onDismiss();
							}}
							type="button"
						>
							{toast.action.label}
							<span aria-hidden className="ml-1 transition-transform duration-150 group-hover:translate-x-0.5">
								›
							</span>
						</button>
					)}
				</div>
			</div>
			<button
				aria-label="Dismiss"
				className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-foreground/45 transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
				onClick={onDismiss}
				type="button"
			>
				<X className="h-3 w-3" />
			</button>
		</motion.div>
	);
}

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error("useToast must be used inside a ToastProvider");
	}
	return ctx;
}
