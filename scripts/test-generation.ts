import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { z } from "zod";
import { buildCharacterGenerationPrompt } from "../src/shared/prompts";
import { characterSchema, getFullName } from "../src/shared/schemas";

const systemPrompt = buildCharacterGenerationPrompt("medium");
const jsonSchema = z.toJSONSchema(characterSchema);

const userMessage = `Gathering summary:
- Name: Luna Chen
- 27 years old, Asian-American, shy introverted librarian in Portland
- Curvy build, auburn-dyed shoulder-length wavy hair, soft brown eyes, pale skin with a few freckles
- Loves vintage sci-fi novels (Le Guin, Bradbury), lo-fi music, rainy afternoons
- Recently came out of a 5-year relationship — still processing, guarded emotionally
- Lives alone with a grey tabby cat named Ursula
- Scenario: she's the quiet weekend librarian and the user keeps coming in for the same obscure sci-fi section
- Personality: warm but reserved, sharp dry humor when comfortable, terrible at small talk
- Difficulty: medium

Now generate the complete character as a structured JSON object matching the schema.`;

const args = [
  "-p",
  "--output-format",
  "stream-json",
  "--verbose",
  "--permission-mode",
  "bypassPermissions",
  "--model",
  "sonnet",
  "--system-prompt",
  systemPrompt,
  "--tools",
  "",
  "--json-schema",
  JSON.stringify(jsonSchema),
];

console.error(`[test] system prompt length: ${systemPrompt.length} chars`);
console.error(`[test] json schema size: ${JSON.stringify(jsonSchema).length} chars`);
console.error("[test] spawning claude CLI...");

const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
child.stdin.end(userMessage);
child.stderr.on("data", (c) => process.stderr.write(c));

const rl = createInterface({ input: child.stdout });
let finalResult: string | undefined;
let isError = false;

for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const msg = JSON.parse(line);
    if (msg.type === "system" && msg.subtype === "init") {
      console.error(
        `[test] session started, apiKeySource=${msg.apiKeySource}, model=${msg.model}`
      );
    } else if (msg.type === "assistant") {
      for (const block of msg.message.content ?? []) {
        if (block.type === "text") {
          console.error(`[test] assistant text (${block.text.length} chars)`);
        } else if (block.type === "thinking") {
          console.error(`[test] thinking (${block.thinking.length} chars)`);
        }
      }
    } else if (msg.type === "result") {
      isError = msg.is_error === true;
      finalResult = msg.result;
      console.error(
        `[test] result: is_error=${isError}, duration=${msg.duration_ms}ms, turns=${msg.num_turns}`
      );
    }
  } catch (e) {
    console.error(`[test] JSON parse error: ${(e as Error).message}`);
  }
}

if (isError || !finalResult) {
  console.error("[test] FAILED");
  process.exit(1);
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

try {
  const obj = JSON.parse(stripCodeFence(finalResult));
  const parsed = characterSchema.safeParse(obj);
  if (!parsed.success) {
    console.error("[test] Zod validation FAILED:", parsed.error.issues.slice(0, 5));
    process.exit(1);
  }
  console.error(
    `[test] OK — got valid character: ${getFullName(parsed.data)} (${parsed.data.personalityLabel})`
  );
  console.log(JSON.stringify(parsed.data, null, 2));
} catch (e) {
  console.error(`[test] Final JSON parse failed: ${(e as Error).message}`);
  console.error("[test] raw result (first 500 chars):", finalResult.slice(0, 500));
  process.exit(1);
}
