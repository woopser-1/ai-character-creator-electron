import {
	DEFAULT_GENERATION_MODEL,
	GENERATION_MODEL_META,
	GENERATION_MODELS,
	type GenerationModel,
} from "@shared/schemas";
import {
	AlertTriangle,
	CheckCircle2,
	Cpu,
	Loader2,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
	Terminal,
} from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { useClaudeStatus } from "@/hooks/use-claude-status";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

const INSTALL_COMMAND = "npm install -g @anthropic-ai/claude-code";
const LOGIN_COMMAND = "claude login";

export function SettingsPage() {
	const { settings, loading, update } = useSettings();
	const claude = useClaudeStatus();

	const superAdmin = settings?.superAdmin ?? false;
	const generationModel: GenerationModel =
		settings?.generationModel ?? DEFAULT_GENERATION_MODEL;

	return (
		<div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
			<div className="mb-8 flex items-center gap-3">
				<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
					<ShieldCheck className="h-4 w-4" />
				</div>
				<div>
					<h1 className="font-semibold text-lg tracking-tight">Settings</h1>
					<p className="text-muted-foreground text-xs">
						Application configuration
					</p>
				</div>
			</div>

			<div className="space-y-4">
				<ClaudeStatusCard
					status={claude.status}
					version={claude.version}
					error={claude.error}
					onRecheck={() => void claude.recheck()}
				/>

				<div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
							<Cpu className="h-4 w-4" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm">Generation model</p>
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								The Claude model used for character generation, scene prompts,
								and the gathering chat. Opus delivers the highest quality;
								Sonnet is faster and cheaper.
							</p>
							<div className="mt-3 grid gap-2 sm:grid-cols-2">
								{GENERATION_MODELS.map((model) => {
									const meta = GENERATION_MODEL_META[model];
									const active = generationModel === model;
									return (
										<button
											key={model}
											aria-pressed={active}
											className={cn(
												"group relative rounded-lg px-3 py-2.5 text-left outline-none transition-all duration-150 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
												active
													? "bg-secondary text-foreground glow-ring"
													: "bg-muted text-foreground/90 ring-1 ring-foreground/10 hover:glow-rim hover:ring-transparent",
												loading ? "cursor-wait opacity-60" : "cursor-pointer",
											)}
											disabled={loading || active}
											onClick={() => void update({ generationModel: model })}
											type="button"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="font-medium text-sm">
													{meta.label}
												</span>
												{active && (
													<span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase tracking-wide">
														Active
													</span>
												)}
											</div>
											<p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
												{meta.description}
											</p>
										</button>
									);
								})}
							</div>
						</div>
					</div>
				</div>

				<div
					className={cn(
						"rounded-xl p-5 ring-1 transition-colors duration-200 ease-out",
						superAdmin
							? "bg-card ring-primary/30"
							: "bg-card ring-foreground/10",
					)}
				>
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3">
							<div
								className={cn(
									"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
									superAdmin
										? "bg-primary/15 text-primary"
										: "bg-secondary text-muted-foreground",
								)}
							>
								<ShieldAlert className="h-4 w-4" />
							</div>
							<div>
								<p className="font-medium text-sm">Super Admin Mode</p>
								<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
									Overrides AI-agent refusals based on character consistency
									("this scene does not fit the character's personality", "out
									of character", etc.). The operator's creative intent takes
									precedence over the agent's self-judgment.
									<br />
									<span className="mt-1 inline-block font-medium text-foreground/70">
										Absolute legal limits still apply (no content involving
										minors).
									</span>
								</p>
							</div>
						</div>
						<button
							aria-label="Toggle super administrator"
							aria-pressed={superAdmin}
							className={cn(
								"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors duration-200 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
								superAdmin ? "bg-primary" : "bg-secondary",
								loading ? "cursor-wait opacity-60" : "cursor-pointer",
							)}
							disabled={loading}
							onClick={() => void update({ superAdmin: !superAdmin })}
							type="button"
						>
							<span
								className={cn(
									"inline-block h-5 w-5 rounded-full bg-foreground transition-transform duration-200 ease-out",
									superAdmin ? "translate-x-5" : "translate-x-0.5",
								)}
							/>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function ClaudeStatusCard({
	status,
	version,
	error,
	onRecheck,
}: {
	status: "checking" | "connected" | "disconnected";
	version?: string;
	error?: string;
	onRecheck: () => void;
}) {
	const ring =
		status === "disconnected" ? "ring-destructive/30" : "ring-foreground/10";

	return (
		<div
			className={cn(
				"rounded-xl bg-card p-5 ring-1 transition-colors duration-200 ease-out",
				ring,
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div
						className={cn(
							"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
							status === "connected"
								? "glow-xs bg-secondary text-primary ring-1 ring-primary/30"
								: status === "disconnected"
									? "bg-destructive/15 text-destructive"
									: "bg-secondary text-muted-foreground",
						)}
					>
						{status === "connected" && <CheckCircle2 className="h-4 w-4" />}
						{status === "disconnected" && <AlertTriangle className="h-4 w-4" />}
						{status === "checking" && (
							<Loader2 className="h-4 w-4 animate-spin" />
						)}
					</div>
					<div className="min-w-0">
						<p className="font-medium text-sm">Claude Code connection</p>
						{status === "connected" && (
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								Connected and ready for generation.
								{version && (
									<>
										{" "}
										<span className="font-mono text-foreground/70">
											{version}
										</span>
									</>
								)}
							</p>
						)}
						{status === "checking" && (
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								Checking the Claude Code CLI…
							</p>
						)}
						{status === "disconnected" && (
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								The Claude Code CLI is not available or not authenticated.
								Character generation won't work until this is fixed.
								{error && (
									<span className="mt-1 block font-mono text-[11px] text-destructive/80">
										{error}
									</span>
								)}
							</p>
						)}
					</div>
				</div>
				<button
					className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 font-medium text-foreground text-xs ring-1 ring-foreground/10 transition-colors duration-150 ease-out hover:bg-secondary/80"
					onClick={onRecheck}
					type="button"
				>
					<RefreshCw className="h-3 w-3" />
					Re-check
				</button>
			</div>

			{status === "disconnected" && (
				<div className="mt-4 space-y-3 border-border border-t pt-4">
					<p className="flex items-center gap-2 font-medium text-xs">
						<Terminal className="h-3.5 w-3.5 text-muted-foreground" />
						How to fix, run these in a terminal
					</p>
					<CommandRow
						label="1. Install the Claude Code CLI"
						command={INSTALL_COMMAND}
					/>
					<CommandRow
						label="2. Authenticate your account"
						command={LOGIN_COMMAND}
					/>
					<p className="text-muted-foreground text-[11px] leading-relaxed">
						Once both commands succeed, click <strong>Re-check</strong> above.
					</p>
				</div>
			)}
		</div>
	);
}

function CommandRow({ label, command }: { label: string; command: string }) {
	return (
		<div>
			<p className="mb-1 text-muted-foreground text-[11px]">{label}</p>
			<div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 ring-1 ring-foreground/10">
				<code className="flex-1 select-all overflow-x-auto font-mono text-xs text-foreground/90">
					{command}
				</code>
				<CopyButton value={command} />
			</div>
		</div>
	);
}
