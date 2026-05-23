import { ipcMain } from "electron";
import type { AppSettings } from "@shared/schemas";
import { getSettings, updateSettings } from "../storage/settings";

export function registerSettingsIpc(): void {
	ipcMain.handle("settings:get", async (): Promise<AppSettings> => {
		return getSettings();
	});

	ipcMain.handle(
		"settings:update",
		async (_event, partial: Partial<AppSettings>): Promise<AppSettings> => {
			return updateSettings(partial);
		},
	);
}
