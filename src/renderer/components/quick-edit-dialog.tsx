import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DEFAULT_IMAGE_MODEL,
	DEFAULT_MESSAGE_LENGTH,
	DIFFICULTIES,
	DIFFICULTY_META,
	type Difficulty,
	IMAGE_MODEL_META,
	IMAGE_MODELS,
	type ImageModel,
	MESSAGE_LENGTH_META,
	MESSAGE_LENGTHS,
	type MessageLength,
	type StoredCharacter,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface QuickEditDialogProps {
	data: StoredCharacter;
	gatheringSummary: string;
	onOpenChange: (open: boolean) => void;
	onUpdated: (next: StoredCharacter) => void;
	open: boolean;
}

type RunStage = "idle" | "scenario" | "difficulty" | "scenes";

const STAGE_LABEL: Record<Exclude<RunStage, "idle">, string> = {
	scenario: "Re-running scenario for new reply length",
	difficulty: "Rebuilding mood, intimacy, scenario",
	scenes: "Rewriting all scenes in new model",
};

export function QuickEditDialog({
	data,
	gatheringSummary,
	onOpenChange,
	onUpdated,
	open,
}: QuickEditDialogProps) {
	const storedLength = data.messageLength ?? DEFAULT_MESSAGE_LENGTH;
	const storedDifficulty = data.difficulty;
	const storedModel = data.imageModel ?? DEFAULT_IMAGE_MODEL;

	const [draftLength, setDraftLength] = useState<MessageLength>(storedLength);
	const [draftDifficulty, setDraftDifficulty] =
		useState<Difficulty>(storedDifficulty);
	const [draftModel, setDraftModel] = useState<ImageModel>(storedModel);
	const [stage, setStage] = useState<RunStage>("idle");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setDraftLength(storedLength);
			setDraftDifficulty(storedDifficulty);
			setDraftModel(storedModel);
			setStage("idle");
			setError(null);
		}
	}, [open, storedLength, storedDifficulty, storedModel]);

	const lengthChanged = draftLength !== storedLength;
	const difficultyChanged = draftDifficulty !== storedDifficulty;
	const modelChanged = draftModel !== storedModel;
	const hasChanges = lengthChanged || difficultyChanged || modelChanged;
	const busy = stage !== "idle";

	const handleSubmit = useCallback(async () => {
		if (!hasChanges || busy) return;
		setError(null);

		let current: StoredCharacter = data;

		if (lengthChanged) {
			setStage("scenario");
			const res = await window.api.characters.updateMessageLength(
				current.id,
				draftLength,
				gatheringSummary,
			);
			if (!res.success) {
				setStage("idle");
				setError(res.error);
				return;
			}
			current = res.stored;
			onUpdated(current);
		}

		if (difficultyChanged) {
			setStage("difficulty");
			const res = await window.api.characters.regenerateForDifficulty(
				current.id,
				draftDifficulty,
				gatheringSummary,
			);
			if (!res.success) {
				setStage("idle");
				setError(res.error);
				return;
			}
			current = res.stored;
			onUpdated(current);
		}

		if (modelChanged) {
			setStage("scenes");
			const res = await window.api.characters.regenerateScenes(
				current.id,
				draftModel,
			);
			if (!res.success) {
				setStage("idle");
				setError(res.error);
				return;
			}
			current = res.stored;
			onUpdated(current);
		}

		setStage("idle");
		onOpenChange(false);
	}, [
		busy,
		data,
		difficultyChanged,
		draftDifficulty,
		draftLength,
		draftModel,
		gatheringSummary,
		hasChanges,
		lengthChanged,
		modelChanged,
		onOpenChange,
		onUpdated,
	]);

	return (
		<Dialog
			onOpenChange={(next) => {
				if (busy) return;
				onOpenChange(next);
			}}
			open={open}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<span className="eyebrow text-foreground/55">Quick edit</span>
					<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
						Tune the dials
					</DialogTitle>
				</DialogHeader>
				<p className="max-w-[52ch] text-[0.875rem] text-muted-foreground leading-relaxed">
					Stage the changes, submit, and only the affected parts of the
					character will rerun.
				</p>

				<div className="flex flex-col gap-6 pt-2">
					<Section
						description={
							lengthChanged
								? "Re-runs scenario to match the new pacing."
								: "Affects the scenario prompt only."
						}
						index={1}
						title="Reply length"
					>
						{MESSAGE_LENGTHS.map((len) => {
							const meta = MESSAGE_LENGTH_META[len];
							return (
								<OptionPill
									active={draftLength === len}
									busy={busy}
									isStored={storedLength === len}
									key={len}
									label={meta.label}
									onClick={() => setDraftLength(len)}
									sublabel={`${meta.sentenceRange} sentences`}
								/>
							);
						})}
					</Section>

					<Section
						description={
							difficultyChanged
								? "Rebuilds mood axes, difficulty profile, intimacy profile, and scenario."
								: "Changing this regenerates mood and scenario."
						}
						index={2}
						title="Difficulty"
					>
						{DIFFICULTIES.map((d) => {
							const meta = DIFFICULTY_META[d];
							return (
								<OptionPill
									active={draftDifficulty === d}
									busy={busy}
									isStored={storedDifficulty === d}
									key={d}
									label={meta.label}
									onClick={() => setDraftDifficulty(d)}
								/>
							);
						})}
					</Section>

					<Section
						description={
							modelChanged
								? `Rewrites all ${data.scenes.length || ""} scene prompts in the new model's format.`
								: "Switching the model rewrites every scene prompt."
						}
						index={3}
						title="Image model"
					>
						{IMAGE_MODELS.map((m) => {
							const meta = IMAGE_MODEL_META[m];
							return (
								<OptionPill
									active={draftModel === m}
									busy={busy}
									isStored={storedModel === m}
									key={m}
									label={meta.label}
									onClick={() => setDraftModel(m)}
								/>
							);
						})}
					</Section>
				</div>

				{busy && (
					<div className="flex animate-message-in flex-col gap-2 pt-1">
						<div className="flex items-center gap-2.5">
							<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
							<span className="eyebrow text-foreground/70">
								{STAGE_LABEL[stage as Exclude<RunStage, "idle">]}
							</span>
						</div>
						<div className="h-px w-full overflow-hidden bg-foreground/10">
							<div className="h-full w-full animate-shimmer" />
						</div>
					</div>
				)}

				{!busy && hasChanges && (
					<PendingSummary
						difficultyChanged={difficultyChanged}
						lengthChanged={lengthChanged}
						modelChanged={modelChanged}
					/>
				)}

				{error && (
					<p className="text-destructive text-xs leading-relaxed">{error}</p>
				)}

				<DialogFooter>
					<DialogClose
						disabled={busy}
						render={<Button disabled={busy} size="sm" variant="outline" />}
					>
						Cancel
					</DialogClose>
					<Button
						className={hasChanges && !busy ? "glow-lg" : undefined}
						disabled={!hasChanges || busy}
						onClick={() => void handleSubmit()}
						size="sm"
					>
						{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
						{busy ? "Rerunning" : "Submit and rerun"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PendingSummary({
	difficultyChanged,
	lengthChanged,
	modelChanged,
}: {
	difficultyChanged: boolean;
	lengthChanged: boolean;
	modelChanged: boolean;
}) {
	const items: string[] = [];
	if (lengthChanged) items.push("re-run scenario");
	if (difficultyChanged) items.push("rebuild mood, intimacy, scenario");
	if (modelChanged) items.push("rewrite all scenes");

	return (
		<div className="flex flex-col gap-1.5 border-foreground/10 border-t pt-3">
			<span className="eyebrow text-foreground/55">On submit</span>
			<p className="text-[0.8125rem] text-foreground/80 leading-relaxed">
				{items.join(", then ")}.
			</p>
		</div>
	);
}

function Section({
	children,
	description,
	index,
	title,
}: {
	children: React.ReactNode;
	description: string;
	index: number;
	title: string;
}) {
	return (
		<section>
			<header className="mb-2 flex items-baseline gap-3">
				<span
					aria-hidden
					className="display-figure inline-block text-[0.75rem] text-foreground/40 leading-none tabular-nums"
				>
					{String(index).padStart(2, "0")}
				</span>
				<h3 className="-tracking-[0.005em] font-semibold text-[0.9375rem] text-foreground leading-tight">
					{title}
				</h3>
			</header>
			<div className="flex flex-wrap gap-1.5 pl-[calc(2ch+0.75rem)]">
				{children}
			</div>
			<p className="mt-2 pl-[calc(2ch+0.75rem)] text-[0.75rem] text-muted-foreground leading-snug">
				{description}
			</p>
		</section>
	);
}

function OptionPill({
	active,
	busy,
	isStored,
	label,
	onClick,
	sublabel,
}: {
	active: boolean;
	busy: boolean;
	isStored: boolean;
	label: string;
	onClick: () => void;
	sublabel?: string;
}) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[0.8125rem] outline-none transition-all duration-200 ease-out focus-visible:ring-3 focus-visible:ring-primary/40",
				active
					? "bg-primary/15 text-foreground ring-1 ring-primary/40 glow-xs"
					: "bg-secondary text-foreground/65 ring-1 ring-foreground/8 hover:text-foreground hover:ring-foreground/15",
				busy && "pointer-events-none opacity-50",
			)}
			disabled={busy}
			onClick={onClick}
			type="button"
		>
			<span>{label}</span>
			{sublabel && (
				<span
					className={cn(
						"font-normal text-[0.6875rem]",
						active ? "text-foreground/55" : "text-foreground/40",
					)}
				>
					{sublabel}
				</span>
			)}
			{isStored && !active && (
				<span className="eyebrow text-foreground/40">current</span>
			)}
		</button>
	);
}
