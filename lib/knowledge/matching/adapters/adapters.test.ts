import { describe, expect, it } from "vitest";
import { genericSections } from "./generic";
import { websiteCheckSections } from "./website-check";

describe("genericSections", () => {
  it("mapt report-secties naar MatchableSection met stabiele keys", () => {
    const out = genericSections({
      kind: "report",
      report: {
        heroTekst: "x",
        secties: [
          { titel: "Waardepropositie", accent: "blue", layout: "volledig", inhoud: "De belofte.", chips: ["a", "b"] },
          { titel: "", eyebrow: "BEWIJS", accent: "red", layout: "volledig", inhoud: "Weinig bewijs.", feiten: [{ label: "Logo's", waarde: "1" }] },
        ],
      },
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: "sectie-0", titel: "Waardepropositie" });
    expect(out[0].tekst).toContain("De belofte.");
    expect(out[0].tekst).toContain("a, b");
    expect(out[1].titel).toBe("BEWIJS");
    expect(out[1].tekst).toContain("Logo's: 1");
  });

  it("markdown-fallback → lege lijst", () => {
    expect(genericSections({ kind: "markdown", markdown: "x" })).toEqual([]);
  });
});

describe("websiteCheckSections", () => {
  it("mapt geparsete onderdelen naar secties met slug-key", () => {
    const md = [
      "### 5. Bewijsvoering — 4,0 / 10", "",
      "#### Wat we zien", "", "Eén aanbeveling.", "",
      "#### Waarom dit telt", "", "Bewijs overtuigt.", "",
      "#### Wat je kunt doen", "", "* Toon logo's.", "",
      "# De vijf belangrijkste acties",
    ].join("\n");
    const out = websiteCheckSections(md);
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("bewijsvoering");
    expect(out[0].titel).toBe("Bewijsvoering");
    expect(out[0].tekst).toContain("Eén aanbeveling.");
    expect(out[0].tekst).toContain("Toon logo's.");
  });
});
