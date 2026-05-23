import type { BrowserWindow } from "electron";
import type { GenerateProgressEvent } from "@shared/generate";
import { registerCharactersIpc } from "./characters-ipc";
import { registerChatIpc } from "./chat-ipc";
import { registerDraftsIpc } from "./drafts-ipc";
import { registerGenerateIpc } from "./generate-ipc";
import { registerGroupChatsIpc } from "./group-chats-ipc";
import type { IpcCtx } from "./helpers";
import { registerSettingsIpc } from "./settings-ipc";
import { registerSystemIpc } from "./system-ipc";

// Each domain registers its own ipcMain.handle calls. We thread a small
// context object through them carrying the main BrowserWindow (for dialogs
// and webContents.send) and an emitProgress helper that fans generate-time
// events out to the renderer.
export function registerIpc(window: BrowserWindow): void {
	const emitProgress = (event: GenerateProgressEvent) => {
		if (window.isDestroyed()) return;
		window.webContents.send("generate:progress", event);
	};
	const ctx: IpcCtx = { window, emitProgress };

	registerSystemIpc(ctx);
	registerCharactersIpc(ctx);
	registerGroupChatsIpc(ctx);
	registerDraftsIpc();
	registerSettingsIpc();
	registerGenerateIpc(ctx);
	registerChatIpc(ctx);
}
