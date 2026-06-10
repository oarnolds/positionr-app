import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveModuleLayout,
  resetModuleLayout,
  restoreModuleLayout,
  getModuleLayoutHistory,
} from "./layout-actions";

// Drizzle-DB volledig mocken. We testen de business-logica
// (validatie, history-insert, prune-naar-5), niet de queries zelf.
const dbMock = vi.hoisted(() => ({
  moduleRows: [{ slug: "website-check" }],
  historyRows: [] as Array<{
    id: string;
    layoutConfig: unknown;
    savedAt: Date;
    note: string | null;
  }>,
  // Operatie-logs voor assertions
  updates: [] as unknown[],
  inserts: [] as unknown[],
  deletes: 0,
}));

vi.mock("@/lib/db/client", () => {
  // Routering op basis van de gevraagde select-kolommen:
  //   {slug} → modules-check     (ensureModuleExists)
  //   alles anders → history     (pruneHistory, restoreModuleLayout, getModuleLayoutHistory)
  function makeSelectChain(returnRows: unknown[]) {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = async () => returnRows;
    return chain;
  }
  function makeUpdateChain() {
    return {
      set: (vals: unknown) => {
        dbMock.updates.push(vals);
        return { where: async () => undefined };
      },
    };
  }
  function makeInsertChain() {
    return {
      values: async (vals: unknown) => {
        dbMock.inserts.push(vals);
      },
    };
  }
  function makeDeleteChain() {
    return {
      where: async () => {
        dbMock.deletes++;
      },
    };
  }

  return {
    db: {
      select: (cols?: Record<string, unknown>) => {
        const keys = cols ? Object.keys(cols) : [];
        const isModuleCheck = keys.length === 1 && keys[0] === "slug";
        return makeSelectChain(isModuleCheck ? dbMock.moduleRows : dbMock.historyRows);
      },
      update: () => makeUpdateChain(),
      insert: () => makeInsertChain(),
      delete: () => makeDeleteChain(),
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
  }),
}));

beforeEach(() => {
  dbMock.updates.length = 0;
  dbMock.inserts.length = 0;
  dbMock.deletes = 0;
  dbMock.historyRows = [];
  dbMock.moduleRows = [{ slug: "website-check" }];
});

const VALID_CONFIG = {
  version: 1 as const,
  items: [
    {
      kind: "section" as const,
      id: "score-banner",
      title: null,
      intro: null,
      visible: true,
    },
  ],
};

describe("saveModuleLayout", () => {
  it("valideert config, update modules.layout_config en voegt history-rij toe", async () => {
    await saveModuleLayout("website-check", VALID_CONFIG, "test save");
    expect(dbMock.updates).toHaveLength(1);
    expect(dbMock.inserts).toHaveLength(1);
  });

  it("gooit bij ongeldige config (version != 1)", async () => {
    await expect(
      saveModuleLayout(
        "website-check",
        { version: 2, items: [] } as never,
        null,
      ),
    ).rejects.toThrow();
  });
});

describe("resetModuleLayout", () => {
  it("zet layout_config op NULL en voegt geen history-rij toe", async () => {
    await resetModuleLayout("website-check");
    expect(dbMock.updates).toHaveLength(1);
    expect(dbMock.inserts).toHaveLength(0);
  });
});

describe("restoreModuleLayout", () => {
  it("maakt een nieuwe save met de oude config + note", async () => {
    dbMock.historyRows = [
      {
        id: "11111111-2222-3333-4444-555555555555",
        layoutConfig: VALID_CONFIG,
        savedAt: new Date(),
        note: null,
      },
    ];
    await restoreModuleLayout("website-check", "11111111-2222-3333-4444-555555555555");
    expect(dbMock.updates).toHaveLength(1);
    expect(dbMock.inserts).toHaveLength(1);
    // note moet "Hersteld" bevatten
    const insertedNote = (dbMock.inserts[0] as { note?: string }).note;
    expect(insertedNote).toMatch(/Hersteld/);
  });
});

describe("getModuleLayoutHistory", () => {
  it("returnt parsed entries (laatste N)", async () => {
    dbMock.historyRows = Array.from({ length: 3 }, (_, i) => ({
      id: `h-${i}`,
      layoutConfig: VALID_CONFIG,
      savedAt: new Date(),
      note: null,
    }));
    const out = await getModuleLayoutHistory("website-check");
    expect(out).toHaveLength(3);
    expect(out[0].layoutConfig.version).toBe(1);
  });
});
