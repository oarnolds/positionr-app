import { z } from "zod";

export const ImpactSchema = z.enum(["hoog", "middel", "laag"]);

export const WebsiteCheckInputSchema = z.object({
  websiteUrl: z.string().trim().min(3, "URL is verplicht"),
  companyName: z.string().trim().optional(),
});
export type WebsiteCheckInput = z.infer<typeof WebsiteCheckInputSchema>;

const OnderdeelSchema = z.object({
  naam: z.string(),
  score: z.number().min(1).max(10),
  toelichting: z.string(),
  verbeterpunten: z.array(z.string()),
});

const ActieSchema = z.object({
  actie: z.string(),
  impact: ImpactSchema,
  toelichting: z.string(),
});

// Bekende velden (canoniek). Extra velden die de admin via de prompt toevoegt
// blijven via .passthrough() bewaard en worden door de result-view dynamisch
// onderaan getoond als "Aanvullende info".
export const WebsiteCheckOutputSchema = z
  .object({
    companyName: z.string(),
    websiteUrl: z.string(),
    overallScore: z.number().min(1).max(10),
    executiveSummary: z.string(),
    onderdelen: z.array(OnderdeelSchema),
    sterkePunten: z.array(z.string()),
    verbeterpunten: z.array(z.string()),
    topActies: z.array(ActieSchema),
  })
  .passthrough();
export type WebsiteCheckOutput = z.infer<typeof WebsiteCheckOutputSchema>;

/** Set van canonieke veldnamen — gebruikt om "extra" velden te identificeren in de view. */
export const WEBSITE_CHECK_KNOWN_FIELDS = new Set<string>([
  "companyName",
  "websiteUrl",
  "overallScore",
  "executiveSummary",
  "onderdelen",
  "sterkePunten",
  "verbeterpunten",
  "topActies",
]);
