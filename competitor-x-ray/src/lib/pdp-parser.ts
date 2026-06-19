import * as cheerio from "cheerio";
import { AppError } from "./errors";

export type LocalPageData = {
  sourceUrl: string;
  title: string;
  brand: string;
  price: string;
  imageUrl: string;
  description: string;
  languageHint: string;
  text: string;
  facts: Record<string, unknown>;
  signals: string[];
};

function findProductJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findProductJson(item); if (found) return found; }
    return null;
  }
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return record;
  return findProductJson(record["@graph"]);
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return stringValue(value[0]);
  if (value && typeof value === "object") return String((value as Record<string, unknown>).name || (value as Record<string, unknown>).url || "");
  return "";
}

function embeddedProductImage(html: string) {
  const patterns = [
    /"productBaseInfo"\s*:\s*\{[\s\S]{0,5000}?"imageUrl"\s*:\s*"([^"]+)"/i,
    /"productVariantSelection"\s*:\s*\{[\s\S]{0,5000}?"productImage"\s*:\s*\{[\s\S]{0,500}?"url"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return value.replaceAll("\\/", "/").replaceAll("\\u0026", "&");
  }
  return "";
}

function embeddedProductValue(html: string, key: string) {
  const block = html.match(/"productBaseInfo"\s*:\s*\{[\s\S]{0,12000}?\}\s*,\s*"productVariantSelection"/i)?.[0] || "";
  const value = block.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, "i"))?.[1];
  if (!value) return "";
  try { return JSON.parse(`"${value}"`) as string; } catch { return value.replaceAll("\\/", "/"); }
}

function preferHigherResolution(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "media.cdn.festool.io") url.pathname = url.pathname.replace(/_400_300(?=\.(?:webp|png|jpe?g)$)/i, "_800_600");
    return url.toString();
  } catch { return value; }
}

function textMatches(text: string, pattern: RegExp, label: string, signals: string[]) {
  if (pattern.test(text)) signals.push(label);
}

function formatStructuredPrice(value: string, currency: string) {
  const compact = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(compact)) return [compact, currency].filter(Boolean).join(" ");
  const amount = Number(compact.replace(",", "."));
  if (!Number.isFinite(amount)) return [compact, currency].filter(Boolean).join(" ");
  return [amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), currency].filter(Boolean).join(" ");
}

export function parsePdp(html: string, sourceUrl: string): LocalPageData {
  const $ = cheerio.load(html);
  let product: Record<string, unknown> = {};
  $('script[type="application/ld+json"]').each((_, element) => {
    try { product = findProductJson(JSON.parse($(element).text())) || product; } catch { /* Ignore malformed merchant JSON-LD. */ }
  });
  const offersValue = product.offers;
  const offers = (Array.isArray(offersValue) ? offersValue.find((offer) => offer && typeof offer === "object") : offersValue) as Record<string, unknown> | undefined || {};
  const aggregateRating = product.aggregateRating && typeof product.aggregateRating === "object" ? product.aggregateRating as Record<string, unknown> : {};
  const absolute = (value: string) => { try { return value ? new URL(value, sourceUrl).toString() : ""; } catch { return ""; } };
  const title = stringValue(product.name) || embeddedProductValue(html, "productName") || $('meta[property="og:title"]').attr("content") || $("h1").first().text().trim() || $("title").text().trim();
  const description = stringValue(product.description) || $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
  const imageUrl = preferHigherResolution(absolute(stringValue(product.image) || $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content") || embeddedProductImage(html) || $('main img[data-src], main img').first().attr("data-src") || $('main img').first().attr("src") || ""));
  const brand = stringValue(product.brand);
  const structuredPrice = stringValue(offers.price)
    || $('meta[property="product:price:amount"]').attr("content")
    || $('[itemprop="price"][content]').first().attr("content")
    || $('meta[itemprop="price"]').attr("content")
    || "";
  const structuredCurrency = stringValue(offers.priceCurrency)
    || $('meta[property="product:price:currency"]').attr("content")
    || $('[itemprop="priceCurrency"][content]').first().attr("content")
    || $('meta[itemprop="priceCurrency"]').attr("content")
    || "";
  const price = structuredPrice ? formatStructuredPrice(structuredPrice, structuredCurrency) : "";
  const ctas = $("button,a").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter((value) => value.length > 1 && value.length < 80).slice(0, 30);
  const headings = $("h1,h2,h3").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get().filter(Boolean).slice(0, 30);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const signals: string[] = [];
  textMatches(bodyText, /bewertung|review|sterne|kundenmeinung/i, "Kundenbewertungen sichtbar", signals);
  textMatches(bodyText, /garantie|gewährleistung/i, "Garantiekommunikation vorhanden", signals);
  textMatches(bodyText, /rückgabe|retoure|widerruf/i, "Rückgabeinformation vorhanden", signals);
  textMatches(bodyText, /lieferzeit|versand|delivery/i, "Lieferinformation vorhanden", signals);
  textMatches(bodyText, /paypal|klarna|kreditkarte|rechnung/i, "Zahlungsarten kommuniziert", signals);
  textMatches(bodyText, /sofort lieferbar|auf lager|verfügbar/i, "Verfügbarkeit kommuniziert", signals);
  if ($("video").length || /youtube|vimeo|video/i.test(html)) signals.push("Video-Inhalte erkannt");
  if ($("table").length || /technische daten|spezifikation/i.test(bodyText)) signals.push("Spezifikationen vorhanden");
  if ($("select").length || /variante|größe|farbe/i.test(bodyText)) signals.push("Variantenwahl erkannt");
  const initialHtmlImageCount = $("main img, article img").length;
  if (initialHtmlImageCount > 0) signals.push(`${initialHtmlImageCount} Bild-Elemente im initialen Produkt-HTML erkannt`);
  $("script,style,noscript,svg,nav,footer").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 28_000);
  if (!title || (text.length < 120 && !description)) throw new AppError("NO_PRODUCT_DATA", "Auf einer Seite konnten keine ausreichenden Produktdaten erkannt werden.", 422);
  return {
    sourceUrl, title, brand, price, imageUrl, description, text,
    languageHint: $("html").attr("lang") || "",
    facts: { ctas, headings, initialHtmlImageCount, imageCountScope: "Nur main/article im initialen HTML; dynamisch geladene Galerien sind nicht enthalten", videoCount: $("video").length, ratingValue: stringValue(aggregateRating.ratingValue), reviewCount: stringValue(aggregateRating.reviewCount), productNumber: embeddedProductValue(html, "productNumber") || stringValue(product.sku) },
    signals: [...new Set(signals)],
  };
}
