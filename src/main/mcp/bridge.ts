import { randomBytes } from "node:crypto";
import type { Socket } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ToolCallMessage {
  type: "tool-call";
  toolCallId: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface BridgeHandle {
  socketPath: string;
  onToolCall(cb: (msg: ToolCallMessage) => void): void;
  respondToTool(toolCallId: string, output: string): void;
  close(): void;
}

export async function startBridge(): Promise<BridgeHandle> {
  const socketPath = join(tmpdir(), `acc-mcp-${randomBytes(6).toString("hex")}.sock`);
  const server = createServer();
  let activeSocket: Socket | undefined;
  const toolCallHandlers: Array<(msg: ToolCallMessage) => void> = [];
  let recvBuffer = "";

  server.on("connection", (socket) => {
    activeSocket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      recvBuffer += chunk;
      let idx: number;
      while ((idx = recvBuffer.indexOf("\n")) >= 0) {
        const line = recvBuffer.slice(0, idx);
        recvBuffer = recvBuffer.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as ToolCallMessage;
          if (msg.type === "tool-call") {
            for (const h of toolCallHandlers) {
              h(msg);
            }
          }
        } catch (err) {
          process.stderr.write(`[bridge] parse error: ${err}\n`);
        }
      }
    });
    socket.on("error", (err) => {
      process.stderr.write(`[bridge] socket error: ${err.message}\n`);
    });
    socket.on("close", () => {
      if (activeSocket === socket) {
        activeSocket = undefined;
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    socketPath,
    onToolCall(cb) {
      toolCallHandlers.push(cb);
    },
    respondToTool(toolCallId, output) {
      if (!activeSocket) {
        process.stderr.write(`[bridge] no active socket to respond toolCallId=${toolCallId}\n`);
        return;
      }
      activeSocket.write(`${JSON.stringify({ type: "tool-result", toolCallId, output })}\n`);
    },
    close() {
      activeSocket?.end();
      server.close();
    },
  };
}
