import { NextResponse } from "next/server";
import { regenerateRequestSchema } from "@/lib/schemas";
import { regenerateSection } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";
import { assertApiRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertApiRequest(request, { maxBytes: 524_288, requestsPerMinute: 30 });
    const input = regenerateRequestSchema.parse(await request.json());
    return NextResponse.json(await regenerateSection(input.section, input.analysis, input.current, input.instruction));
  } catch (error) { return errorResponse(error); }
}
