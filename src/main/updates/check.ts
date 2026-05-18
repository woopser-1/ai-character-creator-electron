import { app } from "electron";
import type { UpdateInfo } from "@shared/updates";

export type { UpdateInfo };

const RELEASES_API_URL =
  "https://api.github.com/repos/woopser-1/ai-character-creator-electron/releases/latest";
const RELEASES_PAGE_URL =
  "https://github.com/woopser-1/ai-character-creator-electron/releases/latest";

interface GitHubReleaseResponse {
  tag_name?: string;
  name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}

function parseSemver(input: string): [number, number, number] | null {
  const cleaned = input.trim().replace(/^v/, "").split(/[-+]/)[0] ?? "";
  const parts = cleaned.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion();
  const fallback: UpdateInfo = {
    updateAvailable: false,
    currentVersion,
    latestVersion: null,
    releaseUrl: RELEASES_PAGE_URL,
  };

  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `ai-character-creator/${currentVersion}`,
      },
    });
    if (!response.ok) {
      console.warn("[updates] github releases responded with", response.status);
      return fallback;
    }
    const data = (await response.json()) as GitHubReleaseResponse;
    if (!data.tag_name || data.draft || data.prerelease) return fallback;
    const latestVersion = data.tag_name.replace(/^v/, "");
    return {
      updateAvailable: isNewer(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      releaseUrl: data.html_url ?? RELEASES_PAGE_URL,
      releaseName: data.name ?? undefined,
      releaseNotes: data.body ?? undefined,
      publishedAt: data.published_at ?? undefined,
    };
  } catch (err) {
    console.warn("[updates] check failed", err);
    return fallback;
  }
}
