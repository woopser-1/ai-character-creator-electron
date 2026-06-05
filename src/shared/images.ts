export interface ImageRefreshResult {
	/** Characters that have an OurDream URL and were therefore candidates. */
	total: number;
	/** Characters whose profileImageUrl was successfully refreshed. */
	refreshed: number;
	/** Candidates that failed (network error, image not found, etc.). */
	failed: number;
	startedAt: string;
	finishedAt: string;
}

export interface ImageRefreshProgress {
	done: number;
	total: number;
}
