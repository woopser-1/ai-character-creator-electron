import type { ReactNode } from "react";
import {
	AutopilotBadge,
	isAutopilot,
} from "@/components/tools/autopilot-badge";
import { ToolRewindButton } from "@/components/tools/tool-rewind-button";

interface ToolFrameProps {
	question: string;
	submitted?: boolean;
	submittedValue?: string;
	onRewind?: () => void;
	/** Rendered inside the submitted shell when the answer is not the autopilot sentinel. */
	answeredView?: ReactNode;
	/** Rendered inside the active shell — the controls the user interacts with. */
	children?: ReactNode;
}

/**
 * Shared chrome for every interactive tool (yes/no, ask-user, suggest-options,
 * select-multiple). Owns:
 *   - the muted vs glow-card outer shell
 *   - the question + rewind-button header row
 *   - the autopilot-badge fallback for submitted-with-sentinel answers
 *
 * Each tool only describes its own controls (children) and how its answer
 * should render after submission (answeredView).
 */
export function ToolFrame({
	question,
	submitted,
	submittedValue,
	onRewind,
	answeredView,
	children,
}: ToolFrameProps) {
	if (submitted) {
		return (
			<div className="rounded-xl bg-muted p-4 ring-1 ring-foreground/10">
				<div className="mb-2.5 flex items-start justify-between gap-2">
					<p className="text-muted-foreground text-sm">{question}</p>
					{onRewind && <ToolRewindButton answered onClick={onRewind} />}
				</div>
				{isAutopilot(submittedValue) ? <AutopilotBadge /> : answeredView}
			</div>
		);
	}

	return (
		<div className="animate-tool-in space-y-3 rounded-xl bg-card p-4 glow-rim">
			<div className="flex items-start justify-between gap-2">
				<p className="font-medium text-sm">{question}</p>
				{onRewind && <ToolRewindButton onClick={onRewind} />}
			</div>
			{children}
		</div>
	);
}
