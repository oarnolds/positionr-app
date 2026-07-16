import { test, expect } from "vitest";
import {
  GENERIC_MODULES,
  GenericReport,
  isGenericModule,
  moduleSourceTypes,
  parseGenericOutput,
  parseSourceType,
  tryParseGenericReport,
} from "./schema";

test("parseGenericOutput: strip em-dashes uit de rapporttekst", () => {
  const raw = JSON.stringify({
    kind: "report",
    report: {
      heroTekst: "Hallo — wereld",
      secties: [
        {
          titel: "A — B",
          accent: "blue",
          layout: "volledig",
          inhoud: "tekst — meer",
        },
      ],
    },
  });
  const out = parseGenericOutput(raw);
  expect(out?.kind).toBe("report");
  if (out?.kind === "report") {
    expect(out.report.heroTekst).toBe("Hallo, wereld");
    expect(out.report.secties[0]?.titel).toBe("A, B");
    expect(out.report.secties[0]?.inhoud).toBe("tekst, meer");
  }
});

test("moduleSourceTypes: toegestane bronnen per module", () => {
  expect(moduleSourceTypes("klantcase-analyse")).toEqual([
    "library",
    "url",
    "file",
  ]);
  expect(moduleSourceTypes("flyercheck")).toEqual(["library", "url", "file"]);
  // LinkedIn-analyse: bedrijfspagina-URL (gastpagina-scrape) óf een geüploade
  // analytics-export.
  expect(moduleSourceTypes("linkedin-analyse")).toEqual(["url", "file"]);
  // Markttrends, propositie en onbekende slugs: alleen bibliotheek.
  expect(moduleSourceTypes("markttrends-rapport")).toEqual(["library"]);
  expect(moduleSourceTypes("propositie-analyse")).toEqual(["library"]);
  expect(moduleSourceTypes("bestaat-niet")).toEqual(["library"]);
});

test("linkedin-doelgroep: file-only bron met herlabelde velden en stappen", () => {
  expect(moduleSourceTypes("linkedin-doelgroep")).toEqual(["file"]);
  const cfg = GENERIC_MODULES["linkedin-doelgroep"];
  expect(cfg.sectorLabel).toMatch(/doelgroep/i);
  expect(cfg.descriptionLabel).toMatch(/potentieel/i);
  expect(Array.isArray(cfg.steps) && cfg.steps.length).toBeGreaterThan(0);
});

test("linkedin-analyse: urlPattern accepteert alleen LinkedIn-bedrijfspagina's", () => {
  const pattern = GENERIC_MODULES["linkedin-analyse"].urlPattern;
  expect(pattern?.test("https://www.linkedin.com/company/biqql/")).toBe(true);
  expect(pattern?.test("https://linkedin.com/company/acme")).toBe(true);
  expect(pattern?.test("https://biqql.com/")).toBe(false);
  expect(pattern?.test("https://www.linkedin.com/in/persoon/")).toBe(false);
});

test("isGenericModule blijft werken met config-objecten", () => {
  expect(isGenericModule("klantcase-analyse")).toBe(true);
  expect(isGenericModule("propositie-analyse")).toBe(true);
  expect(isGenericModule("flyercheck")).toBe(true);
  expect(isGenericModule("linkedin-analyse")).toBe(true);
  expect(isGenericModule("markttrends-rapport")).toBe(true);
  expect(isGenericModule("website-check")).toBe(false);
});

test("parseSourceType: geldige waarden komen door, rest valt terug op library", () => {
  expect(parseSourceType("library")).toBe("library");
  expect(parseSourceType("url")).toBe("url");
  expect(parseSourceType("file")).toBe("file");
  expect(parseSourceType(null)).toBe("library");
  expect(parseSourceType(undefined)).toBe("library");
  expect(parseSourceType("iets-anders")).toBe("library");
});

test("GenericReport: feit met 'value'-alias wordt gered naar 'waarde'", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", feiten: [{ label: "Partner", value: "Tickstar (2023)" }] }],
  });
  expect(r.secties[0].feiten).toEqual([{ label: "Partner", waarde: "Tickstar (2023)" }]);
});

test("GenericReport: één gedrift feit sloopt het rapport niet meer", () => {
  // Regressie op de markttrends-bug: het model gebruikte 'value' i.p.v. 'waarde'.
  const parse = () =>
    GenericReport.parse({
      heroTekst: "H",
      secties: [
        {
          titel: "S",
          feiten: [
            { label: "Goed", waarde: "ok" },
            { label: "Gedrift", value: "gered" },
          ],
        },
      ],
    });
  expect(parse).not.toThrow();
  expect(parse().secties[0].feiten).toEqual([
    { label: "Goed", waarde: "ok" },
    { label: "Gedrift", waarde: "gered" },
  ]);
});

test("GenericReport: niet-string feit-waarde wordt gecoerced naar tekst", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", feiten: [{ label: "Aantal", waarde: 42 }] }],
  });
  expect(r.secties[0].feiten).toEqual([{ label: "Aantal", waarde: "42" }]);
});

test("GenericReport: volledig leeg feit wordt gefilterd", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", feiten: [{}, { label: "X", waarde: "y" }] }],
  });
  expect(r.secties[0].feiten).toEqual([{ label: "X", waarde: "y" }]);
});

test("GenericReport: rotte chips/stappen degraderen naar leeg, rapport blijft", () => {
  const r = GenericReport.parse({
    secties: [{ titel: "S", chips: ["ok", 5] }],
    volgendeStappen: ["stap", { niet: "string" }],
  });
  expect(r.secties[0].chips).toEqual([]);
  expect(r.volgendeStappen).toEqual([]);
});

test("tryParseGenericReport: geldige kaart-JSON → rapport (met en zonder fences)", () => {
  const json = JSON.stringify({ secties: [{ titel: "S", inhoud: "x" }] });
  expect(tryParseGenericReport(json)?.secties[0].titel).toBe("S");
  expect(tryParseGenericReport("```json\n" + json + "\n```")?.secties[0].titel).toBe("S");
});

test("tryParseGenericReport: gewone prose → null", () => {
  expect(tryParseGenericReport("# Kop\n\nGewone tekst zonder JSON.")).toBeNull();
});

test("tryParseGenericReport: leeg secties → null", () => {
  expect(tryParseGenericReport(JSON.stringify({ secties: [] }))).toBeNull();
});

test("parseGenericOutput: markdown-envelope die eigenlijk kaart-JSON is → upgrade naar report", () => {
  const reportJson = JSON.stringify({
    heroTekst: "H",
    secties: [{ titel: "S", feiten: [{ label: "P", value: "gered" }] }],
  });
  const envelope = JSON.stringify({ kind: "markdown", markdown: reportJson });
  const out = parseGenericOutput(envelope);
  expect(out?.kind).toBe("report");
  if (out?.kind === "report") {
    expect(out.report.secties[0].feiten).toEqual([{ label: "P", waarde: "gered" }]);
  }
});

test("parseGenericOutput: echte prose-markdown blijft markdown", () => {
  const envelope = JSON.stringify({ kind: "markdown", markdown: "# Titel\n\nGewone proza." });
  expect(parseGenericOutput(envelope)?.kind).toBe("markdown");
});

test("parseGenericOutput: geldig report-envelope blijft report", () => {
  const envelope = JSON.stringify({ kind: "report", report: { secties: [{ titel: "S" }] } });
  expect(parseGenericOutput(envelope)?.kind).toBe("report");
});
