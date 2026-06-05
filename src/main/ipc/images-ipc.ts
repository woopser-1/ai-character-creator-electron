import type { ImageRefreshResult } from "@shared/images";
import { ipcMain } from "electron";
import { refreshAllProfileImages } from "../images/refresh";
import type { IpcCtx } from "./helpers";

export function registerImagesIpc({ window }: IpcCtx): void {
	ipcMain.handle("images:refreshAll", async (): Promise<ImageRefreshResult> => {
		return refreshAllProfileImages(window);
	});
}
