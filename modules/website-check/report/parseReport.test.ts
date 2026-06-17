import { describe, expect, it } from "vitest";
import { parseReport } from "./parseReport";

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
