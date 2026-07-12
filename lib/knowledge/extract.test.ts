import { test, expect } from "vitest";
import { splitIntoChapters } from "./extract";

test("splitIntoChapters: splitst op HOOFDSTUK/CHAPTER-koppen", () => {
  const text =
    "HOOFDSTUK 1\nWederkerigheid\nTekst een.\n\nHOOFDSTUK 2\nSchaarste\nTekst twee.";
  const chapters = splitIntoChapters(text);
  expect(chapters).toHaveLength(2);
  expect(chapters[0]).toContain("Wederkerigheid");
  expect(chapters[1]).toContain("Schaarste");
});

test("splitIntoChapters: zonder koppen valt terug op woordblokken", () => {
  const text = Array.from({ length: 13000 }, (_, i) => `w${i}`).join(" ");
  const chapters = splitIntoChapters(text);
  expect(chapters.length).toBeGreaterThanOrEqual(2);
});

test("splitIntoChapters: lege/witruimte-invoer geeft lege lijst", () => {
  expect(splitIntoChapters("   \n  ")).toEqual([]);
});
