import { describe, expect, it } from "vitest";
import { buildKnowledgeBlocks } from "./index";
import type { ApprovedCard, MatchableSection } from "./types";

const sections: MatchableSection[] = [
  { key: "bewijsvoering", titel: "Bewijs", tekst: "Weinig logo's." },
  { key: "cta", titel: "CTA", tekst: "Geen knop." },
];
const cards: ApprovedCard[] = [
  { id: "c1", title: "Sociale bewijskracht", kern: "K1", toepassing: "T1", sourceLabel: "Cialdini", themes: ["sociale-bewijskracht"] },
];

it("snapshot een gekozen kaart met rank + bridge", async () => {
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => cards,
    classify: async () => ({ bewijsvoering: ["sociale-bewijskracht"], cta: [] }),
    pick: async () => [{ sectionKey: "bewijsvoering", cardId: "c1", bridge: "Brug." }],
  });
  expect(blocks).toEqual([
    {
      sectionKey: "bewijsvoering",
      rank: 1,
      bridge: "Brug.",
      cardId: "c1",
      card: { title: "Sociale bewijskracht", kern: "K1", toepassing: "T1", sourceLabel: "Cialdini" },
    },
  ]);
});

it("geen kaarten → leeg, zonder classify/pick aan te roepen", async () => {
  let called = false;
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => [],
    classify: async () => { called = true; return {}; },
    pick: async () => [],
  });
  expect(blocks).toEqual([]);
  expect(called).toBe(false);
});

it("onbekende cardId uit pick wordt overgeslagen", async () => {
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => cards,
    classify: async () => ({ bewijsvoering: ["sociale-bewijskracht"] }),
    pick: async () => [{ sectionKey: "bewijsvoering", cardId: "onbekend", bridge: "x" }],
  });
  expect(blocks).toEqual([]);
});

it("fout in een dep → leeg (best-effort)", async () => {
  const blocks = await buildKnowledgeBlocks(sections, {
    loadApprovedCards: async () => cards,
    classify: async () => { throw new Error("boom"); },
    pick: async () => [],
  });
  expect(blocks).toEqual([]);
});
