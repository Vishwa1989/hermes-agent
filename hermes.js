import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT =
  process.env.HERMES_SYSTEM_PROMPT ||
  "You are Hermes, a helpful, concise personal assistant.";

const MODEL = process.env.HERMES_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOOL_ROUNDS = 4;

// Shared by the web chat UI and the WhatsApp webhook — any channel just
// needs to pass in a message history and get back a final reply, with
// tool calls (e.g. Firecrawl) resolved along the way.
export async function getHermesReply(messages) {
  const working = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools,
      messages: working,
    });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    }

    working.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const result = await runTool(block.name, block.input);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Error: ${err.message}`,
          is_error: true,
        });
      }
    }
    working.push({ role: "user", content: toolResults });
  }

  return "I wasn't able to finish that — too many tool steps.";
}
