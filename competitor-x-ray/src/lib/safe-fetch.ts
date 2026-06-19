import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./errors";

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./,
];

export function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return PRIVATE_V4.some((pattern) => pattern.test(address));
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:") || value.startsWith("::ffff:127.");
}

export async function assertPublicUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new AppError("INVALID_URL", "Bitte gib eine gültige URL ein."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new AppError("INVALID_URL", "Nur öffentliche HTTP- und HTTPS-URLs sind erlaubt.");
  if (url.username || url.password) throw new AppError("INVALID_URL", "URLs mit Zugangsdaten werden nicht unterstützt.");
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) throw new AppError("UNSAFE_URL", "Lokale Adressen sind nicht erlaubt.");

  const directIp = isIP(url.hostname);
  const addresses = directIp ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => {
    throw new AppError("DNS_ERROR", "Die Domain konnte nicht aufgelöst werden.", 422);
  });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AppError("UNSAFE_URL", "Private oder lokale Netzwerkadressen sind nicht erlaubt.");
  }
  return url;
}

type SafeFetchOptions = { maxBytes: number; allowedTypes: string[]; timeoutMs?: number; redirects?: number };

export async function safeFetch(input: string, options: SafeFetchOptions): Promise<{ data: Buffer; contentType: string; finalUrl: string }> {
  const redirects = options.redirects ?? 0;
  if (redirects > 4) throw new AppError("TOO_MANY_REDIRECTS", "Die Seite leitet zu häufig weiter.", 422);
  const url = await assertPublicUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual", signal: controller.signal,
      headers: { "user-agent": "Competitor-X-Ray/1.0 (+local hackathon template)", accept: "text/html,application/xhtml+xml,image/*;q=0.8" },
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw new AppError("FETCH_TIMEOUT", "Die Produktseite hat nicht rechtzeitig geantwortet.", 504);
    throw new AppError("FETCH_FAILED", "Die Produktseite konnte nicht geladen werden.", 422);
  } finally { clearTimeout(timeout); }

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new AppError("INVALID_REDIRECT", "Die Produktseite enthält eine ungültige Weiterleitung.", 422);
    return safeFetch(new URL(location, url).toString(), { ...options, redirects: redirects + 1 });
  }
  if (!response.ok) throw new AppError("PDP_BLOCKED", `Die Produktseite antwortet mit Status ${response.status}.`, 422);
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!options.allowedTypes.some((type) => contentType.includes(type))) throw new AppError("UNSUPPORTED_CONTENT", "Die URL liefert kein unterstütztes Format.", 422);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > options.maxBytes) throw new AppError("CONTENT_TOO_LARGE", "Die Antwort ist zu groß für die Analyse.", 413);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > options.maxBytes) throw new AppError("CONTENT_TOO_LARGE", "Die Antwort ist zu groß für die Analyse.", 413);
  return { data, contentType, finalUrl: url.toString() };
}

export const fetchHtml = (url: string) => safeFetch(url, { maxBytes: 2_000_000, allowedTypes: ["text/html", "application/xhtml+xml"] });
export const fetchImage = (url: string) => safeFetch(url, { maxBytes: 8_000_000, allowedTypes: ["image/png", "image/jpeg", "image/webp"] });
