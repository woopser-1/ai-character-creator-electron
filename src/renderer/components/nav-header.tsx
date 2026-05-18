import { Maximize2, Minimize2, Minus, Plus, Settings, X } from "lucide-react";
import { motion } from "motion/react";
import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRoute } from "@/lib/router";
import { cn } from "@/lib/utils";

const isMac = window.api.window.platform === "darwin";

const DRAG_STYLE = { WebkitAppRegion: "drag" } as unknown as CSSProperties;
const NO_DRAG_STYLE = {
	WebkitAppRegion: "no-drag",
} as unknown as CSSProperties;

type RailKey = "gallery" | "settings";

export function NavHeader() {
	const route = useRoute();
	const railKey: RailKey | null =
		route.name === "gallery"
			? "gallery"
			: route.name === "settings"
				? "settings"
				: null;
	const createActive = route.name === "create";

	return (
		<header
			className="sticky top-0 z-50 border-border border-b bg-background/85 backdrop-blur-md"
			style={DRAG_STYLE}
		>
			<div className="chrome-rail flex h-14 items-center justify-between gap-6">
				<a
					aria-label="Go to gallery"
					className="group/brand flex items-center gap-2.5 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
					href="#/"
					style={NO_DRAG_STYLE}
				>
					<div
						aria-hidden
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary font-semibold text-[11px] text-foreground tracking-tight ring-1 ring-foreground/10 transition-shadow duration-250 ease-out group-hover/brand:[box-shadow:0_0_0_1px_oklch(0.78_0.27_305_/_0.25),0_0_16px_oklch(0.72_0.25_305_/_0.08)]"
					>
						ac
					</div>
					<span className="-tracking-[0.015em] font-semibold text-[0.875rem] text-foreground/95">
						AI Character Creator
					</span>
				</a>
				<div className="flex items-center gap-5" style={NO_DRAG_STYLE}>
					<nav className="flex items-center gap-5">
						<RailLink active={railKey === "gallery"} href="#/">
							Gallery
						</RailLink>
						<RailLink
							active={railKey === "settings"}
							href="#/settings"
							iconOnly
						>
							<Settings className="h-3.5 w-3.5" />
							<span className="sr-only">Settings</span>
						</RailLink>
					</nav>
					<span aria-hidden className="h-3.5 w-px bg-[oklch(1_0_0_/_18%)]" />
					<a className="relative" href="#/create">
						<Button
							aria-current={createActive ? "page" : undefined}
							className={cn(
								"glow-sm transition-shadow duration-200 ease-out hover:glow-md",
								createActive && "glow-md ring-1 ring-ring/45",
							)}
							size="sm"
						>
							<Plus className="mr-1 h-3.5 w-3.5" />
							Create
						</Button>
					</a>
					{!isMac && <WindowControls />}
				</div>
			</div>
		</header>
	);
}

interface RailLinkProps {
	href: string;
	active: boolean;
	iconOnly?: boolean;
	children: React.ReactNode;
}

function RailLink({ href, active, iconOnly, children }: RailLinkProps) {
	return (
		<a
			aria-current={active ? "page" : undefined}
			className="group/rail inline-flex items-center rounded-sm py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
			href={href}
		>
			<span
				className={cn(
					"relative inline-flex items-center font-medium text-[0.8125rem] transition-colors duration-200",
					active
						? "text-foreground"
						: "text-muted-foreground group-hover/rail:text-foreground",
					iconOnly && "px-0.5",
				)}
			>
				{children}
				{active && (
					<motion.span
						aria-hidden
						className="glow-xs absolute inset-x-0 -bottom-1.5 h-[1.5px] rounded-full bg-primary"
						layoutId="nav-rail-underline"
						transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
					/>
				)}
			</span>
		</a>
	);
}

function WindowControls() {
	const [maximized, setMaximized] = useState(false);

	useEffect(() => {
		void window.api.window.isMaximized().then(setMaximized);
		const off = window.api.window.onMaximizeChange(setMaximized);
		return () => off();
	}, []);

	return (
		<div className="ml-2 flex items-center" style={NO_DRAG_STYLE}>
			<button
				aria-label="Minimize"
				className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
				onClick={() => void window.api.window.minimize()}
				type="button"
			>
				<Minus className="h-3.5 w-3.5" />
			</button>
			<button
				aria-label={maximized ? "Restore" : "Maximize"}
				className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground"
				onClick={async () => {
					const next = await window.api.window.toggleMaximize();
					setMaximized(next.maximized);
				}}
				type="button"
			>
				{maximized ? (
					<Minimize2 className="h-3 w-3" />
				) : (
					<Maximize2 className="h-3 w-3" />
				)}
			</button>
			<button
				aria-label="Close"
				className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors duration-150 ease-out hover:bg-destructive hover:text-primary-foreground"
				onClick={() => void window.api.window.close()}
				type="button"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}
