import { type ChildProcessByStdio, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { app, type BrowserWindow } from "electron";
import { nanoid } from "nanoid";
import { join } from "node:path";
import type { AgentStreamEvent } from "@shared/chat";
import type { Character, GenerationModel, Scene, StoredCharacter } from "@shared/schemas";
import { DEFAULT_GENERATION_MODEL } from "@shared/schemas";
import {
  buildCharacterGatheringPrompt,
  buildGroupChatGatheringPrompt,
  buildRefineSceneGatheringPrompt,
  buildRegenerationGatheringPrompt,
  buildSceneGatheringPrompt,
  buildSingleSceneGatheringPrompt,
} from "@shared/prompts";
import { resolveClaudeBinaryPath, resolveClaudeCwd } from "../claude/runner";
import { type BridgeHandle, startBridge } from "../mcp/bridge";

export type GatherFlow =
  | { flow: "gather-character" }
  | { flow: "gather-scenes"; character: Character }
  | { flow: "gather-scene"; character: Character; existingScenes: Scene[] }
  | {
      flow: "refine-scene";
      character: Character;
      existingScenes: Scene[];
      targetScene: Scene;
    }
  | { flow: "gather-regenerate"; character: StoredCharacter }
  | { flow: "gather-group-chat"; characters: Character[] };

interface ActiveSession {
  id: string;
  flow: GatherFlow;
  child: ChildProcessByStdio<Writable, Readable, Readable>;
  bridge: BridgeHandle;
  window: BrowserWindow;
  closed: boolean;
  // Maps MCP toolCallId to the one we forward to renderer (same id used for simplicity).
  pendingTools: Set<string>;
  finalSummaryText: string;
}

const sessions = new Map<string, ActiveSession>();

function claudeBinaryPath(): string {
  return resolveClaudeBinaryPath();
}

function mcpServerPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(app.getAppPath(), "resources", "mcp", "user-tools-server.mjs");
  }
  return join(process.resourcesPath, "mcp", "user-tools-server.mjs");
}

function buildSystemPrompt(flow: GatherFlow): string {
  switch (flow.flow) {
    case "gather-character":
      return buildCharacterGatheringPrompt();
    case "gather-scenes":
      return buildSceneGatheringPrompt(flow.character);
    case "gather-scene":
      return buildSingleSceneGatheringPrompt(flow.character, flow.existingScenes);
    case "refine-scene":
      return buildRefineSceneGatheringPrompt(flow.character, flow.existingScenes, flow.targetScene);
    case "gather-regenerate":
      return buildRegenerationGatheringPrompt(flow.character.character);
    case "gather-group-chat":
      return buildGroupChatGatheringPrompt(flow.characters);
  }
}

function emit(session: ActiveSession, event: AgentStreamEvent): void {
  if (session.window.isDestroyed()) {
    return;
  }
  session.window.webContents.send("chat:event", event);
}

