export const tools = [
  {
    name: "scrape_url",
    description:
      "Fetch a web page and return its content as clean markdown. Use this when the user references a specific URL or asks for current information that isn't in your training data.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL to fetch" },
      },
      required: ["url"],
    },
  },
];

export async function runTool(name, input) {
  if (name === "scrape_url") return scrapeUrl(input.url);
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
