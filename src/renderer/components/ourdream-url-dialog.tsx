import { ourdreamChatUrl } from "@shared/ourdream-urls";
import {
	ExternalLink,
	Loader2,
	MessageCircle,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { StoredCharacter } from "@/lib/types";

interface OurDreamUrlDialogProps {
	data: StoredCharacter;
	onOpenChange: (open: boolean) => void;
	onUpdated: (next: StoredCharacter) => void;
	open: boolean;
}

export function OurDreamUrlDialog({
	data,
	onOpenChange,
	onUpdated,
	open,
}: OurDreamUrlDialogProps) {
	const [url, setUrl] = useState(data.ourdreamUrl ?? "");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setUrl(data.ourdreamUrl ?? "");
			setError(null);
			setBusy(false);
		}
	}, [open, data.ourdreamUrl]);

	async function handleSave() {
		setBusy(true);
		setError(null);
		const trimmed = url.trim();
		const res = await window.api.characters.updateOurdreamUrl(
			data.id,
			trimmed.length > 0 ? trimmed : null,
		);
		setBusy(false);
		if (res.success) {
			onUpdated(res.stored);
			onOpenChange(false);
		} else {
			setError(res.error);
		}
	}

	async function handleRefresh() {
		setBusy(true);
		setError(null);
		const res = await window.api.characters.refreshProfileImage(data.id);
		setBusy(false);
		if (res.success) {
			onUpdated(res.stored);
		} else {
			setError(res.error);
		}
	}

	async function handleClear() {
		setBusy(true);
		setError(null);
		const res = await window.api.characters.updateOurdreamUrl(data.id, null);
		setBusy(false);
		if (res.success) {
			onUpdated(res.stored);
			setUrl("");
		} else {
			setError(res.error);
		}
	}

	const hasLink = Boolean(data.ourdreamUrl);
	const sameAsStored = data.ourdreamUrl && data.ourdreamUrl === url.trim();

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<span className="eyebrow text-foreground/55">OurDream</span>
					<DialogTitle className="-tracking-[0.015em] font-semibold text-[1.25rem] text-foreground leading-tight">
						{hasLink ? "Update link" : "Link to OurDream"}
					</DialogTitle>
				</DialogHeader>

				<p className="max-w-[52ch] text-[0.875rem] text-muted-foreground leading-relaxed">
					Paste the public OurDream URL for this character. The profile image is
					pulled automatically.
				</p>

				<div className="flex flex-col gap-2 pt-1">
					<label
						className="eyebrow text-foreground/55"
						htmlFor="ourdream-url"
					>
						Character URL
					</label>
					<Input
						autoComplete="off"
						disabled={busy}
						id="ourdream-url"
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://ourdream.ai/c/..."
						spellCheck={false}
						value={url}
					/>
				</div>

				{data.profileImageUrl && (
					<div className="flex flex-col gap-3 pt-1">
						<span className="eyebrow text-foreground/55">
							Saved profile image
						</span>
						<div className="flex items-start gap-4">
							<img
								alt="Profile preview"
								className="aspect-[4/5] w-24 shrink-0 rounded-xl object-cover ring-1 ring-foreground/10"
								src={data.profileImageUrl}
							/>
							<div className="min-w-0 flex-1 space-y-2">
								<div className="break-all font-mono text-[10.5px] text-foreground/45 leading-snug">
									{data.profileImageUrl}
								</div>
								{data.ourdreamUrl && (
									<div className="flex flex-wrap items-center gap-1">
										<a
											className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-primary/85 transition-colors duration-150 ease-out hover:bg-primary/10 hover:text-primary"
											href={ourdreamChatUrl(data.ourdreamUrl)}
											rel="noreferrer noopener"
											target="_blank"
										>
											<MessageCircle className="h-3 w-3" />
											Open chat
										</a>
										<a
											className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-foreground/55 transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground"
											href={data.ourdreamUrl}
											rel="noreferrer noopener"
											target="_blank"
										>
											<ExternalLink className="h-3 w-3" />
											Profile
										</a>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				{error && (
					<p className="text-destructive text-xs leading-relaxed">{error}</p>
				)}

				<DialogFooter className="sm:justify-between">
					{hasLink ? (
						<Button
							className="text-destructive hover:text-destructive"
							disabled={busy}
							onClick={() => void handleClear()}
							size="sm"
							variant="ghost"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Remove
						</Button>
					) : (
						<span />
					)}
					<div className="flex flex-row-reverse gap-2">
						<Button
							className={
								url.trim().length > 0 && !sameAsStored ? "glow-sm" : undefined
							}
							disabled={busy || url.trim().length === 0}
							onClick={() => void handleSave()}
							size="sm"
						>
							{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
							{data.profileImageUrl ? "Update" : "Save and pull image"}
						</Button>
						{sameAsStored && (
							<Button
								disabled={busy}
								onClick={() => void handleRefresh()}
								size="sm"
								variant="outline"
							>
								<RefreshCw className="h-3.5 w-3.5" />
								Refresh image
							</Button>
						)}
						<DialogClose render={<Button size="sm" variant="outline" />}>
							Cancel
						</DialogClose>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
