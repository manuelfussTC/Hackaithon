import { NextResponse } from "next/server";
import { regenerateRequestSchema } from "@/lib/schemas";
import { regenerateSection } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = regenerateRequestSchema.parse(await request.json());
    return NextResponse.json(await regenerateSection(input.section, input.analysis, input.current, input.instruction));
  } catch (error) { return errorResponse(error); }
}
