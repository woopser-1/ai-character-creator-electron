#!/usr/bin/env node
// MCP stdio server exposing user-interaction tools.
// Bridges tool calls to the main Electron process via a unix socket passed in BRIDGE_SOCKET env.
import net from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const bridgeSocket = process.env.BRIDGE_SOCKET;
if (!bridgeSocket) {
  process.stderr.write("[mcp-user-tools] BRIDGE_SOCKET env var missing\n");
  process.exit(1);
}

const pending = new Map();
let bridgeBuffer = "";

const bridgeClient = net.createConnection(bridgeSocket, () => {
  process.stderr.write(`[mcp-user-tools] connected to bridge at ${bridgeSocket}\n`);
});

bridgeClient.on("data", (chunk) => {
  bridgeBuffer += chunk.toString("utf8");
  let idx;
  while ((idx = bridgeBuffer.indexOf("\n")) >= 0) {
    const line = bridgeBuffer.slice(0, idx);
    bridgeBuffer = bridgeBuffer.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "tool-result") {
        const resolver = pending.get(msg.toolCallId);
        if (resolver) {
          pending.delete(msg.toolCallId);
          resolver(msg.output);
        }
      }
    } catch (err) {
      process.stderr.write(`[mcp-user-tools] bridge parse error: ${err}\n`);
    }
  }
});

bridgeClient.on("error", (err) => {
  process.stderr.write(`[mcp-user-tools] bridge socket error: ${err.message}\n`);
  process.exit(2);
});

bridgeClient.on("close", () => {
  for (const resolver of pending.values()) {
    resolver("");
  }
  pending.clear();
  process.exit(0);
});

function callBridge(tool, input) {
  return new Promise((resolve) => {
    const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    pending.set(toolCallId, resolve);
    bridgeClient.write(
      `${JSON.stringify({ type: "tool-call", toolCallId, tool, input })}\n`
    );
  });
}

const TOOLS = [
  {
    name: "suggestOptions",
    description:
      "Ask the user a multiple-choice question with suggested options. Use when the user benefits from concrete choices but should be allowed to provide a custom answer.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to ask the user" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "3-6 suggested options",
        },
      },
      required: ["question", "options"],
    },
  },
  {
    name: "askUser",
    description: "Ask the user a free-form text question. Use for open-ended prompts.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
      },
      required: ["question"],
    },
  },
  {
    name: "askYesNo",
    description: "Ask the user a yes/no question.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
      },
      required: ["question"],
    },
  },
  {
    name: "selectMultiple",
    description:
      "Ask the user to select multiple items from a list of suggestions, with support for custom items.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
      },
      required: ["question", "options"],
    },
  },
];

const server = new Server(
  { name: "user-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const toolName = req.params.name;
  const input = req.params.arguments ?? {};
  const output = await callBridge(toolName, input);
  return { content: [{ type: "text", text: String(output ?? "") }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("[mcp-user-tools] server started\n");
