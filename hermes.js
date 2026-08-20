import Anthropic from "@anthropic-ai/sdk";
import { tools, runTool } from "./tools.js";
import { getMemoryContext } from "./memory.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT =
  process.env.HERMES_SYSTEM_PROMPT ||
  "You are Hermes, a helpful, concise personal assistant.";

const LEARNING_PROMPT = `You can remember durable facts about the user and save named skills (procedures) they teach you, using the remember and create_skill tools. Only call these after the user has explicitly asked, or has said yes after you proactively asked. If you notice something that seems worth remembering — a stated preference, a correction, a recurring instruction — ask the user first ("Want me to remember that?") rather than saving it silently.

Never save claims about your own tools, capabilities, or access as a "memory" — your actual tool list (visible to you on every request) is the only source of truth for what you can do. If you're unsure whether a tool is working, say so and report the real error rather than guessing and persisting that guess as fact.`;

const MODEL = process.env.HERMES_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOOL_ROUNDS = 4;

// Shared by the web chat UI and the WhatsApp webhook — any channel just
// needs to pass in a message history and a userId, and gets back a final
// reply, with tool calls (Firecrawl, memory, skills) resolved along the way.
export async function getHermesReply(messages, userId = "default") {
  const working = [...messages];
  const memoryContext = await getMemoryContext(userId);

  const system = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: LEARNING_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  if (memoryContext) system.push({ type: "text", text: memoryContext });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
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
        const result = await runTool(block.name, block.input, userId);
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
