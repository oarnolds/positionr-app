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

export const WebsiteCheckOutputSchema = z.object({
  companyName: z.string(),
  websiteUrl: z.string(),
  overallScore: z.number().min(1).max(10),
  executiveSummary: z.string(),
  onderdelen: z.array(OnderdeelSchema),
  sterkePunten: z.array(z.string()),
  verbeterpunten: z.array(z.string()),
  topActies: z.array(ActieSchema),
});
export type WebsiteCheckOutput = z.infer<typeof WebsiteCheckOutputSchema>;
