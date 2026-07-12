import { test, expect } from "vitest";
import { parseCardDrafts, KnowledgeCardDraftSchema } from "./schema";

test("KnowledgeCardDraftSchema: vult defaults en trimt", () => {
  const card = KnowledgeCardDraftSchema.parse({
    title: "  Sociale bewijskracht ",
    kern: "Mensen kijken naar anderen.",
  });
  expect(card.title).toBe("Sociale bewijskracht");
  expect(card.toepassing).toBe("");
  expect(card.tags).toEqual([]);
});

test("parseCardDrafts: pakt geldige kaarten, negeert ongeldige", () => {
  const raw = JSON.stringify([
    { title: "A", kern: "kern A", toepassing: "doe A", tags: ["x"] },
    { title: "", kern: "geen titel" },
    { kern: "geen titel-veld" },
  ]);
  const cards = parseCardDrafts(raw);
  expect(cards).toHaveLength(1);
  expect(cards[0].title).toBe("A");
  expect(cards[0].tags).toEqual(["x"]);
});

test("parseCardDrafts: JSON in ```-fences wordt ook geparsed", () => {
  const raw = "```json\n[{\"title\":\"B\",\"kern\":\"kern B\"}]\n```";
  const cards = parseCardDrafts(raw);
  expect(cards).toHaveLength(1);
  expect(cards[0].title).toBe("B");
});
