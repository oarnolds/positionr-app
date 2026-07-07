import * as XLSX from "xlsx";

// Converteert een spreadsheet (xlsx/xls/csv) naar markdown-tabellen — één
// tabel per sheet, met de sheetnaam als H2-kop. Bedoeld voor tabulaire
// exports zoals LinkedIn Analytics (volgers per branche, impressies per
// post). Deterministisch en gratis: geen LLM-call nodig, net als docx.

/** Maakt een cel-waarde markdown-tabel-veilig. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

/** Rendert één sheet (array-of-arrays) naar een markdown-tabel, of null als leeg. */
function sheetToTable(name: string, rows: unknown[][]): string | null {
  const nonEmpty = rows.filter((r) =>
    r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""),
  );
  if (nonEmpty.length === 0) return null;

  const width = Math.max(...nonEmpty.map((r) => r.length));
  const pad = (r: unknown[]) =>
    Array.from({ length: width }, (_, i) => cell(r[i]));

  const [header, ...body] = nonEmpty;
  const lines = [
    `## ${name}`,
    "",
    `| ${pad(header).join(" | ")} |`,
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map((r) => `| ${pad(r).join(" | ")} |`),
  ];
  return lines.join("\n");
}

/**
 * Parse een spreadsheet-buffer naar markdown. Werkt voor xlsx, xls en csv
 * (XLSX.read detecteert het formaat). Gooit een fout als er geen enkele
 * bruikbare rij in staat, zodat de caller de Storage-upload kan terugdraaien.
 */
export function xlsxToMarkdown(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer" });

  const tables: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    const table = sheetToTable(name, rows);
    if (table) tables.push(table);
  }

  if (tables.length === 0) {
    throw new Error("Spreadsheet bevat geen bruikbare gegevens");
  }
  return tables.join("\n\n");
}
