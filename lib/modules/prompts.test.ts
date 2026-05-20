import { describe, it, expect } from "vitest";
import { substitutePlaceholders } from "./prompts";

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
