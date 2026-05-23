import { ipcMain } from "electron";
import type { Draft } from "@shared/drafts";
import {
	deleteDraft,
	getDraft,
	getLatestDraft,
	listDrafts,
	saveDraft,
} from "../storage/drafts";

export function registerDraftsIpc(): void {
	ipcMain.handle(
		"drafts:save",
		async (_event, draft: Draft): Promise<Draft> => {
			return saveDraft(draft);
		},
	);

	ipcMain.handle(
		"drafts:get",
		async (_event, id: string): Promise<Draft | null> => {
			return getDraft(id);
		},
	);

	ipcMain.handle("drafts:getLatest", async (): Promise<Draft | null> => {
		return getLatestDraft();
	});

	ipcMain.handle("drafts:list", async (): Promise<Draft[]> => {
		return listDrafts();
	});

	ipcMain.handle(
		"drafts:delete",
		async (_event, id: string): Promise<void> => {
			await deleteDraft(id);
		},
	);
}
