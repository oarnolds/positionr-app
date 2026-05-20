import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock vóór de import van de unit-under-test zodat de db-import binnen
// prompts.ts onze stub krijgt i.p.v. de echte client.
const limitMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: limitMock }),
      }),
    }),
  },
}));

import { substitutePlaceholders, getModulePrompt } from "./prompts";

function setMockRows(rows: Array<{ defaultPrompt: string; provider: string }>) {
  limitMock.mockResolvedValueOnce(rows);
}

describe("substitutePlaceholders", () => {
  it("vervangt bekende variabelen", () => {
    expect(substitutePlaceholders("Hi {name}", { name: "Olivier" })).toBe(
      "Hi Olivier",
    );
  });

  it("vervangt meerdere keren dezelfde variabele", () => {
    expect(
      substitutePlaceholders("{a} en {a} en {b}", { a: "A", b: "B" }),
    ).toBe("A en A en B");
  });

  it("laat onbekende variabelen als literal {naam} staan", () => {
    expect(substitutePlaceholders("Hi {unknown}", { name: "x" })).toBe(
      "Hi {unknown}",
    );
  });

  it("ondersteunt underscores en cijfers in variabele-namen", () => {
    expect(
      substitutePlaceholders("{var_1} en {snake_case}", {
        var_1: "X",
        snake_case: "Y",
      }),
    ).toBe("X en Y");
  });

  it("raakt tekst zonder placeholders niet aan", () => {
    expect(substitutePlaceholders("geen accolades hier", {})).toBe(
      "geen accolades hier",
    );
  });

  it("staat lege string-waarde toe", () => {
    expect(substitutePlaceholders("[{x}]", { x: "" })).toBe("[]");
  });
});

describe("getModulePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returnt prompt + provider uit DB als defaultPrompt gevuld is", async () => {
    setMockRows([{ defaultPrompt: "Hallo {x}", provider: "perplexity" }]);
    const result = await getModulePrompt("website-check");
    expect(result).toEqual({ prompt: "Hallo {x}", provider: "perplexity" });
  });

  it("valt terug op FALLBACK_PROMPTS als defaultPrompt leeg is", async () => {
    setMockRows([{ defaultPrompt: "", provider: "claude" }]);
    const result = await getModulePrompt("website-check");
    expect(result.prompt).toContain("Placeholder"); // SOON_PLACEHOLDER-tekst
    expect(result.provider).toBe("claude");
  });

  it("gooit error bij onbekende slug (niet in DB)", async () => {
    setMockRows([]);
    await expect(getModulePrompt("non-existent-slug")).rejects.toThrow(
      /Module non-existent-slug niet in DB/,
    );
  });

  it("gooit error als DB-veld leeg én geen fallback bestaat voor slug", async () => {
    setMockRows([{ defaultPrompt: "", provider: "claude" }]);
    await expect(getModulePrompt("totaal-onbekend")).rejects.toThrow(
      /Geen fallback prompt voor module totaal-onbekend/,
    );
  });
});
