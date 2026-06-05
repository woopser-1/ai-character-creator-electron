import type { AppSettings } from "@shared/schemas";
import { ipcMain } from "electron";
import {
	type ApiKeyStatus,
	getApiKeyStatus,
	setApiKey,
} from "../storage/credentials";
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

	ipcMain.handle(
		"settings:setApiKey",
		async (_event, key: string): Promise<ApiKeyStatus> => {
			await setApiKey(key);
			return getApiKeyStatus();
		},
	);

	ipcMain.handle("settings:apiKeyStatus", async (): Promise<ApiKeyStatus> => {
		return getApiKeyStatus();
	});
}
