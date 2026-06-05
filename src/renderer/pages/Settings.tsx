import type { ImageRefreshResult } from "@shared/images";
import {
	DEFAULT_FAST_MODEL,
	DEFAULT_MAIN_MODEL,
	OPENROUTER_MODEL_PRESETS,
} from "@shared/schemas";
import {
	CheckCircle2,
	Cpu,
	Images,
	KeyRound,
	Loader2,
	Plug,
	RefreshCw,
	ShieldAlert,
	ShieldCheck,
	XCircle,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApiKeyStatus } from "@/hooks/use-api-key-status";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

function formatTimestamp(iso?: string): string {
	if (!iso) return "never";
	const parsed = Date.parse(iso);
	if (Number.isNaN(parsed)) return "never";
	return new Date(parsed).toLocaleString();
}

export function SettingsPage() {
	const { settings, loading, update } = useSettings();

	const superAdmin = settings?.superAdmin ?? false;
	const mainModel = settings?.mainModel ?? DEFAULT_MAIN_MODEL;
	const fastModel = settings?.fastModel ?? DEFAULT_FAST_MODEL;
	const lastImageRefreshAt = settings?.lastImageRefreshAt;

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
				<OpenRouterCard />

				<div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
							<Cpu className="h-4 w-4" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm">Generation models</p>
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								OpenRouter models used for generation. The main model handles
								the heavy steps (light, scenario, personality, scenes, group
								chats) and the gathering chat; the fast model handles lighter
								steps (visual, measurements, profile inference). Pick a preset
								or paste any OpenRouter model ID.
							</p>

							<div className="mt-4 space-y-4">
								<ModelTierField
									label="Main model"
									icon={<Cpu className="h-3.5 w-3.5" />}
									value={mainModel}
									disabled={loading}
									onChange={(id) => void update({ mainModel: id })}
								/>
								<ModelTierField
									label="Fast model"
									icon={<Zap className="h-3.5 w-3.5" />}
									value={fastModel}
									disabled={loading}
									onChange={(id) => void update({ fastModel: id })}
								/>
							</div>
						</div>
					</div>
				</div>

				<ImagesCard lastRefreshAt={lastImageRefreshAt} />

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

function OpenRouterCard() {
	const { status, maskedHint, refresh } = useApiKeyStatus();

	const [keyInput, setKeyInput] = useState("");
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<{
		ok: boolean;
		error?: string;
	} | null>(null);

	const hasKey = status === "present";

	const onSave = async () => {
		if (!keyInput.trim()) return;
		setSaving(true);
		setTestResult(null);
		try {
			await window.api.settings.setApiKey(keyInput.trim());
			setKeyInput("");
			await refresh();
		} finally {
			setSaving(false);
		}
	};

	const onTest = async () => {
		setTesting(true);
		setTestResult(null);
		try {
			const result = await window.api.openrouter.test();
			setTestResult(result);
		} finally {
			setTesting(false);
		}
	};

	return (
		<div
			className={cn(
				"rounded-xl bg-card p-5 ring-1 transition-colors duration-200 ease-out",
				hasKey ? "ring-foreground/10" : "ring-destructive/30",
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
						hasKey
							? "glow-xs bg-secondary text-primary ring-1 ring-primary/30"
							: "bg-destructive/15 text-destructive",
					)}
				>
					<KeyRound className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">OpenRouter API key</p>
					<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
						Your key is stored encrypted on this device (OS keychain) and used
						for every generation call. Get one at{" "}
						<button
							className="font-medium text-foreground/80 underline underline-offset-2 hover:text-foreground"
							onClick={() =>
								void window.api.shell.openExternal("https://openrouter.ai/keys")
							}
							type="button"
						>
							openrouter.ai/keys
						</button>
						.
					</p>

					{hasKey && (
						<p className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
							<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
							Key saved
							{maskedHint && (
								<span className="font-mono text-foreground/70">
									(ending in {maskedHint})
								</span>
							)}
						</p>
					)}

					<div className="mt-3 flex flex-wrap items-center gap-2">
						<input
							autoComplete="off"
							className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2 font-mono text-foreground text-xs outline-none ring-1 ring-foreground/10 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40"
							onChange={(e) => setKeyInput(e.target.value)}
							placeholder={
								hasKey ? "Replace key (sk-or-…)" : "Paste key (sk-or-…)"
							}
							spellCheck={false}
							type="password"
							value={keyInput}
						/>
						<button
							className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs transition-colors duration-150 ease-out hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={saving || !keyInput.trim()}
							onClick={() => void onSave()}
							type="button"
						>
							{saving && <Loader2 className="h-3 w-3 animate-spin" />}
							Save
						</button>
						<button
							className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 font-medium text-foreground text-xs ring-1 ring-foreground/10 transition-colors duration-150 ease-out hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={testing || !hasKey}
							onClick={() => void onTest()}
							type="button"
						>
							{testing ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<Plug className="h-3 w-3" />
							)}
							Test
						</button>
					</div>

					{testResult && (
						<p
							className={cn(
								"mt-2 flex items-start gap-1.5 text-xs",
								testResult.ok ? "text-primary" : "text-destructive",
							)}
						>
							{testResult.ok ? (
								<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							) : (
								<XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
							)}
							{testResult.ok ? (
								"Connection succeeded — your key and main model work."
							) : (
								<span className="font-mono text-[11px] leading-relaxed">
									{testResult.error}
								</span>
							)}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function ImagesCard({ lastRefreshAt }: { lastRefreshAt?: string }) {
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState<{
		done: number;
		total: number;
	} | null>(null);
	const [lastResult, setLastResult] = useState<ImageRefreshResult | null>(null);

	useEffect(() => window.api.images.onProgress(setProgress), []);

	const onRefresh = async () => {
		setBusy(true);
		setProgress(null);
		setLastResult(null);
		try {
			const result = await window.api.images.refreshAll();
			setLastResult(result);
		} finally {
			setBusy(false);
			setProgress(null);
		}
	};

	const lastRun = lastResult?.finishedAt ?? lastRefreshAt;

	return (
		<div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
					<Images className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<p className="font-medium text-sm">Profile images</p>
							<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
								OurDream image links expire over time. A daily background task
								re-fetches a fresh link for every character that has an OurDream
								URL. You can also refresh them all now.
							</p>
						</div>
						<button
							className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 font-medium text-foreground text-xs ring-1 ring-foreground/10 transition-colors duration-150 ease-out hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={busy}
							onClick={() => void onRefresh()}
							type="button"
						>
							{busy ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<RefreshCw className="h-3 w-3" />
							)}
							Refresh now
						</button>
					</div>

					<p className="mt-3 text-muted-foreground text-[11px]">
						Last refresh:{" "}
						<span className="text-foreground/70">
							{formatTimestamp(lastRun)}
						</span>
					</p>

					{busy && progress && (
						<p className="mt-1 text-muted-foreground text-[11px]">
							Refreshing {progress.done}/{progress.total}…
						</p>
					)}

					{!busy && lastResult && (
						<p className="mt-1 text-[11px] text-foreground/70">
							{lastResult.total === 0
								? "No characters have an OurDream URL yet."
								: `${lastResult.refreshed}/${lastResult.total} refreshed${
										lastResult.failed > 0
											? ` · ${lastResult.failed} failed`
											: ""
									}.`}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function ModelTierField({
	label,
	icon,
	value,
	disabled,
	onChange,
}: {
	label: string;
	icon: React.ReactNode;
	value: string;
	disabled?: boolean;
	onChange: (id: string) => void;
}) {
	const isPreset = OPENROUTER_MODEL_PRESETS.some((p) => p.id === value);
	const [custom, setCustom] = useState(!isPreset);

	const selectValue = custom ? "__custom__" : value;

	return (
		<div>
			<p className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground/80 text-xs">
				{icon}
				{label}
			</p>
			<select
				className="w-full cursor-pointer rounded-md bg-muted px-3 py-2 text-foreground text-xs outline-none ring-1 ring-foreground/10 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60"
				disabled={disabled}
				onChange={(e) => {
					const next = e.target.value;
					if (next === "__custom__") {
						setCustom(true);
						return;
					}
					setCustom(false);
					onChange(next);
				}}
				value={selectValue}
			>
				{OPENROUTER_MODEL_PRESETS.map((preset) => (
					<option key={preset.id} value={preset.id}>
						{preset.label} — {preset.id}
					</option>
				))}
				<option value="__custom__">Custom…</option>
			</select>

			{custom && (
				<input
					className="mt-2 w-full rounded-md bg-muted px-3 py-2 font-mono text-foreground text-xs outline-none ring-1 ring-foreground/10 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40"
					defaultValue={value}
					disabled={disabled}
					onBlur={(e) => {
						const next = e.target.value.trim();
						if (next && next !== value) onChange(next);
					}}
					placeholder="provider/model-id"
					spellCheck={false}
				/>
			)}
		</div>
	);
}
