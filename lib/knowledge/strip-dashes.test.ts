import { describe, expect, it } from "vitest";
import { stripDashes } from "./strip-dashes";

describe("stripDashes", () => {
  it("vervangt een gespatieerd em-dash door een komma", () => {
    expect(stripDashes("Seth Godin — This Is Marketing")).toBe(
      "Seth Godin, This Is Marketing",
    );
    expect(stripDashes("te overtuigen — een kleine groep is genoeg")).toBe(
      "te overtuigen, een kleine groep is genoeg",
    );
  });

  it("vervangt en-dash net zo", () => {
    expect(stripDashes("a – b")).toBe("a, b");
  });

  it("laat gewone koppelstreepjes en dash-vrije tekst met rust", () => {
    expect(stripDashes("outside-in denken, low-code bouwen")).toBe(
      "outside-in denken, low-code bouwen",
    );
  });

  it("meerdere streepjes", () => {
    expect(stripDashes("een — twee — drie")).toBe("een, twee, drie");
  });

  it("ruimt dubbele komma op", () => {
    expect(stripDashes("stap 1, — stap 2")).toBe("stap 1, stap 2");
  });

  it("laat geen komma vóór een punt achter", () => {
    expect(stripDashes("dat is genoeg —.")).toBe("dat is genoeg.");
  });
});
