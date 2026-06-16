import { describe, expect, it } from "vitest";
import { getFormatExample } from "./format-examples";

describe("getFormatExample", () => {
  it("returnt de markdown voor een module met een format-example.md", async () => {
    const md = await getFormatExample("website-check");
    expect(md).not.toBeNull();
    expect(md).toContain("Website Analyse");
  });

  it("returnt null als het bestand ontbreekt", async () => {
    const md = await getFormatExample("zzz-niet-bestaande-module");
    expect(md).toBeNull();
  });

  it("returnt null voor slugs die niet aan [a-z0-9-]+ voldoen", async () => {
    expect(await getFormatExample("../etc/passwd")).toBeNull();
    expect(await getFormatExample("UPPERCASE")).toBeNull();
    expect(await getFormatExample("met spatie")).toBeNull();
    expect(await getFormatExample("")).toBeNull();
  });
});
