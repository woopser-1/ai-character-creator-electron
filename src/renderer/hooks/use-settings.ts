import type { AppSettings } from "@shared/schemas";
import { useCallback, useEffect, useState } from "react";

export function useSettings(): {
	settings: AppSettings | null;
	loading: boolean;
	update: (partial: Partial<AppSettings>) => Promise<void>;
} {
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		window.api.settings.get().then((s) => {
			if (cancelled) return;
			setSettings(s);
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const update = useCallback(async (partial: Partial<AppSettings>) => {
		const next = await window.api.settings.update(partial);
		setSettings(next);
	}, []);

	return { settings, loading, update };
}
