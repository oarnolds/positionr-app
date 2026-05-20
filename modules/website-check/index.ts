export const MODULE_SLUG = "website-check" as const;

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
