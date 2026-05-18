import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

export function CopyButton({
	value,
	className,
}: {
	value: string;
	className?: string;
}) {
	const { copied, copy } = useCopyToClipboard();

	return (
		<Button
			className={cn("h-7 w-7 shrink-0", className)}
			onClick={(e) => {
				e.stopPropagation();
				void copy(value);
			}}
			size="icon"
			variant="ghost"
		>
			{copied ? (
				<Check className="h-3.5 w-3.5 text-primary" />
			) : (
				<Copy className="h-3.5 w-3.5 text-muted-foreground" />
			)}
		</Button>
	);
}
