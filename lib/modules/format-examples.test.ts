import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => {
  const where = vi.fn();
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
  return {
    db: {
      select,
      _mocks: { where },
    },
  };
});

import { db } from "@/lib/db/client";
import { getFormatExample } from "./format-examples";

const mocks = (db as unknown as { _mocks: { where: ReturnType<typeof vi.fn> } })._mocks;

describe("getFormatExample", () => {
  beforeEach(() => {
    mocks.where.mockReset();
  });

  it("returnt de markdown voor een module die een format_example heeft", async () => {
    mocks.where.mockResolvedValueOnce([{ formatExample: "# Test\n\nMarkdown body" }]);
    const md = await getFormatExample("website-check");
    expect(md).toBe("# Test\n\nMarkdown body");
  });

  it("returnt null als de module geen format_example heeft", async () => {
    mocks.where.mockResolvedValueOnce([{ formatExample: null }]);
    const md = await getFormatExample("zzz");
    expect(md).toBeNull();
  });

  it("returnt null als de module niet bestaat", async () => {
    mocks.where.mockResolvedValueOnce([]);
    const md = await getFormatExample("niet-bestaand");
    expect(md).toBeNull();
  });

  it("returnt null voor slugs die niet aan [a-z0-9-]+ voldoen", async () => {
    expect(await getFormatExample("../etc/passwd")).toBeNull();
    expect(await getFormatExample("UPPERCASE")).toBeNull();
    expect(await getFormatExample("met spatie")).toBeNull();
    expect(await getFormatExample("")).toBeNull();
  });
});
