import { describe, expect, it } from "vitest";
import { parseReport } from "./parseReport";

describe("parseReport — em-dash sanitizing", () => {
  it("strip em-dashes uit prose maar behoudt de score uit de kop", () => {
    const md = [
      "### 5. Bewijsvoering — 4,0 / 10",
      "",
      "#### Wat we zien",
      "",
      "Eén bewijs — mager.",
      "",
      "#### Waarom dit telt",
      "",
      "Bewijs telt.",
      "",
      "#### Wat je kunt doen",
      "",
      "* Toon logo's — en cijfers.",
    ].join("\n");
    const r = parseReport(md);
    expect(r.onderdelen[0].score).toBe(4);
    expect(r.onderdelen[0].watWeZien).toBe("Eén bewijs, mager.");
    expect(r.onderdelen[0].watJeKuntDoen[0]).toBe("Toon logo's, en cijfers.");
    expect(JSON.stringify(r)).not.toContain("—");
  });
});

describe("parseReport", () => {
  it("vult alle blokken bij volledige input", () => {
    const md = [
      "[LOGO KLANTNAAM]",
      "",
      "**Website Analyse**",
      "**Acme**",
      "Totaalscore: 7,4 / 10",
      "",
      "# Inleiding",
      "",
      "Eerste tekst.",
      "",
      "# Samenvatting",
      "",
      "Tekst.",
      "",
      "## Sterke punten",
      "",
      "* punt a",
      "* punt b",
      "",
      "## Grootste verbeterpunten",
      "",
      "* verbeter c",
      "* verbeter d",
      "",
      "# Vervolg",
      "",
      "Slot.",
    ].join("\n");

    const r = parseReport(md);
    expect(r.cover?.score).toBe("7,4");
    expect(r.cover?.raw).toContain("Acme");
    expect(r.cover?.raw).not.toContain("Inleiding");
    expect(r.strengths).toEqual(["punt a", "punt b"]);
    expect(r.improvements).toEqual(["verbeter c", "verbeter d"]);
    expect(r.bodyMarkdown).toContain("# Inleiding");
    expect(r.bodyMarkdown).toContain("# Vervolg");
    expect(r.bodyMarkdown).not.toContain("Sterke punten");
    expect(r.bodyMarkdown).not.toContain("Grootste verbeterpunten");
    expect(r.bodyMarkdown).not.toContain("punt a");
  });

  it("retourneert cover=null als input met heading begint", () => {
    const md = "# Direct\n\nTekst.";
    const r = parseReport(md);
    expect(r.cover).toBeNull();
    expect(r.bodyMarkdown).toContain("# Direct");
  });

  it("retourneert score=null als geen score in cover staat", () => {
    const md = "Cover-tekst zonder cijfer.\n\n# Body\n\nTekst.";
    const r = parseReport(md);
    expect(r.cover?.score).toBeNull();
    expect(r.cover?.raw).toContain("Cover-tekst zonder cijfer");
  });

  it("zet beide naar null als alleen strengths gevonden", () => {
    const md = [
      "Cover.",
      "",
      "# Samenvatting",
      "",
      "## Sterke punten",
      "",
      "* alleen sterke",
    ].join("\n");
    const r = parseReport(md);
    expect(r.strengths).toBeNull();
    expect(r.improvements).toBeNull();
    expect(r.bodyMarkdown).toContain("Sterke punten");
  });

  it("zet beide naar null als alleen improvements gevonden", () => {
    const md = [
      "Cover.",
      "",
      "# Samenvatting",
      "",
      "## Grootste verbeterpunten",
      "",
      "* alleen verbeter",
    ].join("\n");
    const r = parseReport(md);
    expect(r.strengths).toBeNull();
    expect(r.improvements).toBeNull();
  });

  it("accepteert score met punt (7.4) en komma (7,4)", () => {
    const a = parseReport("Score: 7.4 / 10\n\n# Body");
    const b = parseReport("Score: 7,4 / 10\n\n# Body");
    expect(a.cover?.score).toBe("7.4");
    expect(b.cover?.score).toBe("7,4");
  });

  it("accepteert `Grootste verbeterpunten` én `Verbeterpunten`", () => {
    const a = [
      "Cover.", "",
      "# S", "",
      "## Sterke punten", "",
      "* x", "",
      "## Verbeterpunten", "",
      "* y",
    ].join("\n");
    const r = parseReport(a);
    expect(r.strengths).toEqual(["x"]);
    expect(r.improvements).toEqual(["y"]);
  });

  it("lege input → alles null en body=''", () => {
    const r = parseReport("");
    expect(r.cover).toBeNull();
    expect(r.strengths).toBeNull();
    expect(r.improvements).toBeNull();
    expect(r.bodyMarkdown).toBe("");
  });
});

import { parseSamenvatting, slugify } from "./parseReport";

