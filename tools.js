import { saveMemory, saveSkill } from "./memory.js";

export const tools = [
  {
    name: "firecrawl_search",
    description:
      "Search the web using Firecrawl and get back a list of matching pages (title, URL, snippet). Use this to DISCOVER candidate URLs when you don't already know the exact page to fetch — e.g. finding vendors listed on G2/Capterra, or finding a company's site. Follow up with firecrawl_scrape on whichever result URLs you need full content from.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        limit: { type: "number", description: "Max results to return (default 5, keep small to control cost)" },
      },
      required: ["query"],
    },
  },
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
  if (name === "firecrawl_search") return searchWeb(input.query, input.limit);
  if (name === "firecrawl_scrape") return scrapeUrl(input.url);
  if (name === "remember") return saveMemory(userId, input.content);
  if (name === "create_skill") return saveSkill(userId, input.name, input.instructions);
  throw new Error(`Unknown tool: ${name}`);
}

async function searchWeb(query, limit = 5) {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: Math.min(limit || 5, 8) }),
  });

  if (!res.ok) {
    throw new Error(`Firecrawl search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const results = (data?.data || []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: (r.description || "").slice(0, 300),
  }));
  return JSON.stringify(results);
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
