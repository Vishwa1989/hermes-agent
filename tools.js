import { saveMemory, saveSkill } from "./memory.js";

export const tools = [
  {
    name: "firecrawl_scrape",
    description:
      "Fetch a web page using Firecrawl and return its content as clean markdown. This IS your Firecrawl integration — use it whenever the user references a specific URL, explicitly asks you to use Firecrawl, or asks for current information that isn't in your training data. You have real, working Firecrawl access via this tool; never claim otherwise.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to fetch" },
      },
      required: ["url"],
    },
  },
  {
    name: "remember",
    description:
      "Save a durable fact or preference about the USER (not about yourself or your own tools/capabilities) for future conversations. Only call this after the user has explicitly said to remember it, or has confirmed yes after you proactively asked. Never use this to record claims about what tools you have access to — that's determined by your actual tool list, not something to guess and store.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The fact to remember, written in third person, e.g. 'Prefers metric units.'",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "create_skill",
    description:
      "Save a named procedure the user has taught you, so you follow it automatically in future conversations without being asked again.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short identifier, e.g. 'morning-briefing'" },
        instructions: { type: "string", description: "The exact procedure to follow when this skill applies" },
      },
      required: ["name", "instructions"],
    },
  },
];

export async function runTool(name, input, userId) {
  if (name === "firecrawl_scrape") return scrapeUrl(input.url);
  if (name === "remember") return saveMemory(userId, input.content);
  if (name === "create_skill") return saveSkill(userId, input.name, input.instructions);
  throw new Error(`Unknown tool: ${name}`);
}

async function scrapeUrl(url) {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const markdown = data?.data?.markdown || "No content extracted.";
  return markdown.slice(0, 8000); // bound tool-result size to keep cost predictable
}
