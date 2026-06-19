import { z } from "zod";

export const languageSchema = z.enum(["de", "en"]);

export const productAnalysisSchema = z.object({
  sourceUrl: z.url(),
  productName: z.string().min(1),
  brand: z.string().min(1),
  price: z.string().default(""),
  imageUrl: z.string().default(""),
  description: z.string().min(1),
  audience: z.string().min(1),
  tone: z.string().min(1),
  benefits: z.array(z.string()).min(1).max(8),
  proofPoints: z.array(z.string()).max(8),
  language: languageSchema,
});

export const metaAdSchema = z.object({
  primaryText: z.string(), headline: z.string(), description: z.string(), cta: z.string(),
});

export const growthKitSchema = z.object({
  metaAds: z.array(metaAdSchema).length(3),
  googleAds: z.object({
    headlines: z.array(z.string().max(30)).length(15),
    descriptions: z.array(z.string().max(90)).length(4),
    keywords: z.array(z.string()).min(5).max(20),
  }),
  newsletter: z.object({
    subjectLines: z.array(z.string()).length(3), preheader: z.string(), body: z.string(),
  }),
  linkedin: z.object({ hook: z.string(), body: z.string(), cta: z.string(), hashtags: z.array(z.string()) }),
  ugcScripts: z.array(z.object({
    title: z.string(), duration: z.string(), hook: z.string(), scenes: z.array(z.string()),
    voiceover: z.string(), onScreenText: z.array(z.string()), cta: z.string(),
  })).length(3),
  imagePrompts: z.array(z.object({
    id: z.string(), title: z.string(), prompt: z.string(), composition: z.string(), light: z.string(),
    style: z.string(), format: z.enum(["square", "portrait", "landscape"]), negativePrompt: z.string(),
  })).length(5),
  landingHero: z.object({
    eyebrow: z.string(), headline: z.string(), subheadline: z.string(), primaryCta: z.string(),
    secondaryCta: z.string(), trustLine: z.string(), visualDirection: z.string(),
  }),
});

export const analyzeRequestSchema = z.object({ url: z.url() });
export const generateRequestSchema = z.object({ analysis: productAnalysisSchema });
export const sectionSchema = z.enum(["metaAds", "googleAds", "newsletter", "linkedin", "ugcScripts", "imagePrompts", "landingHero"]);
export const regenerateRequestSchema = z.object({
  section: sectionSchema,
  analysis: productAnalysisSchema,
  current: z.unknown(),
  instruction: z.string().max(500).default(""),
});
export const imageRequestSchema = z.object({
  promptId: z.string(), prompt: z.string().min(10).max(5000),
  format: z.enum(["square", "portrait", "landscape"]),
  productImageUrl: z.string().default(""), useReference: z.boolean().default(true),
});

export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;
export type GrowthKit = z.infer<typeof growthKitSchema>;
export type SectionKey = z.infer<typeof sectionSchema>;
export type ImageAsset = { promptId: string; base64: string; mimeType: string; filename: string };

export type PersistedState = {
  version: 1;
  step: "input" | "review" | "results";
  analysis: ProductAnalysis | null;
  kit: GrowthKit | null;
};
