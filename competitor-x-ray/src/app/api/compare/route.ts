import { NextResponse } from "next/server";
import { fitSchema, pdpProfileSchema } from "@/lib/schemas";
import { screenshotsFromForm } from "@/lib/screenshots";
import { compareProfiles } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";
import { assertApiRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    assertApiRequest(request, { maxBytes: 6_291_456, requestsPerMinute: 15 });
    const form = await request.formData();
    const own = pdpProfileSchema.parse(JSON.parse(String(form.get("own"))));
    const competitor = pdpProfileSchema.parse(JSON.parse(String(form.get("competitor"))));
    const fit = fitSchema.parse(JSON.parse(String(form.get("fit"))));
    return NextResponse.json(await compareProfiles(own, competitor, fit, await screenshotsFromForm(form)));
  } catch (error) { return errorResponse(error); }
}
