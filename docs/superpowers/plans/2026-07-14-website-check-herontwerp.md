# Website-check output-herontwerp (parser-route) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Website-check rendert de 11 onderdelen als gestructureerde score-kaarten (hero-ring, scores-overzicht, onderdeel-kaarten, acties) i.p.v. een muur markdown, met terugval op de huidige markdown-render bij oude/onparsbare output.

**Architecture:** De generatie blijft ongewijzigd (admin-prompt + format-template → markdown via Claude/Perplexity/both). We breiden de pure functie `parseReport` uit zodat ze de onderdelen, samenvatting en acties uit die markdown trekt (betrouwbaar omdat de format-template de koppen deterministisch vastlegt). Een herontworpen `WebsiteCheckReport`-component rendert uit dat model; is er niets te parsen, dan valt het terug op de bestaande document-render.

**Tech Stack:** TypeScript, React 19 (Server Components), Tailwind 4, Vitest (node-env; geen React-testing-library, dus de parser wordt TDD'd en de renderer via de browser-preview geverifieerd).

**Spec:** `docs/superpowers/specs/2026-07-14-kennisblokjes-subsysteem-2-design.md` (sectie "Website-check output-herontwerp (parser-route)").

**Scope:** Alleen de website-check-renderer + parser. De matching/kennisblokjes zitten in plan 2. Deze wijziging raakt óók de deel-pagina (`/r/…`) en de gratis-check, want die renderen via hetzelfde `WebsiteCheckReport`-component — dat is gewenst (mooiere layout overal; kennisblokjes komen daar in plan 2 bewust niet).

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid | Actie |
| --- | --- | --- |
| `modules/website-check/report/parseReport.ts` | Markdown → `ReportBlocks` (+ `onderdelen`, `samenvatting`, `acties`) | Uitbreiden |
| `modules/website-check/report/parseReport.test.ts` | Parser-tests | Uitbreiden |
| `lib/modules/score.ts` | `scoreBand(score)` — kleurband per score | Nieuw |
| `lib/modules/score.test.ts` | Test voor `scoreBand` | Nieuw |
| `modules/website-check/report/ScoreRing.tsx` | Hero-score-ring | Nieuw |
| `modules/website-check/report/ScoresOverview.tsx` | Balken-overzicht | Nieuw |
| `modules/website-check/report/OnderdeelCard.tsx` | Onderdeel-kaart (badge + 3 subblokken) | Nieuw |
| `modules/website-check/report/ActiesCard.tsx` | Acties-lijst met impact-badges | Nieuw |
| `modules/website-check/report/WebsiteCheckReport.tsx` | Structured render + fallback-branch | Herschrijven |

---

## Task 1: Parser-typen + `samenvatting`-extractie

**Files:**
- Modify: `modules/website-check/report/parseReport.ts`
- Test: `modules/website-check/report/parseReport.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `parseReport.test.ts` (binnen het bestaande `describe`-blok):

```ts
import { parseSamenvatting, slugify } from "./parseReport";

describe("parseSamenvatting", () => {
  it("trekt de tekst onder '# Samenvatting' tot de volgende kop", () => {
    const md = [
      "# Inleiding", "", "Intro.", "",
      "# Samenvatting", "", "Sterk is X.", "Zwak is Y.", "",
      "# Scores in één oogopslag", "", "| a | b |",
    ].join("\n");
    expect(parseSamenvatting(md)).toBe("Sterk is X.\nZwak is Y.");
  });

  it("geeft null als er geen samenvatting is", () => {
    expect(parseSamenvatting("# Inleiding\n\nTekst.")).toBeNull();
  });
});

describe("slugify", () => {
  it("maakt een stabiele slug", () => {
    expect(slugify("Bewijsvoering")).toBe("bewijsvoering");
    expect(slugify("CTA's (actieknoppen)")).toBe("cta-s-actieknoppen");
  });
});
```

- [ ] **Step 2: Run de test — verwacht FAIL**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: FAIL — "parseSamenvatting is not a function" / "slugify is not a function".

- [ ] **Step 3: Implementeer `slugify` + `parseSamenvatting`**

Voeg boven aan `parseReport.ts` toe (na de bestaande `import`/type-regels, vóór `parseReport`):

```ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseSamenvatting(markdown: string): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^#\s+Samenvatting\s*$/i.test(l));
  if (start === -1) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  const text = out.join("\n").trim();
  return text || null;
}
```

- [ ] **Step 4: Run de test — verwacht PASS**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: PASS (bestaande tests blijven ook groen).

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/report/parseReport.ts modules/website-check/report/parseReport.test.ts
git commit -m "feat(website-check): parse samenvatting + slugify-helper"
```

