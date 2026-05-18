export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
}
