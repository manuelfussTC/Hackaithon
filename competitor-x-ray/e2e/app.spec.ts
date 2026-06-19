import { expect, test, type Page, type TestInfo } from "@playwright/test";

const evidence = (side: "own" | "competitor") => ({ id: `${side}-e1`, side, category: "positioning", source: "html", signal: "Headline", excerpt: "Klare Produktbotschaft", confidence: 90 });
const profile = (side: "own" | "competitor") => ({ sourceUrl: `https://${side}.example/p`, productName: side === "own" ? "Cloud Runner" : "Speed Pro", brand: side === "own" ? "Aero" : "Velocity", category: "Laufschuh", price: "99 EUR", imageUrl: "", description: "Leichter Laufschuh", audience: "Freizeitläufer", valueProposition: "Leicht laufen", language: "de", signals: ["Trust erkannt"], evidence: [evidence(side)], extraction: { local: true, tavily: true, degraded: false, warnings: [] } });
const fit = { score: 90, level: "high", rationale: "Sehr gut vergleichbar", dimensions: { category: 100, audience: 90, useCase: 90, price: 80 }, warnings: [] };
const section = { ownScore: 70, competitorScore: 82, verdict: "Der Wettbewerber belegt sein Versprechen klarer.", ownStrengths: ["Klare Marke"], competitorStrengths: ["Mehr Belege"], ownGaps: ["Proof Points fehlen"], observations: [{ claim: "Eigene Headline ist klar", side: "own", evidenceIds: ["own-e1"] }, { claim: "Wettbewerber differenziert stärker", side: "competitor", evidenceIds: ["competitor-e1"] }] };
const report = { fit, sections: { positioning: section, trust: { ...section, ownScore: 64 }, presentation: { ...section, ownScore: 76 }, conversion: { ...section, ownScore: 72 } }, visualEvidence: [], confidence: 86, disclaimer: "Potenzialbewertung, keine gemessene Performance.", recommendations: Array.from({ length: 5 }, (_, i) => ({ rank: i + 1, title: `Maßnahme ${i + 1}`, action: "Trust ergänzen", rationale: "Mehr Belege schaffen", impact: "high", effort: "medium", evidenceIds: ["competitor-e1"], firstStep: "Modul skizzieren" })) };

async function choose(page: Page, testInfo: TestInfo, sectionName: string, value: string) {
  if (testInfo.project.name === "mobile") await page.locator(".mobile-section select").selectOption(value);
  else await page.getByRole("button", { name: new RegExp(sectionName) }).click();
}

test("shows the two-URL branded intake", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /SEE WHAT THEY DO/i })).toBeVisible();
  await expect(page.getByPlaceholder("https://dein-shop.de/produkt/...")).toBeVisible();
  await expect(page.getByPlaceholder("https://wettbewerber.de/produkt/...")).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenAI – Technologieanbieter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tavily – Technologieanbieter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Website von Manuel Fuß" })).toHaveAttribute("href", "https://manuel-fuss.de");
});

test("runs extraction, review and evidence-backed comparison", async ({ page }, testInfo) => {
  await page.route("**/api/extract", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ own: profile("own"), competitor: profile("competitor"), fit }) }));
  await page.route("**/api/compare", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(report) }));
  await page.goto("/");
  await page.getByPlaceholder("https://dein-shop.de/produkt/...").fill("https://own.example/p");
  await page.getByPlaceholder("https://wettbewerber.de/produkt/...").fill("https://competitor.example/p");
  await page.getByRole("button", { name: "X-RAY STARTEN →" }).click();
  await expect(page.getByText("Sehr gut vergleichbar")).toBeVisible();
  const uploads = page.locator('input[type="file"]');
  await uploads.first().setInputFiles({ name: "desktop.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "VERGLEICH GENERIEREN →" }).click();
  await expect(page.getByText("DEINE LÜCKE", { exact: true })).toBeVisible();
  await expect(page.getByText("SICHERHEIT 86%", { exact: true })).toBeVisible();
  await expect(page.getByText("FAZIT", { exact: true })).toBeVisible();
  await expect(page.getByText("CONFIDENCE 86%", { exact: true })).toHaveCount(0);
  const accessibility = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll("main button, main input, main textarea, main select")].filter(visible);
    const metadata = [...document.querySelectorAll("main .kicker, main small, main label span, main .confidence, main .evidence-button")].filter(visible);
    return {
      overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      minControlHeight: Math.min(...controls.map((element) => element.getBoundingClientRect().height)),
      minInputFont: Math.min(...[...document.querySelectorAll("main input, main textarea, main select")].filter(visible).map((element) => Number.parseFloat(getComputedStyle(element).fontSize))),
      minMetadataFont: Math.min(...metadata.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))),
    };
  });
  expect(accessibility.overflows).toBe(false);
  expect(accessibility.minControlHeight).toBeGreaterThanOrEqual(44);
  expect(accessibility.minInputFont).toBeGreaterThanOrEqual(16);
  expect(accessibility.minMetadataFont).toBeGreaterThanOrEqual(12);
  await choose(page, testInfo, "Trust-Elemente", "trust");
  await expect(page.getByRole("heading", { name: "Trust-Elemente" })).toBeVisible();
  await page.getByRole("button", { name: /Headline/ }).first().click();
  await expect(page.getByRole("heading", { name: "Headline" })).toBeVisible();
});

test("restores a completed report and regenerates one section", async ({ page }, testInfo) => {
  await page.addInitScript(({ own, competitor, fit, report }) => localStorage.setItem("competitor-xray:v1", JSON.stringify({ version: 1, step: "results", own, competitor, fit, report })), { own: profile("own"), competitor: profile("competitor"), fit, report });
  await page.route("**/api/regenerate", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...section, verdict: "Neu bewerteter Trust-Verdict" }) }));
  await page.goto("/");
  await choose(page, testInfo, "Trust-Elemente", "trust");
  await page.getByPlaceholder("Optionaler Änderungswunsch …").fill("Trust strenger bewerten");
  await page.getByRole("button", { name: "NEU GENERIEREN ↻" }).click();
  await expect(page.locator(".section-verdict textarea")).toHaveValue("Neu bewerteter Trust-Verdict");
  await page.reload();
  await expect(page.getByText("DEINE LÜCKE", { exact: true })).toBeVisible();
});
