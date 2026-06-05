import type { GenerateStepId, StepUsage } from "@shared/generate";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	KeyRound,
	Loader2,
	RefreshCw,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StepState {
	id: GenerateStepId;
	label: string;
	status: "idle" | "running" | "succeeded" | "failed" | "refusal-detected";
	error?: string;
	usage?: StepUsage;
	adminOverrideApplied?: boolean;
}

export interface GenerationStepsProps {
	steps: StepState[];
	superAdmin: boolean;
	onRetry?: (stepId: GenerateStepId) => void;
	title?: string;
}

function formatTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
	return `${Math.round(n / 1000)}k`;
}

function formatUsd(n: number): string {
	if (n === 0) return "$0";
	if (n < 0.01) return `$${n.toFixed(4)}`;
	if (n < 1) return `$${n.toFixed(3)}`;
	return `$${n.toFixed(2)}`;
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function totalTokens(usage: StepUsage): number {
	return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens;
}

export function GenerationSteps({
	steps,
	superAdmin,
	onRetry,
	title,
}: GenerationStepsProps) {
	const totals = steps.reduce(
		(acc, s) => {
			if (!s.usage) return acc;
			return {
				tokens: acc.tokens + totalTokens(s.usage),
				costUsd: acc.costUsd + s.usage.costUsd,
			};
		},
		{ tokens: 0, costUsd: 0 },
	);

	const hasRefusal = steps.some(
		(s) =>
			s.status === "refusal-detected" ||
			(s.status === "failed" && s.error?.toLowerCase().includes("refus")),
	);

	const runningCount = steps.filter((s) => s.status === "running").length;
	const doneCount = steps.filter((s) => s.status === "succeeded").length;

	return (
		<div className="animate-message-in flex flex-col gap-3">
			{title && (
				<div className="flex items-baseline justify-between gap-3">
					<div className="flex items-baseline gap-3">
						<span className="eyebrow text-foreground/55">{title}</span>
						<span className="font-medium text-[10.5px] text-foreground/40 tabular-nums uppercase tracking-[0.18em]">
							{String(doneCount).padStart(2, "0")} of{" "}
							{String(steps.length).padStart(2, "0")}
							{runningCount > 0 && " · running"}
						</span>
					</div>
					<span className="eyebrow text-foreground/40">Tokens · Cost</span>
				</div>
			)}
			<ol className="flex flex-col">
				{steps.map((step, i) => (
					<li
						key={step.id}
						className={cn(
							"flex flex-col gap-1 py-2.5",
							i > 0 && "border-foreground/8 border-t",
						)}
					>
						<div className="flex items-center gap-3">
							<span
								aria-hidden
								className="display-figure shrink-0 text-[0.8125rem] text-foreground/35 leading-none tabular-nums w-[1.75ch]"
							>
								{String(i + 1).padStart(2, "0")}
							</span>
							<StepIcon status={step.status} />
							<span
								className={cn(
									"flex-1 min-w-0 text-sm leading-tight",
									step.status === "succeeded"
										? "text-foreground/75"
										: step.status === "running"
											? "text-foreground"
											: step.status === "failed" ||
													step.status === "refusal-detected"
												? "text-foreground"
												: "text-foreground/55",
								)}
							>
								{step.label}
							</span>
							{step.adminOverrideApplied && (
								<span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 font-medium text-[10px] text-primary ring-1 ring-primary/30">
									<ShieldAlert className="h-2.5 w-2.5" />
									override
								</span>
							)}
							{step.usage && (
								<span
									className="hidden font-mono text-[11px] text-foreground/45 tabular-nums sm:inline"
									title={`in ${step.usage.inputTokens}, out ${step.usage.outputTokens}, cache-read ${step.usage.cacheReadTokens}, cache-create ${step.usage.cacheCreationTokens} · ${formatDuration(step.usage.durationMs)} · ${step.usage.model}`}
								>
									{formatTokens(totalTokens(step.usage))} ·{" "}
									{formatUsd(step.usage.costUsd)}
								</span>
							)}
							{(step.status === "failed" ||
								step.status === "refusal-detected") &&
								onRetry && (
									<Button
										onClick={() => onRetry(step.id)}
										size="icon-sm"
										title="Retry this step"
										variant="ghost"
									>
										<RefreshCw className="h-3.5 w-3.5" />
									</Button>
								)}
						</div>
						{(step.status === "failed" || step.status === "refusal-detected") &&
							step.error && (
								<div className="pl-[calc(1.75ch+1.5rem+0.75rem)]">
									<StepErrorBlock
										error={step.error}
										refusal={step.status === "refusal-detected"}
										superAdmin={superAdmin}
									/>
								</div>
							)}
					</li>
				))}
			</ol>
			<div className="flex items-center justify-between border-foreground/10 border-t pt-2.5">
				<span className="text-[11.5px] text-foreground/55 leading-tight">
					{hasRefusal && !superAdmin ? (
						<span className="text-primary/90">
							A step was refused. Enable Super Admin mode to force generation.
						</span>
					) : (
						"Total"
					)}
				</span>
				<span className="font-mono text-[11.5px] text-foreground/60 tabular-nums">
					{formatTokens(totals.tokens)} · {formatUsd(totals.costUsd)}
				</span>
			</div>
		</div>
	);
}

function StepErrorBlock({
	error,
	refusal,
	superAdmin,
}: {
	error: string;
	refusal: boolean;
	superAdmin: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const [copied, setCopied] = useState(false);
	const isAuth =
		error.includes("AUTH:") ||
		error.includes("MissingApiKeyError") ||
		error.includes("No OpenRouter API key") ||
		error.includes("No auth credentials");
	const firstLine = error.split("\n")[0].slice(0, 200);

	const handleCopy = () => {
		void navigator.clipboard
			.writeText(error)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1600);
			})
			.catch(() => {
				/* ignore */
			});
	};

	if (isAuth) {
		return (
			<div className="mt-1 animate-in fade-in rounded-md bg-destructive/10 px-2.5 py-1.5 text-destructive text-xs ring-1 ring-destructive/30 duration-200">
				<div className="flex flex-wrap items-center gap-1.5">
					<KeyRound className="h-3 w-3 shrink-0" />
					<span className="font-medium">
						OpenRouter API key missing or invalid.
					</span>
					<a
						className="ml-auto underline hover:text-foreground"
						href="#/settings"
					>
						Open settings
					</a>
				</div>
				<button
					className="mt-1 text-[11px] text-destructive/70 underline hover:text-destructive"
					onClick={() => setExpanded((v) => !v)}
					type="button"
				>
					{expanded ? "Hide details" : "Show raw error"}
				</button>
				{expanded && (
					<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[11px] text-destructive/80 ring-1 ring-destructive/20">
						{error}
					</pre>
				)}
			</div>
		);
	}

	const tone = refusal
		? "bg-card text-foreground ring-primary/30"
		: "bg-destructive/10 text-destructive ring-destructive/30";
	const label = refusal ? "Refusal detected" : "Generation failed";

	return (
		<div
			className={cn(
				"mt-1 animate-in fade-in rounded-md px-2.5 py-1.5 text-xs ring-1 duration-200",
				tone,
			)}
		>
			<div className="flex items-center gap-1.5">
				<button
					className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-primary/40 rounded"
					onClick={() => setExpanded((v) => !v)}
					type="button"
				>
					{expanded ? (
						<ChevronDown className="h-3 w-3 shrink-0" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0" />
					)}
					<span className="font-medium">{label}:</span>
					<span className="min-w-0 truncate opacity-80" title={firstLine}>
						{firstLine}
					</span>
				</button>
				<button
					aria-label="Copy error"
					className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] opacity-70 transition-opacity duration-150 ease-out outline-none hover:bg-foreground/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/40"
					onClick={handleCopy}
					type="button"
				>
					{copied ? (
						<Check className="h-3 w-3" />
					) : (
						<Copy className="h-3 w-3" />
					)}
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			{expanded && (
				<pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[11px] opacity-90 ring-1 ring-foreground/10">
					{error}
				</pre>
			)}
			{refusal && !superAdmin && (
				<p className="mt-1 text-[11px] opacity-80">
					<a className="underline hover:opacity-100" href="#/settings">
						Enable Super Admin mode
					</a>{" "}
					to force generation.
				</p>
			)}
		</div>
	);
}

function StepIcon({ status }: { status: StepState["status"] }) {
	if (status === "running") {
		return (
			<span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
				<Loader2 className="h-3.5 w-3.5 animate-spin" />
			</span>
		);
	}
	if (status === "succeeded") {
		return (
			<span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary/90">
				<Check className="h-3.5 w-3.5" strokeWidth={2.5} />
			</span>
		);
	}
	if (status === "failed") {
		return (
			<span className="flex h-4 w-4 shrink-0 items-center justify-center text-destructive">
				<AlertTriangle className="h-3.5 w-3.5" />
			</span>
		);
	}
	if (status === "refusal-detected") {
		return (
			<span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
				<ShieldAlert className="h-3.5 w-3.5" />
			</span>
		);
	}
	return (
		<span
			aria-hidden
			className="h-1 w-1 shrink-0 rounded-full bg-foreground/20"
		/>
	);
}
