import { NextResponse } from "next/server";
import { pdpProfileSchema, regenerateRequestSchema, reportSchema, sectionKeySchema } from "@/lib/schemas";
import { screenshotsFromForm } from "@/lib/screenshots";
import { regenerateReportSection } from "@/lib/openai";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const input = regenerateRequestSchema.parse({
      section: sectionKeySchema.parse(String(form.get("section"))),
      own: pdpProfileSchema.parse(JSON.parse(String(form.get("own")))),
      competitor: pdpProfileSchema.parse(JSON.parse(String(form.get("competitor")))),
      report: reportSchema.parse(JSON.parse(String(form.get("report")))),
      instruction: String(form.get("instruction") || ""),
    });
    return NextResponse.json(await regenerateReportSection(input.section, input.own, input.competitor, input.report, input.instruction, await screenshotsFromForm(form)));
  } catch (error) { return errorResponse(error); }
}
