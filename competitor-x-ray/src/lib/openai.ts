import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AppError } from "./errors";
import {
  evidenceSchema, extractResponseSchema, fitSchema, pdpProfileSchema, recommendationSchema,
  reportSchema, sectionKeySchema, xraySectionSchema,
  type ComparisonFit, type PdpProfile, type SectionKey, type XRayReport,
} from "./schemas";
import type { LocalPageData } from "./pdp-parser";
import type { TavilyPage } from "./tavily";

export type CombinedSource = {
  url: string;
  side: "own" | "competitor";
  local: LocalPageData | null;
  tavily: TavilyPage | null;
};

function client() {
  if (!process.env.OPENAI_API_KEY) throw new AppError("MISSING_API_KEY", "OPENAI_API_KEY fehlt in deiner .env.local.", 500);
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
const model = () => process.env.OPENAI_MODEL || "gpt-5.4-mini";
const germanOutput = "AUSGABESPRACHE: Formuliere ausnahmslos alle von dir erzeugten Texte auf Deutsch. Nutze deutsche Begriffe statt englischer Marketingfloskeln. Nur Marken, Produktnamen, technische Eigennamen und kurze wortgetreue Quellenbelege dürfen in ihrer Originalsprache bleiben. Interne Feldnamen, Enum-Werte und Evidence-IDs bleiben unverändert. Das Feld language beschreibt die Sprache der Quellseite und ändert diese Vorgabe nicht. Prüfe vor der Ausgabe selbst, dass kein deutsch-englischer Sprachmix entstanden ist.";

async function parseStructured<T extends z.ZodType>(schema: T, name: string, system: string, content: ResponseInputContent[]): Promise<z.infer<T>> {
  try {
    const response = await client().responses.parse({
      model: model(),
      input: [{ role: "system", content: system }, { role: "user", content }],
      text: { format: zodTextFormat(schema, name) },
    });
    if (!response.output_parsed) throw new Error("Structured response missing");
    return schema.parse(response.output_parsed);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(error);
    throw new AppError("OPENAI_ERROR", "Die KI-Antwort konnte nicht verarbeitet werden.", 502);
  }
}

const aiProfileSchema = pdpProfileSchema.omit({ sourceUrl: true, imageUrl: true, extraction: true });
const aiPairSchema = z.object({ own: aiProfileSchema, competitor: aiProfileSchema, fit: fitSchema });

export async function buildProfiles(own: CombinedSource, competitor: CombinedSource) {
  const ai = await parseStructured(aiPairSchema, "competitor_profiles",
    `${germanOutput} Du analysierst zwei E-Commerce-Produktdetailseiten. Nutze nur gelieferte Daten. Erfinde keine Bewertungen, Garantien, Preise oder Seitenelemente. Erzeuge pro wichtiger Aussage ein Evidence-Objekt mit kurzem wortgetreuem oder faktischem Beleg. Evidence IDs müssen eindeutig sein und mit own- bzw. competitor- beginnen. Bewerte den Produkt-Fit neutral. Ein leeres Preisfeld bedeutet ausschließlich, dass der Preis technisch nicht extrahiert wurde; behaupte dann niemals, auf der sichtbaren Seite sei kein Preis angegeben. Formuliere stattdessen 'Preis nicht extrahierbar' und behandle den Preis-Fit als unbekannt. Eine Bildanzahl von 0 im initialen HTML belegt ebenfalls keine fehlende Produktgalerie, da Bilder dynamisch geladen sein können; leite daraus keine Schwäche ab.`,
    [{ type: "input_text", text: JSON.stringify({ own, competitor }) }]);
  const merge = (profile: z.infer<typeof aiProfileSchema>, source: CombinedSource): PdpProfile => pdpProfileSchema.parse({
    ...profile,
    price: source.local?.price || profile.price,
    sourceUrl: source.url,
    imageUrl: source.local?.imageUrl || source.tavily?.images[0] || "",
    extraction: {
      local: Boolean(source.local), tavily: Boolean(source.tavily), degraded: !(source.local && source.tavily),
      warnings: [!source.local ? "Lokale Extraktion fehlgeschlagen" : "", !source.tavily ? "Tavily nicht verfügbar" : ""].filter(Boolean),
    },
  });
  return extractResponseSchema.parse({ own: merge(ai.own, own), competitor: merge(ai.competitor, competitor), fit: ai.fit });
}

type ScreenshotData = Partial<Record<"ownDesktop" | "ownMobile" | "competitorDesktop" | "competitorMobile", { mimeType: string; dataUrl: string }>>;

function comparisonContent(own: PdpProfile, competitor: PdpProfile, fit: ComparisonFit, screenshots: ScreenshotData) {
  const content: ResponseInputContent[] = [{ type: "input_text", text: JSON.stringify({ own, competitor, fit }) }];
  for (const [slot, image] of Object.entries(screenshots)) {
    if (!image) continue;
    content.push({ type: "input_text", text: `Optionaler visueller Beleg: ${slot}. Bewerte nur klar sichtbare Elemente.` });
    content.push({ type: "input_image", image_url: image.dataUrl, detail: "high" });
  }
  return content;
}

export async function compareProfiles(own: PdpProfile, competitor: PdpProfile, fit: ComparisonFit, screenshots: ScreenshotData) {
  const report = await parseStructured(reportSchema, "competitor_xray",
    `${germanOutput} Du bist ein neutraler CRO- und E-Commerce-Analyst. Vergleiche ausschließlich sichtbare oder extrahierte PDP-Signale. Positionierung, Vertrauenselemente, Produktdarstellung und Abschlusshebel werden je 0-100 bewertet. Keine Behauptung realer Conversion-, Umsatz- oder Wettbewerbsperformance. Jede Beobachtung braucht existierende Evidence IDs aus den Profilen oder neue visual-* IDs in visualEvidence. Screenshots sind optionale visuelle Belege. Erzeuge genau fünf Empfehlungen für die eigene Seite, priorisiert nach Wirkung und Aufwand. Der Hinweistext muss klar sagen, dass Bewertungen Potenzial und keine gemessene Performance darstellen.`,
    comparisonContent(own, competitor, fit, screenshots));
  return reportSchema.parse({ ...report, fit });
}

const sectionSchemas: Record<SectionKey, z.ZodType> = {
  positioning: xraySectionSchema,
  trust: xraySectionSchema,
  presentation: xraySectionSchema,
  conversion: xraySectionSchema,
  recommendations: z.array(recommendationSchema).length(5),
};

export async function regenerateReportSection(section: SectionKey, own: PdpProfile, competitor: PdpProfile, report: XRayReport, instruction: string, screenshots: ScreenshotData) {
  sectionKeySchema.parse(section);
  return parseStructured(sectionSchemas[section], `${section}_revision`,
    `${germanOutput} Überarbeite nur den angeforderten X-Ray-Bereich. Bewahre Fakten, Evidence IDs und neutrale Potenzial-Sprache. Erfinde keine Performance-Daten. Bewertungen müssen 0-100 bleiben; Empfehlungen müssen genau fünf Elemente enthalten.`,
    comparisonContent(own, competitor, report.fit, screenshots).concat({ type: "input_text", text: JSON.stringify({ section, current: section === "recommendations" ? report.recommendations : report.sections[section], instruction }) }));
}

export { evidenceSchema };
