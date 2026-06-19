import { describe, expect, it } from "vitest";
import { growthKitMarkdown } from "./export";
import { parsePdp } from "./pdp-parser";
import { growthKitSchema, type GrowthKit, type ProductAnalysis } from "./schemas";
import { isPrivateAddress } from "./safe-fetch";
import { imageProviderError, resolveImageQuality } from "./openai";
import { assertApiRequest } from "./request-security";

const analysis: ProductAnalysis = {
  sourceUrl: "https://shop.example/product", productName: "Cloud Runner", brand: "Aero",
  price: "99 EUR", imageUrl: "https://shop.example/shoe.png", description: "Ein leichter Laufschuh.",
  audience: "Freizeitläufer", tone: "klar und motivierend", benefits: ["Leicht"], proofPoints: ["Recyceltes Material"], language: "de",
};

const kit: GrowthKit = {
  metaAds: Array.from({ length: 3 }, (_, i) => ({ primaryText: `Text ${i}`, headline: "Leicht laufen", description: "Mehr Komfort", cta: "Entdecken" })),
  googleAds: { headlines: Array.from({ length: 15 }, (_, i) => `Headline ${i}`), descriptions: Array.from({ length: 4 }, () => "Eine kurze Beschreibung"), keywords: ["schuhe", "laufen", "leicht", "komfort", "runner"] },
  newsletter: { subjectLines: ["A", "B", "C"], preheader: "Preheader", body: "Newsletter body" },
  linkedin: { hook: "Hook", body: "Post", cta: "Mehr", hashtags: ["#commerce"] },
  ugcScripts: Array.from({ length: 3 }, (_, i) => ({ title: `Script ${i}`, duration: "20s", hook: "Hook", scenes: ["Szene"], voiceover: "VO", onScreenText: ["Text"], cta: "CTA" })),
  imagePrompts: Array.from({ length: 5 }, (_, i) => ({ id: `prompt-${i}`, title: `Motiv ${i}`, prompt: "Ein hochwertiges Produktfoto des Laufschuhs", composition: "zentriert", light: "weich", style: "editorial", format: "square" as const, negativePrompt: "keine Logos" })),
  landingHero: { eyebrow: "Neu", headline: "Laufe leichter", subheadline: "Komfort für jeden Kilometer", primaryCta: "Entdecken", secondaryCta: "Mehr erfahren", trustLine: "Sicher bestellen", visualDirection: "Dynamisches Studiofoto" },
};

describe("network safety", () => {
  it("recognizes private IPv4 and IPv6 ranges", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.2")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});

describe("API request guard", () => {
  it("rejects cross-origin requests", () => {
    const request = new Request("https://app.example/api/generate", { headers: { origin: "https://evil.example" } });
    expect(() => assertApiRequest(request, { maxBytes: 1024 })).toThrowError(/Cross-Origin/);
  });

  it("rejects oversized request bodies before parsing", () => {
    const request = new Request("https://app.example/api/generate", { headers: { "content-length": "2048" } });
    expect(() => assertApiRequest(request, { maxBytes: 1024 })).toThrowError(/zu groß/);
  });

  it("requires a declared request size", () => {
    const request = new Request("https://app.example/api/generate");
    expect(() => assertApiRequest(request, { maxBytes: 1024 })).toThrowError(/angegeben/);
  });
});

describe("PDP parser", () => {
  it("prioritizes Product JSON-LD and resolves images", () => {
    const html = `<html lang="de"><head><script type="application/ld+json">{"@type":"Product","name":"Cloud Runner","brand":{"name":"Aero"},"image":"/shoe.png","description":"Leichter Laufschuh","offers":{"price":"99","priceCurrency":"EUR"}}</script></head><body><h1>Fallback</h1><p>${"Produktinformation ".repeat(12)}</p></body></html>`;
    const result = parsePdp(html, "https://shop.example/p/runner");
    expect(result.title).toBe("Cloud Runner");
    expect(result.brand).toBe("Aero");
    expect(result.imageUrl).toBe("https://shop.example/shoe.png");
    expect(result.price).toBe("99 EUR");
  });
  it("extracts product images from embedded storefront state", () => {
    const html = `<html lang="de"><head><title>Festool PSC-E 18</title><meta name="description" content="Akku-Pendelstichsäge für präzise Schnitte"></head><body><script>window.store = {"productBaseInfo":{"productName":"PSC-E 18","imageUrl":"https:\\/\\/media.cdn.festool.io\\/product_400_300.webp"}};</script><main><h1>PSC-E 18</h1><p>${"Produktinformation ".repeat(12)}</p></main></body></html>`;
    expect(parsePdp(html, "https://shop.example/product").imageUrl).toBe("https://media.cdn.festool.io/product_800_600.webp");
  });
});

describe("Growth Kit contracts", () => {
  it("validates the complete seven-channel payload", () => expect(growthKitSchema.parse(kit)).toEqual(kit));
  it("rejects Google headlines over 30 characters", () => {
    const invalid = structuredClone(kit); invalid.googleAds.headlines[0] = "x".repeat(31);
    expect(() => growthKitSchema.parse(invalid)).toThrow();
  });
  it("exports visible content as Markdown", () => {
    const markdown = growthKitMarkdown(analysis, kit);
    expect(markdown).toContain("# Growth Kit: Cloud Runner");
    expect(markdown).toContain("## Landingpage Hero");
  });
});

describe("image provider errors", () => {
  it("uses medium quality by default and accepts an explicit speed setting", () => {
    expect(resolveImageQuality(undefined)).toBe("medium");
    expect(resolveImageQuality("low")).toBe("low");
    expect(resolveImageQuality("unsupported")).toBe("medium");
  });

  it("explains unsupported model parameters", () => {
    const error = imageProviderError({ status: 400, code: "invalid_input_fidelity_model" });
    expect(error.code).toBe("IMAGE_MODEL_CONFIGURATION");
    expect(error.message).toContain("Bildmodell");
  });

  it("distinguishes rate limits from generic image failures", () => {
    const error = imageProviderError({ status: 429 });
    expect(error.code).toBe("IMAGE_RATE_LIMIT");
    expect(error.status).toBe(429);
  });
});
