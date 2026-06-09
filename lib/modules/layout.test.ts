import { describe, it, expect } from "vitest";
import { LayoutConfig } from "./layout";

describe("LayoutConfig", () => {
  it("accepteert een config met alleen section-items", () => {
    const ok = {
      version: 1,
      items: [
        {
          kind: "section",
          id: "score-banner",
          title: null,
          intro: null,
          visible: true,
        },
      ],
    };
    expect(LayoutConfig.safeParse(ok).success).toBe(true);
  });

  it("accepteert een config met gemengde section + block-items", () => {
    const ok = {
      version: 1,
      items: [
        {
          kind: "section",
          id: "score-banner",
          title: "Score",
          intro: "Intro-tekst",
          visible: true,
        },
        { kind: "block", id: "blk-1", markdown: "# Header\n\nTekst." },
        {
          kind: "section",
          id: "top-acties",
          title: null,
          intro: null,
          visible: false,
        },
      ],
    };
    expect(LayoutConfig.safeParse(ok).success).toBe(true);
  });

  it("weigert een onbekend kind", () => {
    const bad = {
      version: 1,
      items: [{ kind: "header", id: "x" }],
    };
    expect(LayoutConfig.safeParse(bad).success).toBe(false);
  });

  it("weigert een section zonder visible-veld", () => {
    const bad = {
      version: 1,
      items: [{ kind: "section", id: "score-banner", title: null, intro: null }],
    };
    expect(LayoutConfig.safeParse(bad).success).toBe(false);
  });

  it("weigert version != 1", () => {
    const bad = { version: 2, items: [] };
    expect(LayoutConfig.safeParse(bad).success).toBe(false);
  });

  it("accepteert lege items-array (fallback in runtime)", () => {
    expect(LayoutConfig.safeParse({ version: 1, items: [] }).success).toBe(true);
  });
});
