import { expect, test } from "@playwright/test";

test("shows the branded PDP intake on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /turn product pages into growth/i })).toBeVisible();
  await expect(page.getByLabel("Produktdetailseite")).toBeVisible();
  await expect(page.getByRole("button", { name: /PDP analysieren/i })).toBeVisible();
  await expect(page.getByText("Bildprompts", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenAI – Technologieanbieter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tavily – Technologieanbieter" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Website von Manuel Fuß" })).toHaveAttribute("href", "https://manuel-fuss.de");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("restores a saved review after reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("growth-kit:v1", JSON.stringify({
    version: 1, step: "review", kit: null,
    analysis: { sourceUrl: "https://example.com/p", productName: "Testprodukt", brand: "Brand", price: "19 EUR", imageUrl: "", description: "Beschreibung", audience: "Zielgruppe", tone: "direkt", benefits: ["Schnell"], proofPoints: ["Belegt"], language: "de" },
  })));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /foundation before fire/i })).toBeVisible();
  await expect(page.locator('input[value="Testprodukt"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('input[value="Testprodukt"]')).toBeVisible();
});

test("generates multiple selected image prompts as a visible batch", async ({ page }, testInfo) => {
  const prompts = Array.from({ length: 5 }, (_, index) => ({
    id: `prompt-${index + 1}`, title: `Motiv ${index + 1}`, prompt: `Produktfotografie ${index + 1}`,
    composition: "zentriert", light: "weich", style: "editorial", format: "square", negativePrompt: "keine Artefakte",
  }));
  await page.route("**/api/images/generate", async (route) => {
    const request = route.request().postDataJSON() as { promptId: string };
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      promptId: request.promptId, mimeType: "image/png", filename: `${request.promptId}.png`,
      base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    }) });
  });
  await page.addInitScript((imagePrompts) => localStorage.setItem("growth-kit:v1", JSON.stringify({
    version: 1, step: "results",
    analysis: { sourceUrl: "https://example.com/p", productName: "Testprodukt", brand: "Brand", price: "19 EUR", imageUrl: "", description: "Beschreibung", audience: "Zielgruppe", tone: "direkt", benefits: ["Schnell"], proofPoints: ["Belegt"], language: "de" },
    kit: { metaAds: [], imagePrompts },
  })), prompts);
  await page.goto("/");
  if (testInfo.project.name === "mobile") await page.getByLabel("Output wählen").selectOption("imagePrompts");
  else await page.getByRole("button", { name: /Bildprompts/ }).click();
  await expect(page.getByRole("button", { name: /5 BILDER GENERIEREN/ })).toBeVisible();
  await page.getByRole("button", { name: /5 BILDER GENERIEREN/ }).click();
  await expect(page.getByText("GPT IMAGE 2 GENERIERT")).toBeVisible();
  await expect(page.getByText("BATCH ABGESCHLOSSEN")).toBeVisible();
  await expect(page.locator('.generated-image img')).toHaveCount(5);
});

test("turns a hero image change request into a GPT Image job", async ({ page }, testInfo) => {
  let submittedPrompt = "";
  await page.route("**/api/images/generate", async (route) => {
    const request = route.request().postDataJSON() as { prompt: string; promptId: string };
    submittedPrompt = request.prompt;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      promptId: request.promptId, mimeType: "image/png", filename: "landing-hero.png",
      base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    }) });
  });
  await page.addInitScript(() => localStorage.setItem("growth-kit:v1", JSON.stringify({
    version: 1, step: "results",
    analysis: { sourceUrl: "https://example.com/p", productName: "Testprodukt", brand: "Brand", price: "19 EUR", imageUrl: "", description: "Beschreibung", audience: "Zielgruppe", tone: "direkt", benefits: ["Schnell"], proofPoints: ["Belegt"], language: "de" },
    kit: { metaAds: [], landingHero: { eyebrow: "Neu", headline: "Headline", subheadline: "Subheadline", primaryCta: "Entdecken", secondaryCta: "Mehr", trustLine: "Sicher", visualDirection: "Helles Studio" } },
  })));
  await page.goto("/");
  if (testInfo.project.name === "mobile") await page.getByLabel("Output wählen").selectOption("landingHero");
  else await page.getByRole("button", { name: /Landingpage Hero/ }).click();
  await page.getByPlaceholder("Optionaler Änderungswunsch …").fill("Hero Bild mit dunklem Hintergrund neu machen");
  await page.getByRole("button", { name: "NEU GENERIEREN ↻" }).click();
  await expect(page.locator(".hero-image-loading")).toBeVisible();
  await expect(page.locator('[data-generated-image="true"]')).toBeVisible();
  expect(submittedPrompt).toContain("dunklem Hintergrund");
});
