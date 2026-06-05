import type { ImageRefreshResult } from "@shared/images";
import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

export function useImageRefreshNotifier(): void {
	const { push } = useToast();

	useEffect(() => {
		const images = window.api.images;
		if (!images) return;

		const notify = (result: ImageRefreshResult) => {
			if (result.total === 0) return;

			const failedSuffix =
				result.failed > 0 ? ` · ${result.failed} failed` : "";

			push({
				tone: result.failed > 0 && result.refreshed === 0 ? "error" : "info",
				title: "Profile images refreshed",
				description: `${result.refreshed}/${result.total} profile images updated from OurDream${failedSuffix}.`,
				duration: 6000,
			});
		};

		return images.onComplete(notify);
	}, [push]);
}