---

## Task 2: `parseOnderdelen` — de 11 onderdelen

**Files:**
- Modify: `modules/website-check/report/parseReport.ts`
- Test: `modules/website-check/report/parseReport.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `parseReport.test.ts`:

```ts
import { parseOnderdelen } from "./parseReport";

describe("parseOnderdelen", () => {
  const md = [
    "# Beoordeling per onderdeel", "",
    "### 1. Waardepropositie — 6,5 / 10", "",
    "#### Wat we zien", "", "De site opent met een belofte.", "Vol vaktaal.", "",
    "#### Waarom dit telt", "", "De bezoeker beslist snel.", "",
    "#### Wat je kunt doen", "", "* Zet de winst voorop.", "* Leg vaktermen uit.", "",
    "### 5. Bewijsvoering — 4,0 / 10", "",
    "#### Wat we zien", "", "Eén aanbeveling.", "",
    "#### Waarom dit telt", "", "Bewijs overtuigt.", "",
    "#### Wat je kunt doen", "", "* Toon logo's.", "",
    "# De vijf belangrijkste acties", "",
  ].join("\n");

  it("parset kop, score, slug en de drie subblokken", () => {
    const r = parseOnderdelen(md);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      nr: 1,
      titel: "Waardepropositie",
      slug: "waardepropositie",
      score: 6.5,
      watWeZien: "De site opent met een belofte. Vol vaktaal.",
      waaromDitTelt: "De bezoeker beslist snel.",
      watJeKuntDoen: ["Zet de winst voorop.", "Leg vaktermen uit."],
    });
    expect(r[1]).toMatchObject({ nr: 5, slug: "bewijsvoering", score: 4 });
  });

  it("stopt een onderdeel bij de volgende H1 (acties-sectie lekt niet in)", () => {
    const r = parseOnderdelen(md);
    expect(r[1].watJeKuntDoen).toEqual(["Toon logo's."]);
  });

  it("geeft lege lijst bij format-drift (geen onderdeel-koppen)", () => {
    expect(parseOnderdelen("# Iets\n\nGewone tekst.")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run de test — verwacht FAIL**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: FAIL — "parseOnderdelen is not a function".

- [ ] **Step 3: Implementeer `parseOnderdelen` + de typen**

Voeg de typen boven in `parseReport.ts` toe (bij de andere `export type`):

```ts
export type Onderdeel = {
  nr: number;
  slug: string;
  titel: string;
  score: number | null;
  watWeZien: string;
  waaromDitTelt: string;
  watJeKuntDoen: string[];
};
```

Voeg de functie toe (bij de andere helpers):

```ts
const ONDERDEEL_RE =
  /^###\s+(\d+)\.\s+(.+?)\s*[—–-]\s*(\d+(?:[.,]\d+)?)\s*\/\s*10\s*$/;

export function parseOnderdelen(markdown: string): Onderdeel[] {
  const lines = markdown.split("\n");
  const out: Onderdeel[] = [];
  let cur: Onderdeel | null = null;
  let bucket: "watWeZien" | "waaromDitTelt" | "watJeKuntDoen" | null = null;
  const push = () => {
    if (cur) out.push(cur);
  };

  for (const line of lines) {
    const head = line.match(ONDERDEEL_RE);
    if (head) {
      push();
      cur = {
        nr: Number(head[1]),
        titel: head[2].trim(),
        slug: slugify(head[2]),
        score: Number(head[3].replace(",", ".")),
        watWeZien: "",
        waaromDitTelt: "",
        watJeKuntDoen: [],
      };
      bucket = null;
      continue;
    }
    if (!cur) continue;
    // Onderdeel eindigt bij de volgende H1/H2 (bv. "# De vijf belangrijkste acties").
    if (/^#{1,2}\s/.test(line)) {
      push();
      cur = null;
      bucket = null;
      continue;
    }
    const sub = line.match(/^####\s+(.*)$/);
    if (sub) {
      const label = sub[1].toLowerCase();
      if (label.startsWith("wat we zien")) bucket = "watWeZien";
      else if (label.startsWith("waarom")) bucket = "waaromDitTelt";
      else if (label.startsWith("wat je kunt doen")) bucket = "watJeKuntDoen";
      else bucket = null;
      continue;
    }
    if (bucket === "watJeKuntDoen") {
      const b = line.match(/^[*-]\s+(.*)$/);
      if (b) cur.watJeKuntDoen.push(b[1].trim());
    } else if (bucket === "watWeZien") {
      const t = line.trim();
      if (t) cur.watWeZien = cur.watWeZien ? `${cur.watWeZien} ${t}` : t;
    } else if (bucket === "waaromDitTelt") {
      const t = line.trim();
      if (t) cur.waaromDitTelt = cur.waaromDitTelt ? `${cur.waaromDitTelt} ${t}` : t;
    }
  }
  push();
  return out;
}
```

- [ ] **Step 4: Run de test — verwacht PASS**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/report/parseReport.ts modules/website-check/report/parseReport.test.ts
git commit -m "feat(website-check): parse 11 onderdelen uit rapport-markdown"
```

---

## Task 3: `parseActies` — de acties-tabel

**Files:**
- Modify: `modules/website-check/report/parseReport.ts`
- Test: `modules/website-check/report/parseReport.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
import { parseActies } from "./parseReport";

describe("parseActies", () => {
  const md = [
    "# De vijf belangrijkste acties", "",
    "| Actie | Impact | Waarom dit helpt |",
    "| --- | --- | --- |",
    "| **Voeg klantcases toe** | **hoog** | Een verhaal overtuigt. |",
    "| **Toon meer bewijs** | **middel** | Bewijs van anderen. |",
    "",
    "# Tot slot",
  ].join("\n");

  it("parset titel en impact uit de tabel", () => {
    const r = parseActies(md);
    expect(r).toEqual([
      { titel: "Voeg klantcases toe", impact: "hoog" },
      { titel: "Toon meer bewijs", impact: "middel" },
    ]);
  });

  it("geeft lege lijst als er geen acties-tabel is", () => {
    expect(parseActies("# Iets\n\nGeen tabel.")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run de test — verwacht FAIL**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: FAIL — "parseActies is not a function".

- [ ] **Step 3: Implementeer `parseActies` + het type**

Type toevoegen (bij de andere `export type`):

```ts
export type Actie = {
  titel: string;
  impact: "hoog" | "middel" | "laag" | null;
};
```

Functie toevoegen:

```ts
export function parseActies(markdown: string): Actie[] {
  const lines = markdown.split("\n");
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (/^\s*\|/.test(l) && l.includes("actie") && l.includes("impact")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const out: Actie[] = [];
  // Data begint na de header-rij + de scheidingsrij (| --- | --- |).
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) break;
    const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const titel = cells[0].replace(/\*\*/g, "").trim();
    const impactRaw = cells[1].replace(/\*\*/g, "").toLowerCase();
    const impact: Actie["impact"] = impactRaw.includes("hoog")
      ? "hoog"
      : impactRaw.includes("middel")
        ? "middel"
        : impactRaw.includes("laag")
          ? "laag"
          : null;
    if (titel) out.push({ titel, impact });
  }
  return out;
}
```

- [ ] **Step 4: Run de test — verwacht PASS**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/report/parseReport.ts modules/website-check/report/parseReport.test.ts
git commit -m "feat(website-check): parse acties-tabel uit rapport-markdown"
```

---

## Task 4: Nieuwe velden in `ReportBlocks` + `parseReport`

**Files:**
- Modify: `modules/website-check/report/parseReport.ts`
- Test: `modules/website-check/report/parseReport.test.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
describe("parseReport — nieuwe velden", () => {
  const md = [
    "Cover met Totaalscore: 4,9 / 10", "",
    "# Samenvatting", "", "Kort en krachtig.", "",
    "# Beoordeling per onderdeel", "",
    "### 5. Bewijsvoering — 4,0 / 10", "",
    "#### Wat we zien", "", "Eén aanbeveling.", "",
    "#### Waarom dit telt", "", "Bewijs overtuigt.", "",
    "#### Wat je kunt doen", "", "* Toon logo's.", "",
    "# De vijf belangrijkste acties", "",
    "| Actie | Impact | Waarom |",
    "| --- | --- | --- |",
    "| **Toon bewijs** | **hoog** | x |",
  ].join("\n");

  it("vult samenvatting, onderdelen en acties", () => {
    const r = parseReport(md);
    expect(r.samenvatting).toBe("Kort en krachtig.");
    expect(r.onderdelen).toHaveLength(1);
    expect(r.onderdelen[0].slug).toBe("bewijsvoering");
    expect(r.acties).toEqual([{ titel: "Toon bewijs", impact: "hoog" }]);
  });

  it("lege input → onderdelen/acties leeg, samenvatting null", () => {
    const r = parseReport("");
    expect(r.onderdelen).toEqual([]);
    expect(r.acties).toEqual([]);
    expect(r.samenvatting).toBeNull();
  });
});
```

- [ ] **Step 2: Run de test — verwacht FAIL**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: FAIL — `r.samenvatting`/`r.onderdelen`/`r.acties` bestaan niet op `ReportBlocks`.

- [ ] **Step 3: Breid het `ReportBlocks`-type + de return-objecten uit**

Wijzig het `ReportBlocks`-type bovenin naar:

```ts
export type ReportBlocks = {
  cover: {
    raw: string;
    score: string | null;
  } | null;
  strengths: string[] | null;
  improvements: string[] | null;
  samenvatting: string | null;
  onderdelen: Onderdeel[];
  acties: Actie[];
  bodyMarkdown: string;
};
```

Bereken de drie waarden éénmaal bovenin `parseReport` (direct ná `export function parseReport(markdown: string): ReportBlocks {`):

```ts
  const samenvatting = parseSamenvatting(markdown);
  const onderdelen = parseOnderdelen(markdown);
  const acties = parseActies(markdown);
```

Voeg `samenvatting, onderdelen, acties` toe aan **elk** `return {...}`-object in `parseReport` (er zijn er vier: de lege-input-guard, de `firstH1 === -1`-tak, de `!(strengths && improvements)`-tak, en de slot-return). Voor de lege-input-guard gebruik je letterlijk `samenvatting: null, onderdelen: [], acties: []` (die staat vóór de berekening); de andere drie krijgen `samenvatting, onderdelen, acties`.

- [ ] **Step 4: Run alle parser-tests — verwacht PASS**

Run: `pnpm exec vitest run modules/website-check/report/parseReport.test.ts`
Expected: PASS (ook de oorspronkelijke tests uit Task 0).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: geen fouten in `modules/website-check/report/`.

- [ ] **Step 6: Commit**

```bash
git add modules/website-check/report/parseReport.ts modules/website-check/report/parseReport.test.ts
git commit -m "feat(website-check): ReportBlocks met samenvatting/onderdelen/acties"
```

---

## Task 5: `scoreBand`-util

**Files:**
- Create: `lib/modules/score.ts`
- Test: `lib/modules/score.test.ts`

- [ ] **Step 1: Schrijf de falende test**

`lib/modules/score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreBand } from "./score";

describe("scoreBand", () => {
  it("rood onder 5", () => {
    expect(scoreBand(4.9)).toBe("rood");
    expect(scoreBand(0)).toBe("rood");
  });
  it("amber 5 t/m <6,5", () => {
    expect(scoreBand(5)).toBe("amber");
    expect(scoreBand(6.4)).toBe("amber");
  });
  it("groen vanaf 6,5", () => {
    expect(scoreBand(6.5)).toBe("groen");
    expect(scoreBand(9)).toBe("groen");
  });
});
```

- [ ] **Step 2: Run de test — verwacht FAIL**

Run: `pnpm exec vitest run lib/modules/score.test.ts`
Expected: FAIL — module `./score` bestaat niet.

- [ ] **Step 3: Implementeer**

`lib/modules/score.ts`:

```ts
export type ScoreBand = "rood" | "amber" | "groen";

/** Kleurband per score: rood <5, amber 5–<6,5, groen ≥6,5. */
export function scoreBand(score: number): ScoreBand {
  if (score < 5) return "rood";
  if (score < 6.5) return "amber";
  return "groen";
}
```

- [ ] **Step 4: Run de test — verwacht PASS**

Run: `pnpm exec vitest run lib/modules/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/score.ts lib/modules/score.test.ts
git commit -m "feat(modules): scoreBand-util voor score-kleuring"
```

---

## Task 6: Presentatie-componenten

Geen unit-tests (node-env heeft geen React-testing-library); deze worden in Task 8 in de browser geverifieerd. Elke stap is één zelfstandig, puur component.

**Files:**
- Create: `modules/website-check/report/ScoreRing.tsx`
- Create: `modules/website-check/report/ScoresOverview.tsx`
- Create: `modules/website-check/report/OnderdeelCard.tsx`
- Create: `modules/website-check/report/ActiesCard.tsx`

- [ ] **Step 1: `ScoreRing.tsx`**

```tsx
export function ScoreRing({ score }: { score: number | null }) {
  const pct = score != null ? Math.max(0, Math.min(1, score / 10)) : 0;
  const deg = Math.round(pct * 360);
  return (
    <div
      className="flex h-[74px] w-[74px] flex-none items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#fff ${deg}deg, rgba(255,255,255,.25) 0)`,
      }}
    >
      <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white">
        <span className="text-xl font-extrabold leading-none">
          {score != null ? score.toString().replace(".", ",") : "—"}
        </span>
        <span className="text-[9px] opacity-80">/10</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ScoresOverview.tsx`**

```tsx
import type { Onderdeel } from "./parseReport";
import { scoreBand } from "@/lib/modules/score";

const BAR: Record<string, string> = {
  rood: "bg-rose-600",
  amber: "bg-amber-600",
  groen: "bg-green-600",
};
const TXT: Record<string, string> = {
  rood: "text-rose-700",
  amber: "text-amber-700",
  groen: "text-green-700",
};

export function ScoresOverview({ onderdelen }: { onderdelen: Onderdeel[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        📊 Scores in één oogopslag
      </p>
      <div className="space-y-2">
        {onderdelen.map((o) => {
          const band = o.score != null ? scoreBand(o.score) : "amber";
          const pct = o.score != null ? Math.round((o.score / 10) * 100) : 0;
          return (
            <div
              key={o.slug}
              className="grid grid-cols-[minmax(0,150px)_1fr_2.5rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-gray-700">
                {o.nr}. {o.titel}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-gray-100">
                <span
                  className={`block h-full rounded-full ${BAR[band]}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span
                className={`text-right font-bold tabular-nums ${
                  o.score != null ? TXT[band] : "text-gray-400"
                }`}
              >
                {o.score != null ? o.score.toString().replace(".", ",") : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `OnderdeelCard.tsx`**

```tsx
import type { Onderdeel } from "./parseReport";
import { scoreBand } from "@/lib/modules/score";

const BADGE: Record<string, string> = {
  rood: "bg-rose-600",
  amber: "bg-amber-500",
  groen: "bg-green-600",
};

export function OnderdeelCard({ onderdeel }: { onderdeel: Onderdeel }) {
  const band = onderdeel.score != null ? scoreBand(onderdeel.score) : null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`rounded-lg px-2.5 py-0.5 text-sm font-extrabold tabular-nums text-white ${
            band ? BADGE[band] : "bg-gray-400"
          }`}
        >
          {onderdeel.score != null
            ? onderdeel.score.toString().replace(".", ",")
            : "—"}
        </span>
        <h3 className="text-[15px] font-bold text-gray-900">
          {onderdeel.nr}. {onderdeel.titel}
        </h3>
      </div>
      {onderdeel.watWeZien && (
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Wat we zien
          </p>
          <p className="text-[13px] text-gray-800">{onderdeel.watWeZien}</p>
        </div>
      )}
      {onderdeel.waaromDitTelt && (
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Waarom dit telt
          </p>
          <p className="text-[13px] text-gray-800">{onderdeel.waaromDitTelt}</p>
        </div>
      )}
      {onderdeel.watJeKuntDoen.length > 0 && (
        <div className="mt-2.5 rounded-xl bg-blue-50/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Wat je kunt doen
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-gray-800">
            {onderdeel.watJeKuntDoen.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: `ActiesCard.tsx`**

```tsx
import type { Actie } from "./parseReport";

const IMP: Record<string, string> = {
  hoog: "bg-rose-100 text-rose-700",
  middel: "bg-amber-100 text-amber-700",
  laag: "bg-gray-100 text-gray-600",
};

export function ActiesCard({ acties }: { acties: Actie[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        🎯 De belangrijkste acties
      </p>
      <div className="divide-y divide-gray-100">
        {acties.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
          >
            <span className="font-semibold text-gray-900">{a.titel}</span>
            {a.impact && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${IMP[a.impact]}`}
              >
                {a.impact}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: geen fouten.

```bash
git add modules/website-check/report/ScoreRing.tsx modules/website-check/report/ScoresOverview.tsx modules/website-check/report/OnderdeelCard.tsx modules/website-check/report/ActiesCard.tsx
git commit -m "feat(website-check): score-ring, scores-overzicht, onderdeel- en acties-kaarten"
```

---

## Task 7: `WebsiteCheckReport` herschrijven (structured + fallback)

**Files:**
- Modify: `modules/website-check/report/WebsiteCheckReport.tsx`

- [ ] **Step 1: Vervang de inhoud volledig**

```tsx
import { parseReport } from "./parseReport";
import { CoverBanner } from "./CoverBanner";
import { StrengthsImprovements } from "./StrengthsImprovements";
import { ReportBody } from "./ReportBody";
import { ReportShell } from "./ReportShell";
import { ScoreRing } from "./ScoreRing";
import { ScoresOverview } from "./ScoresOverview";
import { OnderdeelCard } from "./OnderdeelCard";
import { ActiesCard } from "./ActiesCard";

export function WebsiteCheckReport({ markdown }: { markdown: string }) {
  const blocks = parseReport(markdown);

  // Fallback: geen parsebare onderdelen (oude sessie of format-drift) →
  // de bestaande document-render.
  if (blocks.onderdelen.length === 0) {
    return (
      <ReportShell>
        {blocks.cover && (
          <CoverBanner raw={blocks.cover.raw} score={blocks.cover.score} />
        )}
        {blocks.strengths && blocks.improvements && (
          <StrengthsImprovements
            strengths={blocks.strengths}
            improvements={blocks.improvements}
          />
        )}
        <ReportBody markdown={blocks.bodyMarkdown} />
      </ReportShell>
    );
  }

  const scoreNum = blocks.cover?.score
    ? Number(blocks.cover.score.replace(",", "."))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-6 text-white shadow-md">
        <ScoreRing score={scoreNum} />
        <div>
          <h1 className="text-lg font-extrabold">Website-analyse</h1>
          {blocks.samenvatting && (
            <p className="mt-1 text-sm leading-relaxed opacity-90">
              {blocks.samenvatting}
            </p>
          )}
        </div>
      </div>

      {blocks.strengths && blocks.improvements && (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Sterke punten
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-950">
              {blocks.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border-l-4 border-amber-500 bg-amber-50/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Grootste verbeterpunten
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
              {blocks.improvements.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <ScoresOverview onderdelen={blocks.onderdelen} />

      {blocks.onderdelen.map((o) => (
        <OnderdeelCard key={o.slug} onderdeel={o} />
      ))}

      {blocks.acties.length > 0 && <ActiesCard acties={blocks.acties} />}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: geen fouten.

- [ ] **Step 3: Commit**

```bash
git add modules/website-check/report/WebsiteCheckReport.tsx
git commit -m "feat(website-check): structured render met fallback naar markdown"
```

---

## Task 8: Browser-verificatie (end-to-end)

**Files:** geen — verificatie via de dev-server en browser-preview.

- [ ] **Step 1: Dev-server starten**

Gebruik het preview-tool (niet Bash) om de dev-server te starten. Bestaat `.claude/launch.json` nog niet, maak dan een config met `name: "positionr"`, `runtimeExecutable: "pnpm"`, `runtimeArgs: ["dev"]`, `port: 3000`. Start 'm met `preview_start { name: "positionr" }`.

- [ ] **Step 2: Nieuwe layout controleren**

Log in, open een bestaande website-check-sessie (modulepagina → "Eerdere checks") of draai een nieuwe. Controleer met `read_page` + een screenshot:
- Hero met **score-ring** (score in het midden, ring gevuld naar rato).
- **Scores in één oogopslag** met gekleurde balken (rood/amber/groen kloppen met de scores).
- Per onderdeel een **kaart** met score-badge + *Wat we zien / Waarom dit telt / Wat je kunt doen*.
- **Acties**-kaart met impact-badges.
- Geen console-errors (`read_console_messages`).

- [ ] **Step 3: Fallback controleren**

Open een oudere sessie waarvan de `output` niet het huidige format volgt (of zet tijdelijk een sessie-`output` op vrije markdown zonder `### N. … — score / 10`-koppen). Verwacht: de **oude document-render** (ReportShell + cover + markdown), zonder crash.

- [ ] **Step 4: Volledige test-suite als vangnet**

Run: `pnpm test`
Expected: alle bestaande + nieuwe tests groen.

- [ ] **Step 5: Afrondende commit (indien nog losse wijzigingen)**

```bash
git add -A
git commit -m "chore(website-check): verificatie-fixes na browser-check" || echo "niets te committen"
```

---

## Self-review (uitgevoerd)

- **Spec-dekking:** parser (onderdelen/samenvatting/acties) ✓, renderer (hero-ring, scores-overzicht, onderdeel-kaarten, acties) ✓, fallback naar markdown ✓, geen datamigratie ✓. De matching-hook + kennisblokjes zijn bewust plan 2.
- **Placeholders:** geen — elke stap bevat concrete code/commands.
- **Type-consistentie:** `Onderdeel`/`Actie` gedefinieerd in Task 2/3, geïmporteerd door de componenten in Task 6 en `WebsiteCheckReport` in Task 7; `scoreBand` uit Task 5 gebruikt in Task 6. `ReportBlocks` krijgt de nieuwe velden in Task 4 vóór de renderer ze leest.
- **Aanname:** de format-template blijft de koppen `### N. Titel — score / 10` + `#### Wat we zien/Waarom dit telt/Wat je kunt doen` en een acties-tabel met kolommen "Actie"/"Impact" produceren. Wijzigt een admin dat drastisch, dan valt de render veilig terug op markdown (Task 7).
