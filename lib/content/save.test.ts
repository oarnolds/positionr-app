import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveContent, undoLast } from "./save";

const dbMock = vi.hoisted(() => ({
  historyRows: [] as Array<{
    id: string;
    key: string;
    value: string;
    savedAt: Date;
  }>,
  updates: [] as unknown[],
  inserts: [] as unknown[],
  deletes: 0,
}));

vi.mock("@/lib/db/client", () => {
  function selectChain() {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.where = () => c;
    c.orderBy = () => c;
    c.limit = async () => dbMock.historyRows;
    return c;
  }
  return {
    db: {
      select: () => selectChain(),
      insert: () => ({
        values: (v: unknown) => {
          dbMock.inserts.push(v);
          // Drizzle .values() is awaitable én kan .onConflictDoUpdate hebben.
          const awaitable: PromiseLike<undefined> & {
            onConflictDoUpdate: (opts: { set: unknown }) => Promise<undefined>;
          } = {
            then: (resolve: (r: undefined) => unknown) => {
              resolve(undefined);
              return Promise.resolve(undefined);
            },
            onConflictDoUpdate: async ({ set }: { set: unknown }) => {
              dbMock.updates.push(set);
              return undefined;
            },
          };
          return awaitable;
        },
      }),
      delete: () => ({
        where: async () => {
          dbMock.deletes++;
        },
      }),
    },
  };
});

vi.mock("./require-admin", () => ({
  requireAdmin: async () => "admin-1",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

beforeEach(() => {
  dbMock.updates.length = 0;
  dbMock.inserts.length = 0;
  dbMock.deletes = 0;
  dbMock.historyRows = [];
});

describe("saveContent", () => {
  it("insert-of-update site_content + insert history voor plain veld", async () => {
    const r = await saveContent("homepage.hero.title", "Nieuwe titel");
    expect(r.ok).toBe(true);
    expect(dbMock.updates).toHaveLength(1); // onConflictDoUpdate.set
    // Twee inserts: 1 op siteContent, 1 op siteContentHistory
    expect(dbMock.inserts.length).toBeGreaterThanOrEqual(2);
  });

  it("sanitize rich veld: strip <script>", async () => {
    const r = await saveContent(
      "homepage.faq.a.1",
      "<p>Ok</p><script>alert(1)</script>",
    );
    expect(r.ok).toBe(true);
    // Zowel de content-insert als de history-insert moeten sanitized zijn
    const values = (dbMock.inserts as Array<{ value: string }>).map(
      (r) => r.value,
    );
    for (const v of values) {
      expect(v).not.toContain("script");
    }
  });

  it("weigert onbekende key", async () => {
    const r = await saveContent("bogus.key" as never, "x");
    expect(r.ok).toBe(false);
  });

  it("trimt whitespace op plain veld", async () => {
    await saveContent("homepage.hero.title", "  spatie voor en na  ");
    const inserted = (dbMock.inserts.find(
      (r) => (r as { key?: string }).key === "homepage.hero.title",
    ) as { value: string }) ?? { value: "" };
    expect(inserted.value).toBe("spatie voor en na");
  });
});

describe("undoLast", () => {
  it("returnt error bij lege history", async () => {
    dbMock.historyRows = [];
    const r = await undoLast();
    expect(r.ok).toBe(false);
  });

  it("restore vorige value uit history + maakt nieuwe entry met note Undo", async () => {
    dbMock.historyRows = [
      {
        id: "h2",
        key: "homepage.hero.title",
        value: "Nieuwe titel",
        savedAt: new Date(2000, 1, 2),
      },
    ];
    const r = await undoLast();
    // Fallback op default (want geen 'prev' in mock)
    expect(r.ok).toBe(true);
    // saveContent is aangeroepen — er is een nieuwe history-insert met note "Undo"
    const historyInsert = dbMock.inserts.find(
      (i) => (i as { note?: string }).note === "Undo",
    );
    expect(historyInsert).toBeTruthy();
  });
});
