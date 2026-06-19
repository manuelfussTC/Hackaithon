import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "@/lib/schemas";
import { fetchHtml } from "@/lib/safe-fetch";
import { parsePdp } from "@/lib/pdp-parser";
import { analyzeProduct } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";
import { assertApiRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertApiRequest(request, { maxBytes: 16_384, requestsPerMinute: 30 });
    const { url } = analyzeRequestSchema.parse(await request.json());
    const page = await fetchHtml(url);
    const seed = parsePdp(page.data.toString("utf8"), page.finalUrl);
    return NextResponse.json(await analyzeProduct(seed));
  } catch (error) { return errorResponse(error); }
}