describe("parseSamenvatting", () => {
  it("trekt de tekst onder '# Samenvatting' tot de volgende kop", () => {
    const md = [
      "# Inleiding", "", "Intro.", "",
      "# Samenvatting", "", "Sterk is X.", "Zwak is Y.", "",
      "# Scores in één oogopslag", "", "| a | b |",
    ].join("\n");
    expect(parseSamenvatting(md)).toBe("Sterk is X.\nZwak is Y.");
  });

  it("geeft null als er geen samenvatting is", () => {
    expect(parseSamenvatting("# Inleiding\n\nTekst.")).toBeNull();
  });
});

describe("slugify", () => {
  it("maakt een stabiele slug", () => {
    expect(slugify("Bewijsvoering")).toBe("bewijsvoering");
    expect(slugify("CTA's (actieknoppen)")).toBe("cta-s-actieknoppen");
  });
});

import { parseOnderdelen } from "./parseReport";

describe("parseOnderdelen", () => {
  const md = [
    "# Beoordeling per onderdeel", "",
    "### 1. Waardepropositie — 6,5 / 10", "",
    "#### Wat we zien", "", "De site opent met een belofte.", "Vol vaktaal.", "",
    "#### Waarom dit telt", "", "De bezoeker beslist snel.", "",
    "#### Wat je kunt doen", "", "* Zet de winst voorop.", "* Leg vaktermen uit.", "",
    "### 5. Bewijsvoering — 4,0 / 10", "",
    "#### Wat we zien", "", "Eén aanbeveling.", "",
    "#### Waarom dit telt", "", "Bewijs overtuigt.", "",
    "#### Wat je kunt doen", "", "* Toon logo's.", "",
    "# De vijf belangrijkste acties", "",
  ].join("\n");

  it("parset kop, score, slug en de drie subblokken", () => {
    const r = parseOnderdelen(md);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      nr: 1,
      titel: "Waardepropositie",
      slug: "waardepropositie",
      score: 6.5,
      watWeZien: "De site opent met een belofte. Vol vaktaal.",
      waaromDitTelt: "De bezoeker beslist snel.",
      watJeKuntDoen: ["Zet de winst voorop.", "Leg vaktermen uit."],
    });
    expect(r[1]).toMatchObject({ nr: 5, slug: "bewijsvoering", score: 4 });
  });

  it("stopt een onderdeel bij de volgende H1 (acties-sectie lekt niet in)", () => {
    const r = parseOnderdelen(md);
    expect(r[1].watJeKuntDoen).toEqual(["Toon logo's."]);
  });

  it("geeft lege lijst bij format-drift (geen onderdeel-koppen)", () => {
    expect(parseOnderdelen("# Iets\n\nGewone tekst.")).toEqual([]);
  });
});

import { parseActies } from "./parseReport";

describe("parseActies", () => {
  const md = [
    "# De vijf belangrijkste acties", "",
    "| Actie | Impact | Waarom dit helpt |",
    "| --- | --- | --- |",
    "| **Voeg klantcases toe** | **hoog** | Een verhaal overtuigt. |",
    "| **Toon meer bewijs** | **middel** | Bewijs van anderen. |",
    "",
    "# Tot slot",
  ].join("\n");

  it("parset titel en impact uit de tabel", () => {
    const r = parseActies(md);
    expect(r).toEqual([
      { titel: "Voeg klantcases toe", impact: "hoog" },
      { titel: "Toon meer bewijs", impact: "middel" },
    ]);
  });

  it("geeft lege lijst als er geen acties-tabel is", () => {
    expect(parseActies("# Iets\n\nGeen tabel.")).toEqual([]);
  });
});

describe("parseReport — nieuwe velden", () => {
  const md = [
    "Cover met Totaalscore: 4,9 / 10", "",
    "# Samenvatting", "", "Kort en krachtig.", "",
    "# Beoordeling per onderdeel", "",
    "### 5. Bewijsvoering — 4,0 / 10", "",
    "#### Wat we zien", "", "Eén aanbeveling.", "",
    "#### Waarom dit telt", "", "Bewijs overtuigt.", "",
    "#### Wat je kunt doen", "", "* Toon logo's.", "",
    "# De vijf belangrijkste acties", "",
    "| Actie | Impact | Waarom |",
    "| --- | --- | --- |",
    "| **Toon bewijs** | **hoog** | x |",
  ].join("\n");

  it("vult samenvatting, onderdelen en acties", () => {
    const r = parseReport(md);
    expect(r.samenvatting).toBe("Kort en krachtig.");
    expect(r.onderdelen).toHaveLength(1);
    expect(r.onderdelen[0].slug).toBe("bewijsvoering");
    expect(r.acties).toEqual([{ titel: "Toon bewijs", impact: "hoog" }]);
  });

  it("lege input → onderdelen/acties leeg, samenvatting null", () => {
    const r = parseReport("");
    expect(r.onderdelen).toEqual([]);
    expect(r.acties).toEqual([]);
    expect(r.samenvatting).toBeNull();
  });
});
