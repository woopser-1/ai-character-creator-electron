import { useEffect } from "react";
import type { UpdateInfo } from "@shared/updates";
import { useToast } from "@/components/ui/toast";

function openReleasePage(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function useUpdateNotifier(): void {
  const { push } = useToast();

  useEffect(() => {
    const updates = window.api.updates;
    if (!updates) return;

    const shownVersions = new Set<string>();

    const notify = (info: UpdateInfo) => {
      if (!info.updateAvailable || !info.latestVersion) return;
      if (shownVersions.has(info.latestVersion)) return;
      shownVersions.add(info.latestVersion);
      push({
        tone: "info",
        title: `Update available — v${info.latestVersion}`,
        description: `You're on v${info.currentVersion}. Open the release page to download.`,
        duration: 0,
        action: {
          label: "Open release",
          onClick: () => openReleasePage(info.releaseUrl),
        },
      });
    };

    const off = updates.onAvailable(notify);

    updates.check().then(notify).catch(() => {});

    return () => off();
  }, [push]);
}
