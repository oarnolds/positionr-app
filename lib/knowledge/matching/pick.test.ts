import { describe, expect, it } from "vitest";
import { buildPickPrompt, parsePicks, MAX_BLOCKS } from "./pick";
import type { ApprovedCard, MatchableSection } from "./types";

const sections: MatchableSection[] = [
  { key: "bewijsvoering", titel: "Bewijs", tekst: "Weinig logo's." },
];
const cands = new Map<string, ApprovedCard[]>([
  ["bewijsvoering", [{ id: "c1", title: "Sociale bewijskracht", kern: "Anderen overtuigen.", toepassing: "", sourceLabel: "Cialdini", themes: ["sociale-bewijskracht"] }]],
]);

describe("buildPickPrompt", () => {
  it("bevat de sectie, de kandidaat-id en de max", () => {
    const p = buildPickPrompt(sections, cands);
    expect(p).toContain("bewijsvoering");
    expect(p).toContain("id:c1");
    expect(p).toContain(String(MAX_BLOCKS));
  });
});

describe("parsePicks", () => {
  it("parset geldige items en capt op MAX_BLOCKS", () => {
    const raw = JSON.stringify([
      { sectionKey: "a", cardId: "1", bridge: "x" },
      { sectionKey: "b", cardId: "2", bridge: "y" },
      { sectionKey: "c", cardId: "3", bridge: "z" },
      { sectionKey: "d", cardId: "4", bridge: "w" },
    ]);
    const res = parsePicks(raw);
    expect(res).toHaveLength(MAX_BLOCKS);
    expect(res[0]).toEqual({ sectionKey: "a", cardId: "1", bridge: "x" });
  });
  it("rommel/lege array → leeg", () => {
    expect(parsePicks("[]")).toEqual([]);
    expect(parsePicks("geen json")).toEqual([]);
    expect(parsePicks('[{"sectionKey":"a"}]')).toEqual([]); // incompleet item
  });
});
