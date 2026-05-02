import { z } from "zod";

export const RUN_INTENTS = ["new", "replace", "version", "topic"] as const;
export type RunIntent = (typeof RUN_INTENTS)[number];

export const ICPInput = z.object({
  clientId: z.string().uuid(),
  product: z.string().trim().min(2).max(120),
  productDescription: z.string().trim().min(10).max(1000),
  runIntent: z.enum(RUN_INTENTS).default("new"),
});
export type ICPInput = z.infer<typeof ICPInput>;

export const ICPOutput = z.object({
  bedrijfsnaam: z.string(),
  product: z.string(),

  banner: z.object({
    samenvatting: z.string().min(20),
    sectorPositie: z.string(),
    websiteAnalyseScore: z.number().min(0).max(100),
  }),

  firmografisch: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.string(),
    contactpersoon: z.string(),
    beslisser: z.string(),
    contractwaarde: z.string(),
    geografie: z.string(),
  }),

  pijnpunten: z.array(z.string()).min(3).max(7),
  triggers: z.array(z.string()).min(3).max(7),

  dienstFocus: z.object({
    kernBelofte: z.string(),
    prijsindicatie: z.string(),
    onderscheidend: z.string(),
  }),
});
export type ICPOutput = z.infer<typeof ICPOutput>;

// Shape van clients.facts.icp[i]
export type ICPFactEntry = {
  product: string;
  sessionId: string;
  output: ICPOutput;
  runAt: string; // ISO
  runIntent: RunIntent;
};

// Shape van clients.facts.website_snapshot
export type WebsiteSnapshot = {
  url: string;
  title: string;
  metaDescription: string;
  heroText: string;
  bodyExcerpt: string;
  scrapedAt: string;
};
