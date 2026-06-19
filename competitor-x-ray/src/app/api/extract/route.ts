import { NextResponse } from "next/server";
import { extractRequestSchema } from "@/lib/schemas";
import { assertPublicUrl, fetchHtml } from "@/lib/safe-fetch";
import { parsePdp, type LocalPageData } from "@/lib/pdp-parser";
import { enrichPdpData } from "@/lib/pdp-enrichment";
import { extractWithTavily, requirePageSource, type TavilyPage } from "@/lib/tavily";
import { buildProfiles, type CombinedSource } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";
import { assertApiRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 90;

function tavilyFor(map: Map<string, TavilyPage>, url: string) {
  const target = new URL(url);
  return [...map.values()].find((page) => {
    try { const candidate = new URL(page.url); return candidate.hostname === target.hostname && candidate.pathname.replace(/\/$/, "") === target.pathname.replace(/\/$/, ""); } catch { return false; }
  }) || null;
}

function parseLocal(result: PromiseSettledResult<Awaited<ReturnType<typeof fetchHtml>>>) {
  if (result.status === "rejected") return null;
  try {
    return parsePdp(result.value.data.toString("utf8"), result.value.finalUrl);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    assertApiRequest(request, { maxBytes: 32_768, requestsPerMinute: 30 });
    const { ownUrl, competitorUrl } = extractRequestSchema.parse(await request.json());
    await Promise.all([assertPublicUrl(ownUrl), assertPublicUrl(competitorUrl)]);
    const [localResults, tavily] = await Promise.all([
      Promise.allSettled([fetchHtml(ownUrl), fetchHtml(competitorUrl)]),
      extractWithTavily([ownUrl, competitorUrl]),
    ]);
    const parsed: Array<LocalPageData | null> = localResults.map(parseLocal);
    const local = await Promise.all(parsed.map((page) => page ? enrichPdpData(page) : null));
    const ownTavily = tavilyFor(tavily, ownUrl);
    const competitorTavily = tavilyFor(tavily, competitorUrl);
    requirePageSource(local[0], ownTavily, "Deine Produktseite");
    requirePageSource(local[1], competitorTavily, "Die Wettbewerberseite");
    const own: CombinedSource = { url: ownUrl, side: "own", local: local[0], tavily: ownTavily };
    const competitor: CombinedSource = { url: competitorUrl, side: "competitor", local: local[1], tavily: competitorTavily };
    return NextResponse.json(await buildProfiles(own, competitor));
  } catch (error) { return errorResponse(error); }
}
