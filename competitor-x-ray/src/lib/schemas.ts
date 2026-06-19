import { z } from "zod";

export const sideSchema = z.enum(["own", "competitor"]);
export const sourceSchema = z.enum(["structured", "html", "tavily", "visual"]);
export const categorySchema = z.enum(["positioning", "trust", "presentation", "conversion"]);
export const sectionKeySchema = z.enum(["positioning", "trust", "presentation", "conversion", "recommendations"]);

export const evidenceSchema = z.object({
  id: z.string(),
  side: sideSchema,
  category: categorySchema,
  source: sourceSchema,
  signal: z.string(),
  excerpt: z.string(),
  confidence: z.number().int().min(0).max(100),
});

export const extractionMetaSchema = z.object({
  local: z.boolean(),
  tavily: z.boolean(),
  degraded: z.boolean(),
  warnings: z.array(z.string()),
});

export const pdpProfileSchema = z.object({
  sourceUrl: z.string(),
  productName: z.string(),
  brand: z.string(),
  category: z.string(),
  price: z.string(),
  imageUrl: z.string(),
  description: z.string(),
  audience: z.string(),
  valueProposition: z.string(),
  language: z.enum(["de", "en"]),
  signals: z.array(z.string()).max(30),
  evidence: z.array(evidenceSchema).min(1).max(40),
  extraction: extractionMetaSchema,
});

export const fitSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
  dimensions: z.object({
    category: z.number().int().min(0).max(100),
    audience: z.number().int().min(0).max(100),
    useCase: z.number().int().min(0).max(100),
    price: z.number().int().min(0).max(100),
  }),
  warnings: z.array(z.string()).max(6),
});

export const observationSchema = z.object({
  claim: z.string(),
  side: sideSchema,
  evidenceIds: z.array(z.string()).min(1).max(6),
});

export const xraySectionSchema = z.object({
  ownScore: z.number().int().min(0).max(100),
  competitorScore: z.number().int().min(0).max(100),
  verdict: z.string(),
  ownStrengths: z.array(z.string()).max(6),
  competitorStrengths: z.array(z.string()).max(6),
  ownGaps: z.array(z.string()).max(6),
  observations: z.array(observationSchema).min(2).max(10),
});

export const recommendationSchema = z.object({
  rank: z.number().int().min(1).max(5),
  title: z.string(),
  action: z.string(),
  rationale: z.string(),
  impact: z.enum(["high", "medium", "low"]),
  effort: z.enum(["high", "medium", "low"]),
  evidenceIds: z.array(z.string()).min(1).max(6),
  firstStep: z.string(),
});

export const reportSchema = z.object({
  fit: fitSchema,
  sections: z.object({
    positioning: xraySectionSchema,
    trust: xraySectionSchema,
    presentation: xraySectionSchema,
    conversion: xraySectionSchema,
  }),
  recommendations: z.array(recommendationSchema).length(5),
  visualEvidence: z.array(evidenceSchema).max(20),
  confidence: z.number().int().min(0).max(100),
  disclaimer: z.string(),
});

export const extractRequestSchema = z.object({ ownUrl: z.url(), competitorUrl: z.url() });
export const extractResponseSchema = z.object({ own: pdpProfileSchema, competitor: pdpProfileSchema, fit: fitSchema });
export const regenerateRequestSchema = z.object({
  section: sectionKeySchema,
  own: pdpProfileSchema,
  competitor: pdpProfileSchema,
  report: reportSchema,
  instruction: z.string().max(500).default(""),
});

export type Side = z.infer<typeof sideSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type PdpProfile = z.infer<typeof pdpProfileSchema>;
export type ComparisonFit = z.infer<typeof fitSchema>;
export type XRaySection = z.infer<typeof xraySectionSchema>;
export type XRayReport = z.infer<typeof reportSchema>;
export type SectionKey = z.infer<typeof sectionKeySchema>;
export type ScreenshotSlot = "ownDesktop" | "ownMobile" | "competitorDesktop" | "competitorMobile";
export type ScreenshotMap = Partial<Record<ScreenshotSlot, File>>;

export type PersistedState = {
  version: 1;
  step: "input" | "review" | "results";
  own: PdpProfile | null;
  competitor: PdpProfile | null;
  fit: ComparisonFit | null;
  report: XRayReport | null;
};

export function overallScores(report: XRayReport) {
  const values = Object.values(report.sections);
  return {
    own: Math.round(values.reduce((sum, section) => sum + section.ownScore, 0) / values.length),
    competitor: Math.round(values.reduce((sum, section) => sum + section.competitorScore, 0) / values.length),
  };
}
