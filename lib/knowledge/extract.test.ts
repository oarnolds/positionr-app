import { test, expect } from "vitest";
import JSZip from "jszip";
import { splitIntoChapters, extractEpub } from "./extract";

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

async function makeEpub(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Invloed</dc:title><dc:creator>Robert Cialdini</dc:creator><dc:language>nl</dc:language></metadata><manifest><item id="c1" href="Text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="Text/c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`,
  );
  zip.file("OEBPS/Text/c1.xhtml", `<html><body><h1>Wederkerigheid</h1><p>Het oude geven en nemen.</p></body></html>`);
  zip.file("OEBPS/Text/c2.xhtml", `<html><body><h1>Schaarste</h1><p>De regel van het tekort.</p></body></html>`);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

test("extractEpub: leest metadata en hoofdstukken in spine-volgorde", async () => {
  const book = await extractEpub(await makeEpub());
  expect(book.title).toBe("Invloed");
  expect(book.author).toBe("Robert Cialdini");
  expect(book.language).toBe("nl");
  expect(book.chapters).toHaveLength(2);
  expect(book.chapters[0]).toContain("Wederkerigheid");
  expect(book.chapters[1]).toContain("De regel van het tekort");
});
