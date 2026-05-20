import {
	ArrowLeft,
	ChevronDown,
	ChevronRight,
	Loader2,
	Pencil,
	Ruler,
	Wand2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
	type CharacterProfilePreview,
	type ConfirmedDifficultyProfile,
	type ConfirmedIntimacyProfile,
	type ConfirmedMoodAxes,
	type ConfirmedProfile,
	type Difficulty,
	type Measurements,
	POST_INTIMACY_BEHAVIORS,
	type PostIntimacyBehavior,
} from "@/lib/types";

interface ProfileReviewProps {
	initial?: CharacterProfilePreview;
	loading?: boolean;
	error?: string;
	difficulty: Difficulty;
	gatheringSummary?: string;
	onConfirm: (data: {
		measurements: Measurements;
		profile: ConfirmedProfile;
	}) => void;
	onBack: () => void;
	backLabel?: string;
	confirmLabel?: string;
}

type ScoreKey =
	| "moodResistance"
	| "trustThreshold"
	| "personalityRigidity"
	| "escalationSpeed"
	| "sexualConfidence"
	| "emotionalDetachment"
	| "personalityConsistency";

const FALLBACK_PREVIEW: CharacterProfilePreview = {
	measurements: {
		heightCm: 168,
		bustCm: 88,
		cupSize: "C",
		waistCm: 64,
		hipsCm: 92,
	},
	difficultyProfile: {
		moodResistance: 5,
		trustThreshold: 5,
		personalityRigidity: 5,
		moodResistanceReasoning: "",
		trustThresholdReasoning: "",
		personalityRigidityReasoning: "",
	},
	intimacyProfile: {
		escalationSpeed: 4,
		sexualConfidence: 5,
		emotionalDetachment: 4,
		personalityConsistency: 6,
		postIntimacyBehavior: "tender",
		circumstantialTriggers: "",
		escalationSpeedReasoning: "",
		sexualConfidenceReasoning: "",
		emotionalDetachmentReasoning: "",
		personalityConsistencyReasoning: "",
		postIntimacyBehaviorReasoning: "",
	},
	moodAxes: {
		primary: {
			label: "Openness",
			lowDescriptor: "Guarded",
			highDescriptor: "Open",
			startingValue: 35,
			reasoning: "",
		},
		secondary: {
			label: "Warmth",
			lowDescriptor: "Distant",
			highDescriptor: "Affectionate",
			startingValue: 35,
			reasoning: "",
		},
	},
};

