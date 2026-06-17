import { z } from "zod";

export const MODULE_SLUG = "website-check" as const;

export const WebsiteCheckInputSchema = z.object({
  websiteUrl: z.string().trim().min(3, "URL is verplicht"),
  companyName: z.string().trim().optional(),
});

export const PLACEHOLDERS = [
  {
    key: "websiteUrl",
    label: "Website URL",
    example: "https://example.com",
  },
  {
    key: "companyName",
    label: "Bedrijfsnaam",
    example: "Acme BV",
  },
  {
    key: "scrapedContent",
    label: "Gescrapte inhoud",
    example: "(...html-tekst van de website...)",
  },
] as const;
