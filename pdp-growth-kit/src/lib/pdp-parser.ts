import * as cheerio from "cheerio";
import { AppError } from "./errors";

export type ProductSeed = {
  sourceUrl: string; title: string; brand: string; price: string; imageUrl: string; description: string; text: string; languageHint: string;
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
  const scopedPatterns = [
    /"productBaseInfo"\s*:\s*\{[\s\S]{0,5000}?"imageUrl"\s*:\s*"([^"]+)"/i,
    /"productVariantSelection"\s*:\s*\{[\s\S]{0,5000}?"productImage"\s*:\s*\{[\s\S]{0,500}?"url"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of scopedPatterns) {
    const value = html.match(pattern)?.[1];
    if (value) return value.replaceAll("\\/", "/").replaceAll("\\u0026", "&");
  }
  return "";
}

function preferHigherResolution(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "media.cdn.festool.io") {
      url.pathname = url.pathname.replace(/_400_300(?=\.(?:webp|png|jpe?g)$)/i, "_800_600");
    }
    return url.toString();
  } catch { return value; }
}

function domProductImage($: cheerio.CheerioAPI) {
  const selectors = [
    '[itemprop="image"]',
    '.product-gallery img',
    '.product-media img',
    '.product-image img',
    'main img[data-src]',
  ];
  for (const selector of selectors) {
    const element = $(selector).first();
    const srcset = element.attr("srcset") || element.attr("data-srcset") || "";
    const value = element.attr("src") || element.attr("data-src") || srcset.split(",")[0]?.trim().split(/\s+/)[0] || "";
    if (value && !value.startsWith("data:")) return value;
  }
  return "";
}

export function parsePdp(html: string, sourceUrl: string): ProductSeed {
  const $ = cheerio.load(html);
  let product: Record<string, unknown> = {};
  $('script[type="application/ld+json"]').each((_, element) => {
    try { product = findProductJson(JSON.parse($(element).text())) || product; } catch { /* Ignore broken merchant JSON-LD. */ }
  });
  const offers = (product.offers && typeof product.offers === "object") ? product.offers as Record<string, unknown> : {};
  const absolute = (value: string) => { try { return value ? new URL(value, sourceUrl).toString() : ""; } catch { return ""; } };
  const title = stringValue(product.name) || $('meta[property="og:title"]').attr("content") || $("h1").first().text().trim() || $("title").text().trim();
  const description = stringValue(product.description) || $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
  const imageUrl = preferHigherResolution(absolute(
    stringValue(product.image) ||
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    embeddedProductImage(html) ||
    domProductImage($),
  ));
  const brand = stringValue(product.brand);
  const price = [stringValue(offers.price), stringValue(offers.priceCurrency)].filter(Boolean).join(" ");
  $("script,style,noscript,svg,nav,footer").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 24_000);
  if (!title || (text.length < 120 && !description)) throw new AppError("NO_PRODUCT_DATA", "Auf dieser Seite konnten keine ausreichenden Produktdaten erkannt werden.", 422);
  return { sourceUrl, title, brand, price, imageUrl, description, text, languageHint: $("html").attr("lang") || "" };
}
