import { NextResponse } from "next/server";
import { analyzeRequestSchema } from "@/lib/schemas";
import { fetchHtml } from "@/lib/safe-fetch";
import { parsePdp } from "@/lib/pdp-parser";
import { analyzeProduct } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { url } = analyzeRequestSchema.parse(await request.json());
    const page = await fetchHtml(url);
    const seed = parsePdp(page.data.toString("utf8"), page.finalUrl);
    return NextResponse.json(await analyzeProduct(seed));
  } catch (error) { return errorResponse(error); }
}
