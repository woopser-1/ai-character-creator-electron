import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { useClaudeStatus } from "@/hooks/use-claude-status";
import { useRoute } from "@/lib/router";

export function ClaudeStatusBanner() {
	const { status, error, recheck } = useClaudeStatus();
	const route = useRoute();

	if (status !== "disconnected") return null;

	const onSettings = route.name === "settings";

	return (
		<div className="animate-in slide-in-from-top-1 fade-in border-destructive/30 border-b bg-destructive/10 text-destructive duration-200 [-webkit-app-region:no-drag]">
			<div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-xs">
				<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
				<span className="flex-1 font-medium text-destructive">
					Claude Code is not connected. Character generation is disabled until
					it's fixed.
					{error && <span className="ml-2 text-destructive/70">{error}</span>}
				</span>
				<button
					className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive text-xs ring-1 ring-destructive/30 transition-colors duration-150 ease-out hover:bg-destructive/20"
					onClick={() => void recheck()}
					type="button"
				>
					<RefreshCw className="h-3 w-3" />
					Re-check
				</button>
				{!onSettings && (
					<a
						className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive text-xs ring-1 ring-destructive/30 transition-colors duration-150 ease-out hover:bg-destructive/20"
						href="#/settings"
					>
						How to fix
						<ArrowRight className="h-3 w-3" />
					</a>
				)}
			</div>
		</div>
	);
}
