import { test, expect } from "vitest";
import * as XLSX from "xlsx";
import { xlsxToMarkdown } from "./xlsx-to-markdown";

/** Bouwt een echte werkmap-buffer uit array-of-arrays per sheet. */
function makeWorkbook(
  sheets: Record<string, (string | number)[][]>,
  bookType: XLSX.BookType = "xlsx",
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType }) as Buffer;
}

test("xlsxToMarkdown: één sheet wordt een markdown-tabel met kop", () => {
  const buf = makeWorkbook({
    Volgers: [
      ["Branche", "Volgers"],
      ["Maakindustrie", 120],
      ["Zorg", 45],
    ],
  });
  const md = xlsxToMarkdown(buf);
  expect(md).toContain("## Volgers");
  expect(md).toContain("| Branche | Volgers |");
  expect(md).toContain("| --- | --- |");
  expect(md).toContain("| Maakindustrie | 120 |");
  expect(md).toContain("| Zorg | 45 |");
});

test("xlsxToMarkdown: meerdere sheets komen allemaal mee (LinkedIn-export)", () => {
  const buf = makeWorkbook({
    "Follower metrics": [
      ["Branche", "Volgers"],
      ["Maak- & procesindustrie", 210],
    ],
    "Content metrics": [
      ["Datum", "Impressies"],
      ["2026-06", 3400],
    ],
  });
  const md = xlsxToMarkdown(buf);
  expect(md).toContain("## Follower metrics");
  expect(md).toContain("## Content metrics");
  expect(md).toContain("Maak- & procesindustrie");
  expect(md).toContain("3400");
});

test("xlsxToMarkdown: pipe-tekens in cellen worden ge-escaped", () => {
  const buf = makeWorkbook({
    Blad1: [
      ["Label", "Waarde"],
      ["A|B", "x"],
    ],
  });
  const md = xlsxToMarkdown(buf);
  expect(md).toContain("A\\|B");
});

test("xlsxToMarkdown: lege sheets worden overgeslagen, niet als lege tabel", () => {
  const buf = makeWorkbook({
    Leeg: [],
    Data: [
      ["k", "v"],
      ["a", 1],
    ],
  });
  const md = xlsxToMarkdown(buf);
  expect(md).not.toContain("## Leeg");
  expect(md).toContain("## Data");
});

test("xlsxToMarkdown: CSV-buffer wordt ook geparsed", () => {
  const csv = "Branche,Volgers\nMaakindustrie,120\nZorg,45\n";
  const md = xlsxToMarkdown(Buffer.from(csv, "utf8"));
  expect(md).toContain("| Branche | Volgers |");
  expect(md).toContain("| Maakindustrie | 120 |");
});

test("xlsxToMarkdown: ragged rijen worden tot kolombreedte aangevuld", () => {
  const buf = makeWorkbook({
    Blad1: [
      ["a", "b", "c"],
      ["1", "2"],
    ],
  });
  const md = xlsxToMarkdown(buf);
  // De korte rij moet toch 3 kolommen (2 pipes + rand) hebben.
  const dataRow = md.split("\n").find((l) => l.startsWith("| 1 |"));
  expect(dataRow).toBe("| 1 | 2 |  |");
});

test("xlsxToMarkdown: bestand zonder bruikbare inhoud gooit een fout", () => {
  const buf = makeWorkbook({ Leeg: [] });
  expect(() => xlsxToMarkdown(buf)).toThrow();
});
