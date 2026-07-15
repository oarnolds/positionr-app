import { describe, expect, it } from "vitest";
import { buildClassifyPrompt, parseClassify } from "./classify";

describe("buildClassifyPrompt", () => {
  it("bevat de sectie-keys, titels en taxonomie", () => {
    const p = buildClassifyPrompt([{ key: "sectie-0", titel: "Bewijs", tekst: "Weinig logo's." }]);
    expect(p).toContain("sectie-0");
    expect(p).toContain("Bewijs");
    expect(p).toContain("sociale-bewijskracht"); // taxonomie
  });
});

describe("parseClassify", () => {
  it("mapt keys op geldige thema-slugs", () => {
    const raw = '{"sectie-0":["bewijsvoering","onzin"],"sectie-1":["cta-conversie"]}';
    expect(parseClassify(raw, ["sectie-0", "sectie-1"])).toEqual({
      "sectie-0": ["bewijsvoering"],
      "sectie-1": ["cta-conversie"],
    });
  });
  it("onbekende keys en rommel worden genegeerd", () => {
    expect(parseClassify("geen json", ["sectie-0"])).toEqual({});
    expect(parseClassify('{"x":["bewijsvoering"]}', ["sectie-0"])).toEqual({});
  });
});
