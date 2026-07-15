import { describe, expect, it } from "vitest";
import { buildThemeSuggestionPrompt, parseThemeSlugs } from "./themes";

describe("buildThemeSuggestionPrompt", () => {
  it("bevat de kaart-inhoud en de taxonomie-slugs", () => {
    const p = buildThemeSuggestionPrompt({
      title: "Sociale bewijskracht",
      kern: "Mensen kijken naar wat anderen doen.",
      tags: ["bewijs", "vertrouwen"],
    });
    expect(p).toContain("Sociale bewijskracht");
    expect(p).toContain("Mensen kijken naar wat anderen doen.");
    expect(p).toContain("sociale-bewijskracht"); // taxonomie-optie
    expect(p).toContain("bewijs, vertrouwen"); // vrije tags meegegeven
  });
});

describe("parseThemeSlugs", () => {
  it("parset een JSON-array en houdt alleen geldige slugs", () => {
    expect(parseThemeSlugs('["bewijsvoering","sociale-bewijskracht","onzin"]'))
      .toEqual(["bewijsvoering", "sociale-bewijskracht"]);
  });
  it("werkt door markdown-fences heen", () => {
    expect(parseThemeSlugs('```json\n["cta-conversie"]\n```')).toEqual(["cta-conversie"]);
  });
  it("rommelige/lege output → lege lijst", () => {
    expect(parseThemeSlugs("geen array hier")).toEqual([]);
    expect(parseThemeSlugs("")).toEqual([]);
  });
});
