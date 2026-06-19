import { AppError } from "./errors";

type GuardOptions = { maxBytes: number; requestsPerMinute?: number };
type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();

function requestKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${forwarded || "local"}:${new URL(request.url).pathname}`;
}
export function assertApiRequest(request: Request, options: GuardOptions) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AppError("CROSS_ORIGIN_REQUEST", "Cross-Origin-Aufrufe sind für diese API nicht erlaubt.", 403);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader) throw new AppError("LENGTH_REQUIRED", "Die Größe der Anfrage muss angegeben werden.", 411);
  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > options.maxBytes) {
    throw new AppError("REQUEST_TOO_LARGE", "Die Anfrage ist zu groß.", 413);
  }

  const now = Date.now();
  const key = requestKey(request);
  const limit = options.requestsPerMinute ?? 60;
  const current = windows.get(key);
  if (!current && windows.size >= 1_000) {
    for (const [storedKey, stored] of windows) if (stored.resetAt <= now) windows.delete(storedKey);
    if (windows.size >= 1_000) throw new AppError("RATE_LIMITED", "Zu viele unterschiedliche Anfragen. Bitte warte kurz.", 429);
  }
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current;
  entry.count += 1;
  windows.set(key, entry);
  if (entry.count > limit) throw new AppError("RATE_LIMITED", "Zu viele Anfragen. Bitte warte kurz und versuche es erneut.", 429);
}
