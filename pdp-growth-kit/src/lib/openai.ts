import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AppError } from "./errors";
import { fetchImage } from "./safe-fetch";
import { growthKitSchema, productAnalysisSchema, type ProductAnalysis, type SectionKey } from "./schemas";
import type { ProductSeed } from "./pdp-parser";

const aiProductAnalysisSchema = productAnalysisSchema.omit({
  sourceUrl: true,
  imageUrl: true,
  price: true,
});

function client() {
  if (!process.env.OPENAI_API_KEY) throw new AppError("MISSING_API_KEY", "OPENAI_API_KEY fehlt in deiner .env.local.", 500);
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
const textModel = () => process.env.OPENAI_MODEL || "gpt-5.4-mini";

async function structured<T extends z.ZodType>(schema: T, name: string, system: string, payload: unknown): Promise<z.infer<T>> {
  try {
    const response = await client().responses.parse({
      model: textModel(),
      input: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }],
      text: { format: zodTextFormat(schema, name) },
    });
    if (!response.output_parsed) throw new Error("No structured output");
    return schema.parse(response.output_parsed);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(error);
    throw new AppError("OPENAI_ERROR", "Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.", 502);
  }
}

export async function analyzeProduct(seed: ProductSeed) {
  const analysis = await structured(aiProductAnalysisSchema, "product_analysis",
    "Du analysierst Produktdetailseiten für E-Commerce-Marketing. Nutze ausschließlich die gelieferten Fakten, erfinde keine Zertifikate oder Belege. Leite Zielgruppe, Tonalität und Benefits präzise ab. Antworte in der erkannten Sprache; language muss de oder en sein.", seed);
  return productAnalysisSchema.parse({
    ...analysis,
    sourceUrl: seed.sourceUrl,
    imageUrl: seed.imageUrl,
    price: seed.price,
  });
}

export const generateGrowthKit = (analysis: ProductAnalysis) => structured(growthKitSchema, "growth_kit",
  "Du bist ein ausgezeichneter E-Commerce Creative Director. Erzeuge ein kanalgerechtes, konkretes Growth Kit in der angegebenen Sprache. Halte Google-Headlines strikt bei maximal 30 Zeichen und Descriptions bei maximal 90 Zeichen. Keine unbelegten Claims. Bildprompts müssen das Produkt eindeutig zeigen, für GPT Image 2 funktionieren und eindeutige IDs besitzen.", analysis);

const sectionSchemas: Record<SectionKey, z.ZodType> = {
  metaAds: growthKitSchema.shape.metaAds, googleAds: growthKitSchema.shape.googleAds,
  newsletter: growthKitSchema.shape.newsletter, linkedin: growthKitSchema.shape.linkedin,
  ugcScripts: growthKitSchema.shape.ugcScripts, imagePrompts: growthKitSchema.shape.imagePrompts,
  landingHero: growthKitSchema.shape.landingHero,
};

export async function regenerateSection(section: SectionKey, analysis: ProductAnalysis, current: unknown, instruction: string) {
  return structured(sectionSchemas[section], `${section}_revision`,
    "Überarbeite ausschließlich den angeforderten Marketingbereich. Bewahre Fakten und Markenstimme, beachte alle vorhandenen Längen- und Mengenregeln. Setze den Änderungswunsch um, falls vorhanden.",
    { section, analysis, current, instruction });
}

const sizes = { square: "1024x1024", portrait: "1024x1536", landscape: "1536x1024" } as const;

export async function generateImage(prompt: string, format: keyof typeof sizes, productImageUrl: string, useReference: boolean) {
  const api = client();
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  try {
    let result;
    if (useReference && productImageUrl) {
      const source = await fetchImage(productImageUrl);
      const fidelityPrompt = `${prompt}\n\nThe supplied product image is the exact identity reference. Preserve the product's exact geometry, proportions, colors, materials, labels, logos, buttons, controls, and distinctive construction. Do not redesign, simplify, substitute, or invent product details. Change only the scene, composition, lighting, and surrounding campaign context requested above.`;
      result = await api.images.edit({
        model,
        prompt: fidelityPrompt,
        size: sizes[format],
        quality: "high",
        output_format: "png",
        input_fidelity: "high",
        image: await toFile(source.data, "exact-product-reference", { type: source.contentType.split(";")[0] }),
      });
    } else {
      result = await api.images.generate({ model, prompt, size: sizes[format], quality: "medium", output_format: "png" });
    }
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image response is empty");
    return { base64, mimeType: "image/png" };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(error);
    throw new AppError("IMAGE_ERROR", "Das Bild konnte nicht erzeugt werden.", 502);
  }
}
