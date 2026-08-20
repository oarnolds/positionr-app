import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContent, getContentBatch } from "./get";

// Mock db. Voor getContent: returnt dbMock.rows via
// select().from().where().limit(). Voor getContentBatch idem via
// select().from().where() (zonder limit — direct awaitable).
const dbMock = vi.hoisted(() => ({
  rows: [] as Array<{ key?: string; value: string }>,
}));

vi.mock("@/lib/db/client", () => {
  function makeChain() {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = async () => dbMock.rows;
    // await direct op .where(...) voor de batch-query (geen .limit)
    // Drizzle's where() returnt normaal een awaitable Query;
    // hier maken we 'm 'then'-baar.
    chain.then = (
      resolve: (r: unknown) => void,
      reject?: (e: unknown) => void,
    ) => {
      try {
        resolve(dbMock.rows);
      } catch (e) {
        reject?.(e);
      }
    };
    return chain;
  }
  return {
    db: {
      select: () => makeChain(),
    },
  };
});

beforeEach(() => {
  dbMock.rows = [];
});

describe("getContent", () => {
  it("returnt DB-waarde bij hit", async () => {
    dbMock.rows = [{ value: "Custom titel uit DB" }];
    const v = await getContent("homepage.hero.title");
    expect(v).toBe("Custom titel uit DB");
  });

  it("valt terug op default bij DB-miss", async () => {
    dbMock.rows = [];
    const v = await getContent("homepage.hero.title");
    expect(v).toBe("De second opinion voor je marketingbeslissingen.");
  });
});

describe("getContentBatch", () => {
  it("returnt map met DB-waarden gemengd met defaults", async () => {
    dbMock.rows = [{ key: "homepage.hero.title", value: "Overschreven" }];
    const map = await getContentBatch([
      "homepage.hero.title",
      "homepage.hero.subtitle",
    ]);
    expect(map["homepage.hero.title"]).toBe("Overschreven");
    expect(map["homepage.hero.subtitle"]).toContain("Wat een bureau");
  });

  it("returnt lege map bij lege keys-array", async () => {
    const map = await getContentBatch([]);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("val terug op default voor alle keys als DB leeg", async () => {
    dbMock.rows = [];
    const map = await getContentBatch([
      "homepage.hero.title",
      "homepage.painpoints.q.1",
    ]);
    expect(map["homepage.hero.title"]).toBe(
      "De second opinion voor je marketingbeslissingen.",
    );
    expect(map["homepage.painpoints.q.1"]).toBe(
      "Bereiken we de juiste doelgroep?",
    );
  });
});
