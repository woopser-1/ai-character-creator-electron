import type { ImageRefreshResult } from "@shared/images";
import type { BrowserWindow } from "electron";
import { listCharacters, updateCharacter } from "../storage/characters";
import { extractOurDreamProfileImage } from "../storage/ourdream";
import { updateSettings } from "../storage/settings";

const BETWEEN_REQUESTS_MS = 750;

let inFlight: Promise<ImageRefreshResult> | null = null;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Re-fetches a fresh profile image link from OurDream for every character that
 * has an `ourdreamUrl`. The hosted image links expire over time, so this keeps
 * `profileImageUrl` pointing at a currently-valid URL. Runs are serialized — a
 * concurrent call returns the in-flight run's result instead of starting a new
 * scrape pass.
 */
export function refreshAllProfileImages(
	window?: BrowserWindow,
): Promise<ImageRefreshResult> {
	if (inFlight) return inFlight;

	inFlight = (async () => {
		const startedAt = new Date().toISOString();
		const characters = await listCharacters();
		const targets = characters.filter((c) => c.ourdreamUrl);

		console.log("[image-refresh] starting", { candidates: targets.length });

		let refreshed = 0;
		let failed = 0;
		let done = 0;

		for (const character of targets) {
			const ourdreamUrl = character.ourdreamUrl as string;
			try {
				const result = await extractOurDreamProfileImage(ourdreamUrl);
				if (result.success) {
					await updateCharacter(character.id, {
						profileImageUrl: result.profileImageUrl,
					});
					refreshed++;
				} else {
					failed++;
					console.warn(
						"[image-refresh] extract failed",
						character.id,
						result.error,
					);
				}
			} catch (err) {
				failed++;
				console.warn("[image-refresh] threw", character.id, err);
			}

			done++;
			if (window && !window.isDestroyed()) {
				window.webContents.send("images:refreshProgress", {
					done,
					total: targets.length,
				});
			}

			if (done < targets.length) await delay(BETWEEN_REQUESTS_MS);
		}

		const result: ImageRefreshResult = {
			total: targets.length,
			refreshed,
			failed,
			startedAt,
			finishedAt: new Date().toISOString(),
		};

		await updateSettings({ lastImageRefreshAt: result.finishedAt });
		console.log("[image-refresh] done", result);

		if (window && !window.isDestroyed()) {
			window.webContents.send("images:refreshComplete", result);
		}

		return result;
	})();

	return inFlight.finally(() => {
		inFlight = null;
	});
}