export function ProfileReview({
	initial,
	loading,
	error,
	difficulty,
	gatheringSummary,
	onConfirm,
	onBack,
	backLabel = "Back to gathering",
	confirmLabel = "Confirm & Generate Character",
}: ProfileReviewProps) {
	const [draft, setDraft] = useState<CharacterProfilePreview>(
		initial ?? FALLBACK_PREVIEW,
	);
	const [editedReasoning, setEditedReasoning] = useState<Set<string>>(
		new Set(),
	);
	const [touchedScore, setTouchedScore] = useState<Set<string>>(new Set());
	const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(
		new Set(),
	);
	const [summaryOpen, setSummaryOpen] = useState(false);
	const [openSections, setOpenSections] = useState<Set<string>>(new Set());

	const toggleSection = useCallback((id: string) => {
		setOpenSections((s) => {
			const next = new Set(s);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	useEffect(() => {
		if (initial) {
			setDraft(initial);
			setEditedReasoning(new Set());
			setTouchedScore(new Set());
		}
	}, [initial]);

	const setMeasurement = useCallback(
		(key: keyof Measurements, raw: string | number) => {
			if (typeof raw === "number") {
				setDraft((d) => ({
					...d,
					measurements: { ...d.measurements, [key]: raw },
				}));
				return;
			}
			if (key === "cupSize") {
				setDraft((d) => ({
					...d,
					measurements: { ...d.measurements, cupSize: raw.slice(0, 6) },
				}));
				return;
			}
			const n = Number.parseInt(raw, 10);
			if (Number.isNaN(n)) return;
			setDraft((d) => ({
				...d,
				measurements: { ...d.measurements, [key]: n },
			}));
		},
		[],
	);

	const setScore = useCallback(
		(
			section: "difficultyProfile" | "intimacyProfile",
			key: ScoreKey,
			value: number,
		) => {
			setDraft((d) => ({ ...d, [section]: { ...d[section], [key]: value } }));
			setTouchedScore((s) => new Set(s).add(`${section}.${key}`));
		},
		[],
	);

	const setReasoning = useCallback((path: string, value: string) => {
		setDraft((d) => {
			const [section, key] = path.split(".") as [
				keyof CharacterProfilePreview,
				string,
			];
			const sec = d[section] as Record<string, unknown>;
			return { ...d, [section]: { ...sec, [key]: value } };
		});
		setEditedReasoning((s) => new Set(s).add(path));
	}, []);

	const toggleReasoning = useCallback((path: string) => {
		setExpandedReasoning((s) => {
			const next = new Set(s);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}, []);

	const setIntimacyEnum = useCallback((value: PostIntimacyBehavior) => {
		setDraft((d) => ({
			...d,
			intimacyProfile: { ...d.intimacyProfile, postIntimacyBehavior: value },
		}));
		setTouchedScore((s) =>
			new Set(s).add("intimacyProfile.postIntimacyBehavior"),
		);
	}, []);

	const setIntimacyTriggers = useCallback((value: string) => {
		setDraft((d) => ({
			...d,
			intimacyProfile: { ...d.intimacyProfile, circumstantialTriggers: value },
		}));
	}, []);

	const setMoodAxis = useCallback(
		(
			which: "primary" | "secondary",
			key: "label" | "lowDescriptor" | "highDescriptor" | "startingValue",
			value: string | number,
		) => {
			setDraft((d) => ({
				...d,
				moodAxes: {
					...d.moodAxes,
					[which]: { ...d.moodAxes[which], [key]: value },
				},
			}));
			if (key === "startingValue") {
				setTouchedScore((s) =>
					new Set(s).add(`moodAxes.${which}.startingValue`),
				);
			}
		},
		[],
	);

	const handleConfirm = useCallback(() => {
		const reasoningOrUndefined = (
			path: string,
			current: string,
		): string | undefined => {
			const scorePath = path.replace(/Reasoning$/, "");
			if (editedReasoning.has(path)) return current;
			if (touchedScore.has(scorePath)) return undefined;
			return current;
		};

		const d = draft.difficultyProfile;
		const i = draft.intimacyProfile;
		const profile: ConfirmedProfile = {
			difficultyProfile: {
				moodResistance: d.moodResistance,
				trustThreshold: d.trustThreshold,
				personalityRigidity: d.personalityRigidity,
				moodResistanceReasoning: reasoningOrUndefined(
					"difficultyProfile.moodResistanceReasoning",
					d.moodResistanceReasoning,
				),
				trustThresholdReasoning: reasoningOrUndefined(
					"difficultyProfile.trustThresholdReasoning",
					d.trustThresholdReasoning,
				),
				personalityRigidityReasoning: reasoningOrUndefined(
					"difficultyProfile.personalityRigidityReasoning",
					d.personalityRigidityReasoning,
				),
			} satisfies ConfirmedDifficultyProfile,
			intimacyProfile: {
				escalationSpeed: i.escalationSpeed,
				sexualConfidence: i.sexualConfidence,
				emotionalDetachment: i.emotionalDetachment,
				personalityConsistency: i.personalityConsistency,
				postIntimacyBehavior: i.postIntimacyBehavior,
				circumstantialTriggers: i.circumstantialTriggers,
				escalationSpeedReasoning: reasoningOrUndefined(
					"intimacyProfile.escalationSpeedReasoning",
					i.escalationSpeedReasoning,
				),
				sexualConfidenceReasoning: reasoningOrUndefined(
					"intimacyProfile.sexualConfidenceReasoning",
					i.sexualConfidenceReasoning,
				),
				emotionalDetachmentReasoning: reasoningOrUndefined(
					"intimacyProfile.emotionalDetachmentReasoning",
					i.emotionalDetachmentReasoning,
				),
				personalityConsistencyReasoning: reasoningOrUndefined(
					"intimacyProfile.personalityConsistencyReasoning",
					i.personalityConsistencyReasoning,
				),
				postIntimacyBehaviorReasoning: reasoningOrUndefined(
					"intimacyProfile.postIntimacyBehaviorReasoning",
					i.postIntimacyBehaviorReasoning,
				),
			} satisfies ConfirmedIntimacyProfile,
			moodAxes: {
				primary: {
					label: draft.moodAxes.primary.label,
					lowDescriptor: draft.moodAxes.primary.lowDescriptor,
					highDescriptor: draft.moodAxes.primary.highDescriptor,
					startingValue: draft.moodAxes.primary.startingValue,
					reasoning: editedReasoning.has("moodAxes.primary.reasoning")
						? draft.moodAxes.primary.reasoning
						: touchedScore.has("moodAxes.primary.startingValue")
							? undefined
							: draft.moodAxes.primary.reasoning,
				},
				secondary: {
					label: draft.moodAxes.secondary.label,
					lowDescriptor: draft.moodAxes.secondary.lowDescriptor,
					highDescriptor: draft.moodAxes.secondary.highDescriptor,
					startingValue: draft.moodAxes.secondary.startingValue,
					reasoning: editedReasoning.has("moodAxes.secondary.reasoning")
						? draft.moodAxes.secondary.reasoning
						: touchedScore.has("moodAxes.secondary.startingValue")
							? undefined
							: draft.moodAxes.secondary.reasoning,
				},
				hidden: draft.moodAxes.hidden?.map((a) => ({
					label: a.label,
					lowDescriptor: a.lowDescriptor,
					highDescriptor: a.highDescriptor,
					startingValue: a.startingValue,
					reasoning: a.reasoning,
				})),
			} satisfies ConfirmedMoodAxes,
		};
		onConfirm({ measurements: draft.measurements, profile });
	}, [draft, editedReasoning, touchedScore, onConfirm]);

	const showSkeleton = loading && !initial;
	const m = draft.measurements;
	const dp = draft.difficultyProfile;
	const ip = draft.intimacyProfile;

	return (
		<div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
			<div className="flex items-start gap-2.5">
				<div className="rounded-md bg-primary/15 p-1.5 text-primary">
					<Ruler className="h-3.5 w-3.5" />
				</div>
				<div className="flex-1">
					<h2 className="font-semibold text-sm tracking-tight">
						Review character profile
					</h2>
					<p className="mt-0.5 text-muted-foreground text-xs">
						Adjust sliders, axes, or measurements before generation. Click the
						pencil to edit a reasoning.
					</p>
				</div>
			</div>

			{gatheringSummary && (
				<button
					type="button"
					onClick={() => setSummaryOpen((v) => !v)}
					className="flex w-full items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-left text-muted-foreground text-[11px] ring-1 ring-foreground/10 transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground"
				>
					{summaryOpen ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
					<span className="font-medium">Gathering summary</span>
					<span className="ml-auto text-[10px] uppercase tracking-wider">
						{summaryOpen ? "Hide" : "Show"}
					</span>
				</button>
			)}
			{gatheringSummary && summaryOpen && (
				<div className="max-h-56 overflow-y-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground ring-1 ring-foreground/10 whitespace-pre-wrap">
					{gatheringSummary}
				</div>
			)}

			{loading && (
				<div className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-foreground text-xs ring-1 ring-primary/30">
					<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
					<span>Inferring profile from the gathering summary…</span>
				</div>
			)}

			{error && (
				<div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-destructive text-xs ring-1 ring-destructive/30">
					{error}. Using fallback values; please review and edit.
				</div>
			)}

			{showSkeleton ? (
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
							className="h-9 animate-pulse rounded-md bg-muted ring-1 ring-foreground/10"
						/>
					))}
				</div>
			) : (
				<>
					<Section
						title="Body measurements"
						summary={`${m.heightCm} cm · cup ${m.cupSize} · ${m.bustCm}-${m.waistCm}-${m.hipsCm}`}
						open={openSections.has("body")}
						onToggle={() => toggleSection("body")}
					>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
							<NumberField
								label="Height"
								value={m.heightCm}
								min={140}
								max={210}
								onChange={(v) => setMeasurement("heightCm", v)}
								disabled={loading}
							/>
							<NumberField
								label="Bust"
								value={m.bustCm}
								min={60}
								max={140}
								onChange={(v) => setMeasurement("bustCm", v)}
								disabled={loading}
							/>
							<div>
								<FieldLabel>Cup</FieldLabel>
								<Input
									className="h-7 text-xs"
									value={m.cupSize}
									disabled={loading}
									onChange={(e) => setMeasurement("cupSize", e.target.value)}
								/>
							</div>
							<NumberField
								label="Waist"
								value={m.waistCm}
								min={45}
								max={120}
								onChange={(v) => setMeasurement("waistCm", v)}
								disabled={loading}
							/>
							<NumberField
								label="Hips"
								value={m.hipsCm}
								min={60}
								max={150}
								onChange={(v) => setMeasurement("hipsCm", v)}
								disabled={loading}
							/>
						</div>
					</Section>

					<Section
						title="Difficulty profile"
						subtitle={`Baseline guardedness, difficulty: ${difficulty}`}
						summary={`mood ${dp.moodResistance}/10 · trust ${dp.trustThreshold}/10 · rigidity ${dp.personalityRigidity}/10`}
						open={openSections.has("difficulty")}
						onToggle={() => toggleSection("difficulty")}
					>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<ScoreSlider
								label="Mood resistance"
								hint="shifts easily ↔ stoic"
								value={dp.moodResistance}
								onChange={(v) =>
									setScore("difficultyProfile", "moodResistance", v)
								}
								reasoning={dp.moodResistanceReasoning}
								reasoningPath="difficultyProfile.moodResistanceReasoning"
								expanded={expandedReasoning.has(
									"difficultyProfile.moodResistanceReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
							<ScoreSlider
								label="Trust threshold"
								hint="trusting ↔ guarded"
								value={dp.trustThreshold}
								onChange={(v) =>
									setScore("difficultyProfile", "trustThreshold", v)
								}
								reasoning={dp.trustThresholdReasoning}
								reasoningPath="difficultyProfile.trustThresholdReasoning"
								expanded={expandedReasoning.has(
									"difficultyProfile.trustThresholdReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
							<ScoreSlider
								label="Personality rigidity"
								hint="adaptable ↔ unchanging"
								value={dp.personalityRigidity}
								onChange={(v) =>
									setScore("difficultyProfile", "personalityRigidity", v)
								}
								reasoning={dp.personalityRigidityReasoning}
								reasoningPath="difficultyProfile.personalityRigidityReasoning"
								expanded={expandedReasoning.has(
									"difficultyProfile.personalityRigidityReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
						</div>
					</Section>

					<Section
						title="Intimacy profile"
						subtitle="Behavior in romantic and intimate moments"
						summary={`${ip.postIntimacyBehavior} · esc ${ip.escalationSpeed}/10 · conf ${ip.sexualConfidence}/10`}
						open={openSections.has("intimacy")}
						onToggle={() => toggleSection("intimacy")}
					>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<ScoreSlider
								label="Escalation speed"
								hint="slow burn ↔ immediate"
								value={ip.escalationSpeed}
								onChange={(v) =>
									setScore("intimacyProfile", "escalationSpeed", v)
								}
								reasoning={ip.escalationSpeedReasoning}
								reasoningPath="intimacyProfile.escalationSpeedReasoning"
								expanded={expandedReasoning.has(
									"intimacyProfile.escalationSpeedReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
							<ScoreSlider
								label="Sexual confidence"
								hint="tentative ↔ self-assured"
								value={ip.sexualConfidence}
								onChange={(v) =>
									setScore("intimacyProfile", "sexualConfidence", v)
								}
								reasoning={ip.sexualConfidenceReasoning}
								reasoningPath="intimacyProfile.sexualConfidenceReasoning"
								expanded={expandedReasoning.has(
									"intimacyProfile.sexualConfidenceReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
							<ScoreSlider
								label="Emotional detachment"
								hint="needs love ↔ detached"
								value={ip.emotionalDetachment}
								onChange={(v) =>
									setScore("intimacyProfile", "emotionalDetachment", v)
								}
								reasoning={ip.emotionalDetachmentReasoning}
								reasoningPath="intimacyProfile.emotionalDetachmentReasoning"
								expanded={expandedReasoning.has(
									"intimacyProfile.emotionalDetachmentReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
							<ScoreSlider
								label="Consistency in bed"
								hint="different ↔ natural extension"
								value={ip.personalityConsistency}
								onChange={(v) =>
									setScore("intimacyProfile", "personalityConsistency", v)
								}
								reasoning={ip.personalityConsistencyReasoning}
								reasoningPath="intimacyProfile.personalityConsistencyReasoning"
								expanded={expandedReasoning.has(
									"intimacyProfile.personalityConsistencyReasoning",
								)}
								onToggleReasoning={toggleReasoning}
								onReasoningChange={setReasoning}
								disabled={loading}
							/>
						</div>

						<div className="rounded-md bg-muted p-2.5 ring-1 ring-foreground/10">
							<div className="mb-1 flex items-center justify-between">
								<FieldLabel>Post-intimacy behavior</FieldLabel>
								<ReasoningToggleButton
									reasoning={ip.postIntimacyBehaviorReasoning}
									path="intimacyProfile.postIntimacyBehaviorReasoning"
									expanded={expandedReasoning.has(
										"intimacyProfile.postIntimacyBehaviorReasoning",
									)}
									onToggle={toggleReasoning}
									disabled={loading}
								/>
							</div>
							<div className="flex flex-wrap gap-1">
								{POST_INTIMACY_BEHAVIORS.map((b) => (
									<button
										key={b}
										type="button"
										disabled={loading}
										onClick={() => setIntimacyEnum(b)}
										className={
											"rounded-md px-2 py-0.5 text-[11px] capitalize transition-all duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary/40 " +
											(ip.postIntimacyBehavior === b
												? "bg-secondary text-foreground glow-ring"
												: "bg-secondary text-muted-foreground ring-1 ring-foreground/10 hover:text-foreground")
										}
									>
										{b}
									</button>
								))}
							</div>
							{expandedReasoning.has(
								"intimacyProfile.postIntimacyBehaviorReasoning",
							) && (
								<Textarea
									className="mt-2 min-h-12 text-xs"
									value={ip.postIntimacyBehaviorReasoning}
									disabled={loading}
									rows={2}
									onChange={(e) =>
										setReasoning(
											"intimacyProfile.postIntimacyBehaviorReasoning",
											e.target.value,
										)
									}
									placeholder="Reasoning"
									autoFocus
								/>
							)}
						</div>

						<div className="rounded-md bg-muted p-2.5 ring-1 ring-foreground/10">
							<FieldLabel>Circumstantial triggers</FieldLabel>
							<Textarea
								className="min-h-12 text-xs"
								value={ip.circumstantialTriggers}
								disabled={loading}
								rows={2}
								onChange={(e) => setIntimacyTriggers(e.target.value)}
								placeholder="What lowers her guard"
							/>
						</div>
					</Section>

					<Section
						title="Mood axes"
						subtitle="Two dimensions tracked 0-100 across conversation"
						summary={`${draft.moodAxes.primary.label} ${draft.moodAxes.primary.startingValue} · ${draft.moodAxes.secondary.label} ${draft.moodAxes.secondary.startingValue}`}
						open={openSections.has("mood")}
						onToggle={() => toggleSection("mood")}
					>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<MoodAxisCard
								which="primary"
								data={draft.moodAxes.primary}
								expanded={expandedReasoning.has("moodAxes.primary.reasoning")}
								onChange={setMoodAxis}
								onReasoningChange={setReasoning}
								onToggleReasoning={toggleReasoning}
								disabled={loading}
							/>
							<MoodAxisCard
								which="secondary"
								data={draft.moodAxes.secondary}
								expanded={expandedReasoning.has("moodAxes.secondary.reasoning")}
								onChange={setMoodAxis}
								onReasoningChange={setReasoning}
								onToggleReasoning={toggleReasoning}
								disabled={loading}
							/>
						</div>
					</Section>
				</>
			)}

			<div className="flex gap-2">
				<Button className="glow-lg" disabled={loading} onClick={handleConfirm}>
					{loading ? (
						<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
					) : (
						<Wand2 className="mr-1 h-3.5 w-3.5" />
					)}
					{loading ? "Inferring…" : confirmLabel}
				</Button>
				<Button disabled={loading} onClick={onBack} variant="outline">
					<ArrowLeft className="mr-1 h-3.5 w-3.5" />
					{backLabel}
				</Button>
			</div>
		</div>
	);
}

function Section({
	title,
	subtitle,
	summary,
	open,
	onToggle,
	children,
}: {
	title: string;
	subtitle?: string;
	summary?: string;
	open?: boolean;
	onToggle?: () => void;
	children: React.ReactNode;
}) {
	const collapsible =
		typeof open === "boolean" && typeof onToggle === "function";
	const isOpen = !collapsible || open;

	return (
		<div className="space-y-2 rounded-lg bg-muted/60 p-2.5 ring-1 ring-foreground/8">
			{collapsible ? (
				<button
					type="button"
					onClick={onToggle}
					className="-mx-1 -my-0.5 flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-colors duration-150 ease-out hover:bg-muted"
					aria-expanded={isOpen}
				>
					{isOpen ? (
						<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
					)}
					<h3 className="font-medium text-foreground text-xs uppercase tracking-wider">
						{title}
					</h3>
					{summary && !isOpen && (
						<span className="ml-2 truncate text-muted-foreground text-[11px] normal-case tracking-normal">
							{summary}
						</span>
					)}
					{subtitle && isOpen && (
						<span className="ml-auto truncate text-muted-foreground text-[10px]">
							{subtitle}
						</span>
					)}
				</button>
			) : (
				<div className="flex items-baseline justify-between gap-2">
					<h3 className="font-medium text-foreground text-xs uppercase tracking-wider">
						{title}
					</h3>
					{subtitle && (
						<p className="text-muted-foreground text-[10px]">{subtitle}</p>
					)}
				</div>
			)}
			{isOpen && children}
		</div>
	);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-1 font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
			{children}
		</div>
	);
}

function NumberField({
	label,
	value,
	min,
	max,
	onChange,
	disabled,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (raw: string | number) => void;
	disabled?: boolean;
}) {
	return (
		<div>
			<FieldLabel>{label}</FieldLabel>
			<Input
				type="number"
				className="h-7 text-xs"
				min={min}
				max={max}
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}

function ScoreSlider({
	label,
	hint,
	value,
	onChange,
	reasoning,
	reasoningPath,
	expanded,
	onToggleReasoning,
	onReasoningChange,
	disabled,
}: {
	label: string;
	hint: string;
	value: number;
	onChange: (v: number) => void;
	reasoning: string;
	reasoningPath: string;
	expanded: boolean;
	onToggleReasoning: (path: string) => void;
	onReasoningChange: (path: string, value: string) => void;
	disabled?: boolean;
}) {
	return (
		<div className="rounded-md bg-muted px-2.5 py-2 ring-1 ring-foreground/10">
			<div className="mb-1 flex items-center gap-2">
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium text-foreground text-xs">
						{label}
					</div>
					<div className="truncate text-muted-foreground text-[10px]">
						{hint}
					</div>
				</div>
				<div className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-primary text-[10px]">
					{value}/10
				</div>
				<ReasoningToggleButton
					reasoning={reasoning}
					path={reasoningPath}
					expanded={expanded}
					onToggle={onToggleReasoning}
					disabled={disabled}
				/>
			</div>
			<Slider
				value={[value]}
				min={1}
				max={10}
				step={1}
				disabled={disabled}
				onValueChange={(v) => onChange(v[0] ?? 1)}
			/>
			{expanded && (
				<Textarea
					className="mt-1.5 min-h-10 text-xs"
					value={reasoning}
					disabled={disabled}
					rows={2}
					onChange={(e) => onReasoningChange(reasoningPath, e.target.value)}
					placeholder="Reasoning"
					autoFocus
				/>
			)}
		</div>
	);
}

function ReasoningToggleButton({
	reasoning,
	path,
	expanded,
	onToggle,
	disabled,
}: {
	reasoning: string;
	path: string;
	expanded: boolean;
	onToggle: (path: string) => void;
	disabled?: boolean;
}) {
	const hasContent = Boolean(reasoning);
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={() => onToggle(path)}
			title={hasContent ? reasoning : "Add reasoning"}
			aria-pressed={expanded}
			className={
				"rounded p-1 transition-colors disabled:opacity-30 " +
				(expanded
					? "bg-primary/15 text-primary"
					: hasContent
						? "text-muted-foreground hover:bg-muted hover:text-foreground"
						: "text-muted-foreground/40 hover:bg-muted hover:text-foreground")
			}
		>
			<Pencil className="h-3 w-3" />
		</button>
	);
}

function MoodAxisCard({
	which,
	data,
	expanded,
	onChange,
	onReasoningChange,
	onToggleReasoning,
	disabled,
}: {
	which: "primary" | "secondary";
	data: CharacterProfilePreview["moodAxes"]["primary"];
	expanded: boolean;
	onChange: (
		which: "primary" | "secondary",
		key: "label" | "lowDescriptor" | "highDescriptor" | "startingValue",
		value: string | number,
	) => void;
	onReasoningChange: (path: string, value: string) => void;
	onToggleReasoning: (path: string) => void;
	disabled?: boolean;
}) {
	const path = `moodAxes.${which}.reasoning`;
	const title = which === "primary" ? "Primary" : "Secondary";
	return (
		<div className="rounded-md bg-muted px-2.5 py-2 ring-1 ring-foreground/10">
			<div className="mb-1.5 flex items-center gap-2">
				<span className="font-medium text-muted-foreground text-[10px] uppercase tracking-wider">
					{title}
				</span>
				<Input
					className="h-6 flex-1 text-xs"
					value={data.label}
					disabled={disabled}
					onChange={(e) => onChange(which, "label", e.target.value)}
					placeholder="Axis label"
				/>
				<div className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-primary text-[10px]">
					{data.startingValue}/100
				</div>
				<ReasoningToggleButton
					reasoning={data.reasoning}
					path={path}
					expanded={expanded}
					onToggle={onToggleReasoning}
					disabled={disabled}
				/>
			</div>
			<div className="mb-1 grid grid-cols-2 gap-1.5">
				<Input
					className="h-6 text-xs"
					value={data.lowDescriptor}
					disabled={disabled}
					onChange={(e) => onChange(which, "lowDescriptor", e.target.value)}
					placeholder="Low"
				/>
				<Input
					className="h-6 text-xs"
					value={data.highDescriptor}
					disabled={disabled}
					onChange={(e) => onChange(which, "highDescriptor", e.target.value)}
					placeholder="High"
				/>
			</div>
			<Slider
				value={[data.startingValue]}
				min={0}
				max={100}
				step={1}
				disabled={disabled}
				onValueChange={(v) => onChange(which, "startingValue", v[0] ?? 0)}
			/>
			{expanded && (
				<Textarea
					className="mt-1.5 min-h-10 text-xs"
					value={data.reasoning}
					disabled={disabled}
					rows={2}
					onChange={(e) => onReasoningChange(path, e.target.value)}
					placeholder="Reasoning"
					autoFocus
				/>
			)}
		</div>
	);
}
