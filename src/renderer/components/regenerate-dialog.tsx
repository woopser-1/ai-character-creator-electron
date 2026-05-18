import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { navigate } from "@/lib/router";
import type { StoredCharacter } from "@/lib/types";
import { getFullName } from "@/lib/types";

interface RegenerateDialogProps {
	data: StoredCharacter;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function RegenerateDialog({
	data,
	open,
	onOpenChange,
}: RegenerateDialogProps) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md" showCloseButton>
				<DialogHeader>
					<span className="eyebrow text-foreground/55">Regenerate</span>
					<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
						{getFullName(data.character)}
					</DialogTitle>
				</DialogHeader>

				<p className="max-w-[48ch] text-[0.875rem] text-muted-foreground leading-relaxed">
					Opens an interactive session. Pick which areas to redraft, adjust the
					difficulty, and answer targeted follow-up questions before the agent
					rewrites the profile.
				</p>

				<ul className="-mx-1 flex flex-col gap-1.5 pt-1 text-[0.8125rem] text-foreground/75">
					{[
						"Choose areas to rebuild",
						"Adjust difficulty or pacing",
						"Confirm the new profile",
					].map((item, i) => (
						<li
							className="flex items-baseline gap-3 px-1 py-1"
							key={item}
						>
							<span className="display-figure inline-block min-w-[1.75ch] text-[0.75rem] text-foreground/35 leading-none tabular-nums">
								{String(i + 1).padStart(2, "0")}
							</span>
							<span>{item}</span>
						</li>
					))}
				</ul>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						className="glow-lg"
						onClick={() => {
							onOpenChange(false);
							navigate(`/regenerate/${data.id}`);
						}}
					>
						<RefreshCw className="h-4 w-4" />
						Begin
						<ArrowRight className="h-3.5 w-3.5" />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
