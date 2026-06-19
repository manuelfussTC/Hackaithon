import type { ScreenshotSlot } from "./schemas";
import { AppError } from "./errors";

const slots: ScreenshotSlot[] = ["ownDesktop", "ownMobile", "competitorDesktop", "competitorMobile"];
const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function screenshotsFromForm(form: FormData) {
  const result: Partial<Record<ScreenshotSlot, { mimeType: string; dataUrl: string }>> = {};
  for (const slot of slots) {
    const value = form.get(slot);
    if (!(value instanceof File) || value.size === 0) continue;
    if (!allowed.has(value.type)) throw new AppError("INVALID_SCREENSHOT", "Screenshots müssen PNG, JPEG oder WebP sein.", 422);
    if (value.size > 1_100_000) throw new AppError("SCREENSHOT_TOO_LARGE", "Ein Screenshot ist größer als 1 MB. Bitte erneut komprimieren.", 413);
    result[slot] = { mimeType: value.type, dataUrl: `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString("base64")}` };
  }
  return result;
}
