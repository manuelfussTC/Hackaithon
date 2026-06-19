import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/schemas";
import { generateGrowthKit } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { analysis } = generateRequestSchema.parse(await request.json());
    return NextResponse.json(await generateGrowthKit(analysis));
  } catch (error) { return errorResponse(error); }
}
