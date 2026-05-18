import { type ChildProcessByStdio, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { app } from "electron";

export type ClaudeModel = "haiku" | "sonnet" | "opus";

export interface ClaudeRunOptions {
  model: ClaudeModel;
  systemPrompt: string;
  userMessage: string;
  jsonSchema?: object;
  mcpConfig?: object;
  allowedTools?: string[];
  disableBuiltinTools?: boolean;
  timeoutMs?: number;
  stepLabel?: string;
  onMessage?: (msg: ClaudeStreamMessage) => void;
}

const DEBUG = process.env.DEBUG_CLAUDE === "1" || process.env.DEBUG_CLAUDE === "true";

function truncate(value: unknown, max = 2000): string {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…(${s.length - max} more chars)` : s;
}

export type ClaudeStreamMessage =
  | { type: "system"; subtype: string; [key: string]: unknown }
  | { type: "assistant"; message: AssistantMessage; [key: string]: unknown }
  | { type: "user"; message: UserMessage; [key: string]: unknown }
  | { type: "result"; subtype: string; is_error: boolean; result?: string; [key: string]: unknown }
  | { type: "rate_limit_event"; [key: string]: unknown }
  | { type: string; [key: string]: unknown };

export interface AssistantMessage {
  content: AssistantContentBlock[];
  role: "assistant";
}

export interface UserMessage {
  content: UserContentBlock[] | string;
  role: "user";
}

export type AssistantContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export type UserContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_result"; tool_use_id: string; content: string | object; is_error?: boolean };

export interface ClaudeRunResult {
  success: boolean;
  result?: string;
  finalAssistantText?: string;
  toolUses: Array<{ name: string; input: unknown }>;
  structuredOutput?: unknown;
  error?: string;
  rawResultEvent?: Record<string, unknown>;
}

export class ClaudeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeAuthError";
  }
}

let cachedClaudeBinaryPath: string | undefined;

export function resolveClaudeBinaryPath(): string {
  if (cachedClaudeBinaryPath) return cachedClaudeBinaryPath;
  if (process.env.CLAUDE_BIN) {
    cachedClaudeBinaryPath = process.env.CLAUDE_BIN;
    return cachedClaudeBinaryPath;
  }
  const home = homedir();
  const candidates = [
    join(home, ".local", "bin", "claude"),
    join(home, ".bun", "bin", "claude"),
    join(home, ".npm-global", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log("[claude-runner:resolved-binary]", candidate);
      cachedClaudeBinaryPath = candidate;
      return candidate;
    }
  }
  console.warn(
    "[claude-runner:resolved-binary] no candidate found, falling back to 'claude' (must be on PATH)"
  );
  cachedClaudeBinaryPath = "claude";
  return cachedClaudeBinaryPath;
}

function claudeBinaryPath(): string {
  return resolveClaudeBinaryPath();
}

let cachedClaudeCwd: string | undefined;

/**
 * Returns a stable, app-private working directory for spawned `claude` processes.
 *
 * Why: the Claude CLI scans its cwd (and ancestors) for project context — `CLAUDE.md`,
 * `.git`, `.gitignore`, etc. If the inherited cwd falls under macOS TCC-protected
 * locations (Documents, Desktop, Downloads, iCloud Drive), the OS prompts the user for
 * file-access permission. `~/Library/Application Support/...` is outside TCC, so
 * pinning every spawn there suppresses those prompts.
 */
export function resolveClaudeCwd(): string {
  if (cachedClaudeCwd) return cachedClaudeCwd;
  const base = app.isReady() ? app.getPath("userData") : join(homedir(), "Library", "Application Support", "AI Character Creator");
  const dir = join(base, "claude-workspace");
  mkdirSync(dir, { recursive: true });
  cachedClaudeCwd = dir;
  return dir;
}

export async function runClaude(options: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const label = options.stepLabel ?? options.model;
  const startedAt = Date.now();
  const args = buildArgs(options);
  console.log("[claude-runner:start]", {
    label,
    model: options.model,
    hasSchema: Boolean(options.jsonSchema),
    hasMcp: Boolean(options.mcpConfig),
    allowedTools: options.allowedTools,
  });
  const child = spawn(claudeBinaryPath(), args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    cwd: resolveClaudeCwd(),
  }) as ChildProcessByStdio<Writable, Readable, Readable>;

  child.stdin.end(options.userMessage);

  const stderrChunks: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk.toString());
  });

  const rl = createInterface({ input: child.stdout });
  const toolUses: Array<{ name: string; input: unknown }> = [];
  let finalAssistantText: string | undefined;
  let rawResultEvent: Record<string, unknown> | undefined;
  let structuredOutput: unknown;
  let resultValue: string | undefined;
  let isError = false;
  let errorMessage: string | undefined;

  const timeout = options.timeoutMs ?? 300_000;
  const timeoutHandle = setTimeout(() => {
    errorMessage = `Claude CLI timed out after ${timeout}ms`;
    child.kill("SIGTERM");
  }, timeout);

  try {
    for await (const line of rl) {
      if (!line.trim()) {
        continue;
      }
      let msg: ClaudeStreamMessage;
      try {
        msg = JSON.parse(line) as ClaudeStreamMessage;
      } catch {
        continue;
      }

      options.onMessage?.(msg);

      if (DEBUG) {
        const subtype = (msg as { subtype?: string }).subtype;
        console.log("[claude-runner:msg]", label, msg.type, subtype ?? "");
      }

      if (msg.type === "assistant") {
        const assistant = (msg as { message: AssistantMessage }).message;
        for (const block of assistant.content) {
          if (block.type === "text") {
            finalAssistantText = block.text;
          } else if (block.type === "tool_use") {
            toolUses.push({ name: block.name, input: block.input });
          }
        }
      } else if (msg.type === "result") {
        rawResultEvent = msg as unknown as Record<string, unknown>;
        isError = (msg as { is_error?: boolean }).is_error === true;
        resultValue = (msg as { result?: string }).result;
        if (options.jsonSchema && resultValue) {
          try {
            structuredOutput = JSON.parse(stripCodeFence(resultValue));
          } catch (parseError) {
            const preview = resultValue.slice(0, 500);
            errorMessage = `Failed to parse structured output: ${String(parseError)} — raw result preview: ${preview}`;
          }
        }
      }
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  const exitCode: number = await new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
      return;
    }
    child.once("close", (code) => resolve(code ?? -1));
  });

  if (exitCode !== 0 || isError) {
    const stderr = stderrChunks.join("");
    console.error("[claude-runner:fail]", {
      label,
      exitCode,
      isError,
      durationMs: Date.now() - startedAt,
      errorMessage,
      stderr: truncate(stderr, 4000),
      finalAssistantText: truncate(finalAssistantText, 1000),
      rawResultEvent: truncate(rawResultEvent, 1500),
    });
    if (
      stderr.includes("Invalid API key") ||
      stderr.includes("not authenticated") ||
      stderr.includes("claude login") ||
      stderr.includes("Please run `claude` to authenticate")
    ) {
      console.error("[claude-runner:auth]", label, truncate(stderr, 1000));
      throw new ClaudeAuthError(
        "Claude Code is not authenticated. Please run `claude login` in a terminal."
      );
    }
    return {
      success: false,
      error: errorMessage ?? stderr ?? `Claude CLI exited with code ${exitCode}`,
      toolUses,
      finalAssistantText,
      rawResultEvent,
    };
  }

  if (DEBUG) {
    const usage = (rawResultEvent as { usage?: Record<string, unknown> } | undefined)?.usage;
    console.log("[claude-runner:ok]", {
      label,
      durationMs: Date.now() - startedAt,
      hasStructured: Boolean(structuredOutput),
      usage,
    });
  }

  return {
    success: true,
    result: resultValue,
    finalAssistantText,
    toolUses,
    structuredOutput,
    rawResultEvent,
  };
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

function buildArgs(options: ClaudeRunOptions): string[] {
  const args: string[] = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--model",
    options.model,
    "--system-prompt",
    options.systemPrompt,
  ];

  if (options.disableBuiltinTools ?? true) {
    args.push("--tools", "");
  }

  if (options.jsonSchema) {
    args.push("--json-schema", JSON.stringify(options.jsonSchema));
  }

  if (options.mcpConfig) {
    args.push("--mcp-config", JSON.stringify(options.mcpConfig));
    args.push("--strict-mcp-config");
  }

  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push("--allowedTools", options.allowedTools.join(","));
  }

  return args;
}

export async function checkClaudeAvailable(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(claudeBinaryPath(), ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: resolveClaudeCwd(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    child.on("error", (err) => {
      resolve({ available: false, error: err.message });
    });
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      if (code === 0 && trimmed.includes("Claude Code")) {
        resolve({ available: true, version: trimmed });
      } else {
        const errDetail = stderr.trim() || trimmed || `exit code ${code}`;
        resolve({
          available: false,
          error: `claude CLI not found or not working: ${errDetail}`,
        });
      }
    });
  });
}
