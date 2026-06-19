import { NextResponse } from "next/server";
import { imageRequestSchema } from "@/lib/schemas";
import { generateImage } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";
import { assertApiRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    assertApiRequest(request, { maxBytes: 131_072, requestsPerMinute: 20 });
    const input = imageRequestSchema.parse(await request.json());
    const image = await generateImage(input.prompt, input.format, input.productImageUrl, input.useReference);
    return NextResponse.json({ promptId: input.promptId, ...image, filename: `growth-kit-${input.promptId}.png` });
  } catch (error) { return errorResponse(error); }
}
