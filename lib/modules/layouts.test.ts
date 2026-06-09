import { describe, it, expect, vi, beforeEach } from "vitest";
import { defaultLayoutFor, getModuleLayout } from "./layouts";

// Mock de db-laag — we testen niet de Drizzle-queries zelf, alleen
// de fallback-logica van getModuleLayout.
const dbMock = vi.hoisted(() => ({ rows: [] as Array<{ layoutConfig: unknown }> }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => dbMock.rows,
        }),
      }),
    }),
  },
}));

beforeEach(() => {
  dbMock.rows = [];
});

describe("defaultLayoutFor", () => {
  it("bouwt een config met alle 7 secties zichtbaar, in registry-volgorde", () => {
    const cfg = defaultLayoutFor("website-check");
    expect(cfg.version).toBe(1);
    expect(cfg.items).toHaveLength(7);
    expect(cfg.items.map((i) => (i.kind === "section" ? i.id : null))).toEqual([
      "score-banner",
      "executive-summary",
      "onderdelen-grid",
      "sterke-punten",
      "verbeterpunten",
      "top-acties",
      "aanvullende-info",
    ]);
    expect(
      cfg.items.every((i) => i.kind === "section" && i.visible),
    ).toBe(true);
  });

  it("gooit een Error voor een onbekende module-slug", () => {
    expect(() => defaultLayoutFor("onbekend")).toThrow();
  });
});

describe("getModuleLayout", () => {
  it("returnt default als layoutConfig in DB null is", async () => {
    dbMock.rows = [{ layoutConfig: null }];
    const cfg = await getModuleLayout("website-check");
    expect(cfg.items).toHaveLength(7);
  });

  it("returnt parsed config als layoutConfig valide is", async () => {
    const custom = {
      version: 1,
      items: [
        {
          kind: "section",
          id: "score-banner",
          title: "Score!",
          intro: null,
          visible: true,
        },
      ],
    };
    dbMock.rows = [{ layoutConfig: custom }];
    const cfg = await getModuleLayout("website-check");
    expect(cfg.items).toHaveLength(1);
    expect(cfg.items[0]).toMatchObject({ id: "score-banner", title: "Score!" });
  });

  it("returnt default bij corrupt JSON in DB", async () => {
    dbMock.rows = [
      { layoutConfig: { version: 1, items: [{ kind: "alien" }] } },
    ];
    const cfg = await getModuleLayout("website-check");
    expect(cfg.items).toHaveLength(7); // fallback
  });

  it("gooit Error als module niet in DB staat", async () => {
    dbMock.rows = [];
    await expect(getModuleLayout("website-check")).rejects.toThrow(/niet in DB/);
  });
});
