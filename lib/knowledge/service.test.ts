import { test, expect, vi } from "vitest";
import { runDistillation, type DistillDeps } from "./service";

function makeDeps(overrides: Partial<DistillDeps> = {}): DistillDeps {
  return {
    loadSource: vi.fn(async () => ({
      id: "s1",
      chapters: ["hfst A", "hfst B", "hfst C"],
      chaptersDone: 1,
      chaptersTotal: 3,
      author: "Cialdini",
      title: "Invloed",
      language: "nl",
    })),
    distillChapter: vi.fn(async () => [
      { title: "P", kern: "k", toepassing: "t", tags: ["x"] },
    ]),
    insertCards: vi.fn(async () => undefined),
    updateSource: vi.fn(async () => undefined),
    loadCandidateCards: vi.fn(async () => [
      { title: "A", kern: "k", toepassing: "t", tags: [] },
      { title: "A2", kern: "k", toepassing: "t", tags: [] },
    ]),
    consolidate: vi.fn(async () => [{ title: "A", kern: "k", toepassing: "t", tags: [] }]),
    replaceCards: vi.fn(async () => undefined),
    nowMs: () => 0,
    budgetMs: 240_000,
    ...overrides,
  };
}

test("runDistillation: distilleert resterende hoofdstukken, consolideert, en zet status done", async () => {
  const deps = makeDeps();
  await runDistillation("s1", deps);
  expect(deps.distillChapter).toHaveBeenCalledTimes(2);
  expect(deps.consolidate).toHaveBeenCalledTimes(1);
  expect(deps.replaceCards).toHaveBeenCalledTimes(1);
  expect(deps.updateSource).toHaveBeenLastCalledWith("s1", {
    chaptersDone: 3,
    status: "done",
  });
});

test("runDistillation: stopt binnen budget vóór consolidatie, status blijft distilling", async () => {
  let t = 0;
  const deps = makeDeps({ nowMs: () => (t += 300_000), budgetMs: 240_000 });
  await runDistillation("s1", deps);
  expect(deps.distillChapter).toHaveBeenCalledTimes(1);
  expect(deps.consolidate).not.toHaveBeenCalled();
  expect(deps.updateSource).toHaveBeenLastCalledWith("s1", {
    chaptersDone: 2,
    status: "distilling",
  });
});

test("runDistillation: hervat en consolideert als alle hoofdstukken al gedistilleerd zijn", async () => {
  const deps = makeDeps({
    loadSource: vi.fn(async () => ({
      id: "s1",
      chapters: ["hfst A", "hfst B", "hfst C"],
      chaptersDone: 3,
      chaptersTotal: 3,
      author: "Cialdini",
      title: "Invloed",
      language: "nl",
    })),
  });
  await runDistillation("s1", deps);
  expect(deps.distillChapter).not.toHaveBeenCalled();
  expect(deps.consolidate).toHaveBeenCalledTimes(1);
  expect(deps.replaceCards).toHaveBeenCalledTimes(1);
  expect(deps.updateSource).toHaveBeenLastCalledWith("s1", {
    chaptersDone: 3,
    status: "done",
  });
});
