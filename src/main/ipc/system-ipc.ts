import { ipcMain, shell } from "electron";
import type { UpdateInfo } from "@shared/updates";
import { checkClaudeAvailable } from "../claude/runner";
import { checkForUpdate } from "../updates/check";
import type { IpcCtx } from "./helpers";

export function registerSystemIpc({ window }: IpcCtx): void {
	ipcMain.handle("claude:check", async () => {
		return checkClaudeAvailable();
	});

	ipcMain.handle("updates:check", async (): Promise<UpdateInfo> => {
		return checkForUpdate();
	});

	ipcMain.handle("window:minimize", () => {
		if (!window.isDestroyed()) window.minimize();
	});

	ipcMain.handle("window:toggleMaximize", () => {
		if (window.isDestroyed()) return { maximized: false };
		if (window.isMaximized()) {
			window.unmaximize();
			return { maximized: false };
		}
		window.maximize();
		return { maximized: true };
	});

	ipcMain.handle("window:close", () => {
		if (!window.isDestroyed()) window.close();
	});

	ipcMain.handle("window:isMaximized", () => {
		return window.isDestroyed() ? false : window.isMaximized();
	});

	const emitMaximizeChange = (maximized: boolean) => {
		if (window.isDestroyed()) return;
		window.webContents.send("window:maximizeChange", maximized);
	};
	window.on("maximize", () => emitMaximizeChange(true));
	window.on("unmaximize", () => emitMaximizeChange(false));

	ipcMain.handle(
		"shell:showInFolder",
		async (_event, path: string): Promise<{ ok: boolean }> => {
			try {
				shell.showItemInFolder(path);
				return { ok: true };
			} catch {
				return { ok: false };
			}
		},
	);

	ipcMain.handle(
		"shell:openExternal",
		async (_event, url: string): Promise<{ ok: boolean; error?: string }> => {
			try {
				// Only allow http(s) — refuse file://, javascript:, etc.
				const parsed = new URL(url);
				if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
					return { ok: false, error: `Refused protocol: ${parsed.protocol}` };
				}
				await shell.openExternal(url);
				return { ok: true };
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
	);
}
