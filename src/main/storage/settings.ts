import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import {
  type AppSettings,
  DEFAULT_APP_SETTINGS,
  appSettingsSchema,
} from "@shared/schemas";

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
}

export async function getSettings(): Promise<AppSettings> {
  const path = settingsPath();
  try {
    const raw = await fs.readFile(path, "utf-8");
    const parsed = appSettingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ...DEFAULT_APP_SETTINGS };
    return parsed.data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_APP_SETTINGS };
    }
    throw error;
  }
}

export async function updateSettings(
  partial: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...partial };
  const path = settingsPath();
  const tmpPath = `${path}.tmp`;
  await ensureDir(path);
  await fs.writeFile(tmpPath, JSON.stringify(next, null, 2), "utf-8");
  await fs.rename(tmpPath, path);
  return next;
}
