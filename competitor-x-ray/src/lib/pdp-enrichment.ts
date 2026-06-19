import type { LocalPageData } from "./pdp-parser";

const FESTOOL_HOST = "www.festool.de";
const SETTINGS_URL = `https://${FESTOOL_HOST}/api/sitecore/fcpscript/RenderServiceSettings`;
const COMMERCE_URL = "https://api.festool.io/ecommercev2/v1/Products";

async function limitedText(url: string, init?: RequestInit, maxBytes = 100_000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Enrichment responded with ${response.status}`);
  const text = await response.text();
  if (text.length > maxBytes) throw new Error("Enrichment response is too large");
  return text;
}

export async function enrichPdpData(data: LocalPageData): Promise<LocalPageData> {
  if (data.price) return data;
  let source: URL;
  try { source = new URL(data.sourceUrl); } catch { return data; }
  if (source.hostname !== FESTOOL_HOST || !source.pathname.startsWith("/produkte/")) return data;
  const productNumber = String(data.facts.productNumber || "");
  if (!/^\d{6,9}$/.test(productNumber)) return data;

  try {
    const settings = await limitedText(SETTINGS_URL, { headers: { accept: "application/javascript" } }, 10_000);
    const token = settings.match(/"accessToken"\s*:\s*"([^"]+)"/)?.[1];
    if (!token) return data;
    const endpoint = new URL(`${COMMERCE_URL}/${productNumber}`);
    endpoint.searchParams.set("culture", "de-DE");
    endpoint.searchParams.set("source", "FestoolCustomerWebsite");
    const payload = JSON.parse(await limitedText(endpoint.toString(), {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
    })) as { itemPriceWithTax?: { amount?: number; currency?: string } };
    const amount = payload.itemPriceWithTax?.amount;
    const currency = payload.itemPriceWithTax?.currency || "EUR";
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return data;
    return {
      ...data,
      price: `${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`,
      facts: { ...data.facts, dynamicPriceSource: "Festool Commerce API" },
      signals: [...new Set([...data.signals, "Preis über den offiziellen Commerce-Datenpfad erkannt"])],
    };
  } catch {
    return data;
  }
}