export async function startSession(
  flow: GatherFlow,
  window: BrowserWindow,
  initialUserMessage: string,
  replayTranscript?: string,
  generationModel: GenerationModel = DEFAULT_GENERATION_MODEL,
  presetSessionId?: string
): Promise<{ sessionId: string }> {
  // Honour a renderer-provided session id so the renderer can stamp its event
  // filter BEFORE the IPC call returns. Without that, the first chat:event
  // messages race the IPC reply and get dropped by the renderer's sessionId
  // filter, freezing the chat.
  const sessionId = presetSessionId ?? nanoid();
  const systemPrompt = buildSystemPrompt(flow);
  console.log("[session:start]", {
    sessionId,
    flow: flow.flow,
    replayBytes: replayTranscript?.length ?? 0,
  });
  const bridge = await startBridge();

  const mcpConfig = {
    mcpServers: {
      "user-tools": {
        command: process.execPath,
        args: [mcpServerPath()],
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          BRIDGE_SOCKET: bridge.socketPath,
        },
      },
    },
  };

  const args: string[] = [
    "-p",
    "--output-format",
    "stream-json",
    "--input-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--model",
    generationModel,
    "--system-prompt",
    systemPrompt,
    "--tools",
    "mcp__user-tools__suggestOptions,mcp__user-tools__askUser,mcp__user-tools__askYesNo,mcp__user-tools__selectMultiple",
    "--allowedTools",
    "mcp__user-tools__suggestOptions,mcp__user-tools__askUser,mcp__user-tools__askYesNo,mcp__user-tools__selectMultiple",
    "--mcp-config",
    JSON.stringify(mcpConfig),
    "--strict-mcp-config",
  ];

  const child = spawn(claudeBinaryPath(), args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    cwd: resolveClaudeCwd(),
  }) as ChildProcessByStdio<Writable, Readable, Readable>;

  const session: ActiveSession = {
    id: sessionId,
    flow,
    child,
    bridge,
    window,
    closed: false,
    pendingTools: new Set(),
    finalSummaryText: "",
  };
  sessions.set(sessionId, session);

  child.on("error", (err) => {
    console.error("[session:spawn-error]", sessionId, err);
    if (session.closed) return;
    session.closed = true;
    emit(session, {
      sessionId,
      type: "error",
      error: `Failed to start Claude CLI: ${err.message}`,
    });
    bridge.close();
    sessions.delete(sessionId);
  });
  child.stdin.on("error", (err) => {
    console.error("[session:stdin-error]", sessionId, err);
  });

  // Renderer → (bridge) → MCP tool result forwarding.
  bridge.onToolCall(({ toolCallId, tool, input }) => {
    session.pendingTools.add(toolCallId);
    emit(session, {
      sessionId,
      type: "tool-call",
      toolCallId,
      toolName: tool,
      input,
    });
  });

  // Parse claude stdout stream-json messages.
  const rl = createInterface({ input: child.stdout });
  (async () => {
    for await (const line of rl) {
      if (!line.trim()) continue;
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === "assistant") {
        const content = (msg as { message?: { content?: Array<Record<string, unknown>> } }).message
          ?.content;
        if (!content) continue;
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") {
            session.finalSummaryText = block.text;
            emit(session, {
              sessionId,
              type: "text-delta",
              text: block.text,
            });
          }
        }
      } else if (msg.type === "result") {
        const isError = (msg as { is_error?: boolean }).is_error === true;
        if (isError) {
          emit(session, {
            sessionId,
            type: "error",
            error: String((msg as { result?: string }).result ?? "CLI returned error"),
          });
        } else {
          emit(session, {
            sessionId,
            type: "finished",
            finalSummary:
              (msg as { result?: string }).result ?? session.finalSummaryText,
          });
        }
      }
    }
  })().catch((err) => {
    emit(session, { sessionId, type: "error", error: String(err) });
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    console.error("[session:stderr]", sessionId, text.trim());
  });

  child.on("close", (code) => {
    session.closed = true;
    bridge.close();
    sessions.delete(sessionId);
    console.log("[session:close]", sessionId, "code=", code);
    if (code !== 0) {
      emit(session, { sessionId, type: "error", error: `CLI exited ${code}` });
    }
  });

  // Send initial user message via stream-json on stdin.
  const firstMessage = replayTranscript
    ? [
        "The user already had this conversation with you. Continue from where it leaves off without re-asking questions that were already answered. Treat the transcript as authoritative — do not challenge prior answers.",
        "",
        "<conversation>",
        replayTranscript,
        "</conversation>",
        "",
        "Now continue from the user's latest message:",
        "",
        initialUserMessage,
      ].join("\n")
    : initialUserMessage;
  writeUserMessage(child, firstMessage);

  return { sessionId };
}

function writeUserMessage(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
  text: string
): void {
  const msg = {
    type: "user",
    message: { role: "user", content: text },
  };
  child.stdin.write(`${JSON.stringify(msg)}\n`);
}

export function sendToSession(sessionId: string, text: string): void {
  const session = sessions.get(sessionId);
  if (!session || session.closed) return;
  writeUserMessage(session.child, text);
}

export function submitToolOutput(sessionId: string, toolCallId: string, output: string): void {
  const session = sessions.get(sessionId);
  if (!session || session.closed) return;
  if (!session.pendingTools.has(toolCallId)) return;
  session.pendingTools.delete(toolCallId);
  session.bridge.respondToTool(toolCallId, output);
  // Also notify renderer so it can mark the tool part complete.
  emit(session, {
    sessionId,
    type: "tool-result",
    toolCallId,
    output,
  });
}

export function stopSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.closed = true;
  session.bridge.close();
  session.child.kill("SIGTERM");
  sessions.delete(sessionId);
}
