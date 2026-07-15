import { describe, expect, it } from "vitest";
import { prefilter } from "./prefilter";
import type { ApprovedCard } from "./types";

const card = (id: string, themes: string[]): ApprovedCard => ({
  id, title: id, kern: "", toepassing: "", sourceLabel: "", themes,
});

describe("prefilter", () => {
  const cards = [
    card("a", ["bewijsvoering", "sociale-bewijskracht"]),
    card("b", ["cta-conversie"]),
    card("c", ["waardepropositie"]),
  ];

  it("houdt per sectie de kaarten met thema-overlap", () => {
    const res = prefilter(
      { "sectie-0": ["bewijsvoering"], "sectie-1": ["cta-conversie", "waardepropositie"] },
      cards,
    );
    expect(res.get("sectie-0")?.map((c) => c.id)).toEqual(["a"]);
    expect(res.get("sectie-1")?.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("secties zonder overlap komen niet in de map", () => {
    const res = prefilter({ "sectie-0": ["schaarste-urgentie"] }, cards);
    expect(res.has("sectie-0")).toBe(false);
  });

  it("lege thema's → geen kandidaten", () => {
    const res = prefilter({ "sectie-0": [] }, cards);
    expect(res.has("sectie-0")).toBe(false);
  });
});
