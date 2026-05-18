import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BrowserWindow, app, nativeImage, shell } from "electron";
import { registerIpc } from "./ipc/register";
import { checkForUpdate } from "./updates/check";

const UPDATE_CHECK_INITIAL_DELAY_MS = 8_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const isDev = !app.isPackaged;

app.setName("AI Character Creator");

if (process.platform === "darwin" && app.isPackaged) {
  const extraPaths = [
    join(homedir(), ".local/bin"),
    join(homedir(), ".claude/local"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];
  const current = process.env.PATH ?? "";
  const segments = current.split(":").filter(Boolean);
  for (const p of extraPaths) {
    if (!segments.includes(p)) segments.push(p);
  }
  process.env.PATH = segments.join(":");
}

function resolveIconPath(): string | undefined {
  const candidates = [
    join(__dirname, "../../resources/icon.png"),
    join(app.getAppPath(), "resources/icon.png"),
    join(process.resourcesPath ?? "", "icon.png"),
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

function createWindow(): BrowserWindow {
  const isMac = process.platform === "darwin";
  const iconPath = resolveIconPath();
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: "AI Character Creator",
    backgroundColor: "#0a0a0a",
    icon: iconPath,
    frame: isMac,
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    titleBarOverlay: isMac
      ? undefined
      : { color: "#0a0a0a", symbolColor: "#fafafa", height: 40 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      const tag = level >= 3 ? "[renderer:error]" : level === 2 ? "[renderer:warn]" : "[renderer]";
      const src = sourceId ? `${sourceId}:${line}` : "";
      console.log(tag, message, src);
    });
  }

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  console.log("[main] starting", {
    isDev,
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node,
    claudeBin: process.env.CLAUDE_BIN ?? "claude",
    debugClaude: process.env.DEBUG_CLAUDE === "1" || process.env.DEBUG_CLAUDE === "true",
  });

  if (process.platform === "darwin" && app.dock) {
    const iconPath = resolveIconPath();
    if (iconPath) {
      const image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) app.dock.setIcon(image);
    }
  }

  const mainWindow = createWindow();
  registerIpc(mainWindow);
  scheduleUpdateChecks(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function scheduleUpdateChecks(window: BrowserWindow): void {
  if (!app.isPackaged) return;

  const run = async () => {
    try {
      const info = await checkForUpdate();
      if (!info.updateAvailable || window.isDestroyed()) return;
      window.webContents.send("updates:available", info);
    } catch (err) {
      console.warn("[updates] scheduled check failed", err);
    }
  };

  setTimeout(run, UPDATE_CHECK_INITIAL_DELAY_MS);
  setInterval(run, UPDATE_CHECK_INTERVAL_MS);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
