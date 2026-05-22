export const APP_PORT_TAG = "ai-character-creator" as const;
export const PORT_FILE_VERSION = 1 as const;

export interface ImportFileOutcome {
	fileName: string;
	ok: boolean;
	count?: number;
	error?: string;
}

export type ExportResponse =
	| { success: true; path: string; count: number }
	| { success: false; canceled: true }
	| { success: false; error: string };

// Generic import response — entity-specific responses extend with `imported: T[]`.
export type ImportResponseFor<T> =
	| { success: true; imported: T[]; fileOutcomes: ImportFileOutcome[] }
	| { success: false; canceled: true }
	| { success: false; error: string; fileOutcomes?: ImportFileOutcome[] };
