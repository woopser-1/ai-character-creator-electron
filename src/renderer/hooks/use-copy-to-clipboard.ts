import { useCallback, useRef, useState } from "react";

export function useCopyToClipboard(resetMs = 2000): {
	copied: boolean;
	copy: (value: string) => Promise<void>;
} {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const copy = useCallback(
		async (value: string) => {
			try {
				await navigator.clipboard.writeText(value);
			} catch {
				return;
			}
			setCopied(true);
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => setCopied(false), resetMs);
		},
		[resetMs],
	);

	return { copied, copy };
}
