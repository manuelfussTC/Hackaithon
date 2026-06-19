import { afterEach, describe, expect, it, vi } from "vitest";
import { xrayMarkdown } from "./export";
import { parsePdp } from "./pdp-parser";
import { enrichPdpData } from "./pdp-enrichment";
import { isPrivateAddress } from "./safe-fetch";
import { extractWithTavily } from "./tavily";
import { overallScores, reportSchema, type PdpProfile, type XRayReport } from "./schemas";
import { assertApiRequest } from "./request-security";

const profile = (side: "own" | "competitor"): PdpProfile => ({
  sourceUrl: `https://${side}.example/product`, productName: `${side} Product`, brand: `${side} Brand`, category: "Laufschuh", price: "99 EUR", imageUrl: "https://example.com/product.jpg", description: "Leichter Laufschuh", audience: "Freizeitläufer", valueProposition: "Leicht und komfortabel", language: "de", signals: ["Lieferinformation vorhanden"], extraction: { local: true, tavily: true, degraded: false, warnings: [] },
  evidence: [{ id: `${side}-e1`, side, category: "positioning", source: "html", signal: "Headline", excerpt: "Leicht und komfortabel", confidence: 90 }],
});

const section = { ownScore: 70, competitorScore: 80, verdict: "Wettbewerber kommuniziert klarer.", ownStrengths: ["Klare Marke"], competitorStrengths: ["Mehr Belege"], ownGaps: ["Trust ausbauen"], observations: [{ claim: "Headline ist sichtbar", side: "own" as const, evidenceIds: ["own-e1"] }, { claim: "Wettbewerber differenziert klar", side: "competitor" as const, evidenceIds: ["competitor-e1"] }] };
const fit = { score: 88, level: "high" as const, rationale: "Gleiche Kategorie", dimensions: { category: 100, audience: 85, useCase: 90, price: 75 }, warnings: [] };
const report: XRayReport = {
  fit, sections: { positioning: section, trust: { ...section, ownScore: 60 }, presentation: { ...section, ownScore: 80 }, conversion: { ...section, ownScore: 90 } }, visualEvidence: [], confidence: 84, disclaimer: "Potenzialbewertung, keine gemessene Performance.",
  recommendations: Array.from({ length: 5 }, (_, i) => ({ rank: i + 1, title: `Maßnahme ${i + 1}`, action: "Trust ergänzen", rationale: "Wettbewerber zeigt mehr Belege", impact: "high" as const, effort: "medium" as const, evidenceIds: ["competitor-e1"], firstStep: "Trust-Modul skizzieren" })),
};

afterEach(() => { vi.unstubAllGlobals(); delete process.env.TAVILY_API_KEY; });

describe("network safety", () => {
  it("recognizes private network addresses", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("192.168.1.2")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});

describe("API request guard", () => {
  it("rejects cross-origin requests", () => {
    const request = new Request("https://app.example/api/compare", { headers: { origin: "https://evil.example" } });
    expect(() => assertApiRequest(request, { maxBytes: 1024 })).toThrowError(/Cross-Origin/);
  });

  it("rejects oversized request bodies before parsing", () => {
    const request = new Request("https://app.example/api/compare", { headers: { "content-length": "2048" } });
    expect(() => assertApiRequest(request, { maxBytes: 1024 })).toThrowError(/zu groß/);
  });

  it("requires a declared request size", () => {
    const request = new Request("https://app.example/api/compare");
    expect(() => assertApiRequest(request, { maxBytes: 1024 })).toThrowError(/angegeben/);
  });
});

describe("PDP signals", () => {
  it("extracts product identity and conversion signals", () => {
    const html = `<html lang="de"><head><script type="application/ld+json">{"@type":"Product","name":"Runner","brand":{"name":"Aero"},"image":"/shoe.jpg","offers":{"price":"99","priceCurrency":"EUR"}}</script><meta name="description" content="Leichter Schuh"></head><body><main><h1>Runner</h1><button>In den Warenkorb</button><p>30 Tage Rückgabe. Zahlung mit PayPal. ${"Produktdetails ".repeat(12)}</p></main></body></html>`;
    const result = parsePdp(html, "https://shop.example/runner");
    expect(result.imageUrl).toBe("https://shop.example/shoe.jpg");
    expect(result.signals).toContain("Rückgabeinformation vorhanden");
    expect(result.facts).toMatchObject({ ctas: ["In den Warenkorb"] });
  });

  it("extracts Shopware product price metadata and microdata", () => {
    const html = `<html><head><meta property="product:price:amount" content="408.5"><meta property="product:price:currency" content="EUR"></head><body><main><h1>TRION PS 300</h1><p>${"Produktinformation ".repeat(12)}</p></main></body></html>`;
    const result = parsePdp(html, "https://shop.example/trion");
    expect(result.price).toBe("408,50 EUR");
    expect(result.signals.some((signal) => signal.startsWith("0 "))).toBe(false);
  });

  it("enriches a Festool price from its official commerce data path", async () => {
    const local = parsePdp(`<html><body><main><h1>PS 300 EQ-Plus</h1><p>${"Produktinformation ".repeat(12)}</p></main><script>window.festoolvue={productDetailsPage:{"productBaseInfo":{"productNumber":"576041"},"productVariantSelection":{}}}</script></body></html>`, "https://www.festool.de/produkte/saegen/stichsaegen/576041---ps-300-eq-plus");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response('window.tts.servicesettings = {"accessToken":"public-token"};'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ itemPriceWithTax: { amount: 473.45, currency: "EUR" } }))));
    const enriched = await enrichPdpData(local);
    expect(enriched.price).toBe("473,45 EUR");
    expect(enriched.facts).toMatchObject({ dynamicPriceSource: "Festool Commerce API" });
  });
});

describe("Tavily enrichment", () => {
  it("maps advanced extraction content and images", async () => {
    process.env.TAVILY_API_KEY = "tvly-test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ url: "https://shop.example/p", raw_content: "# Product\nTrust content", images: ["https://shop.example/p.jpg"] }] }), { status: 200 })));
    const result = await extractWithTavily(["https://shop.example/p"]);
    expect(result.get("https://shop.example/p")?.images).toEqual(["https://shop.example/p.jpg"]);
  });
  it("degrades cleanly without a key", async () => expect((await extractWithTavily(["https://shop.example/p"])).size).toBe(0));
});

describe("report contracts", () => {
  it("validates exactly five recommendations", () => expect(reportSchema.parse(report)).toEqual(report));
  it("recalculates equal-weight overall scores", () => expect(overallScores(report)).toEqual({ own: 75, competitor: 80 }));
  it("exports scores and recommendations", () => {
    const markdown = xrayMarkdown(profile("own"), profile("competitor"), report);
    expect(markdown).toContain("# Competitor X-Ray");
    expect(markdown).toContain("## Top 5 Handlungsempfehlungen");
    expect(markdown).toContain("**Wirkung:** hoch · **Aufwand:** mittel");
    expect(markdown).not.toContain("**Impact:**");
  });
});
