import { existsSync, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app, safeStorage } from "electron";

function credentialPath(): string {
	return join(app.getPath("userData"), "openrouter.cred");
}

async function ensureDir(path: string): Promise<void> {
	await fs.mkdir(dirname(path), { recursive: true });
}

export async function setApiKey(rawKey: string): Promise<void> {
	const path = credentialPath();
	const trimmed = rawKey.trim();

	if (!trimmed) {
		await clearApiKey();
		return;
	}

	if (!safeStorage.isEncryptionAvailable()) {
		throw new Error(
			"OS-level encryption is unavailable; cannot store the OpenRouter API key securely.",
		);
	}

	const encrypted = safeStorage.encryptString(trimmed);
	const tmpPath = `${path}.tmp`;

	await ensureDir(path);
	await fs.writeFile(tmpPath, encrypted);
	await fs.rename(tmpPath, path);
}

export async function getApiKey(): Promise<string | null> {
	const path = credentialPath();

	try {
		const encrypted = await fs.readFile(path);
		if (!safeStorage.isEncryptionAvailable()) return null;

		const decrypted = safeStorage.decryptString(encrypted);
		return decrypted.trim() || null;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

export function hasApiKey(): boolean {
	return existsSync(credentialPath());
}

export async function clearApiKey(): Promise<void> {
	try {
		await fs.unlink(credentialPath());
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

export interface ApiKeyStatus {
	hasKey: boolean;
	/** Last 4 characters of the stored key, for a non-revealing UI hint. */
	maskedHint?: string;
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
	const key = await getApiKey();
	if (!key) return { hasKey: false };

	return { hasKey: true, maskedHint: key.slice(-4) };
}
