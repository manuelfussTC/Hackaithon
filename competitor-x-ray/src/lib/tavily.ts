import { AppError } from "./errors";

export type TavilyPage = { url: string; content: string; images: string[] };

type TavilyResponse = {
  results?: Array<{ url?: string; raw_content?: string; images?: Array<string | { url?: string }> }>;
  failed_results?: Array<{ url?: string; error?: string }>;
};

export async function extractWithTavily(urls: string[]): Promise<Map<string, TavilyPage>> {
  if (!process.env.TAVILY_API_KEY) return new Map();
  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ urls, extract_depth: "advanced", include_images: true, format: "markdown", timeout: 30 }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch { return new Map(); }
  if (!response.ok) return new Map();
  const payload = await response.json() as TavilyResponse;
  const result = new Map<string, TavilyPage>();
  for (const page of payload.results || []) {
    if (!page.url || !page.raw_content) continue;
    const images = (page.images || []).map((image) => typeof image === "string" ? image : image.url || "").filter(Boolean);
    result.set(page.url, { url: page.url, content: page.raw_content.slice(0, 30_000), images });
  }
  return result;
}

export function requirePageSource(local: unknown, tavily: unknown, side: string) {
  if (!local && !tavily) throw new AppError("EXTRACTION_FAILED", `${side} konnte weder lokal noch über Tavily extrahiert werden.`, 422);
}
