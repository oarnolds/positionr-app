# Positionr Marketingsite — PR 3: Gratis Website Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een publieke `/gratis-check`: ondernemer geeft e-mail + website-URL, lead wordt opgeslagen, de Website-Check-analyse draait op de achtergrond, resultaat verschijnt met een sterke CTA naar `/prijzen`. Dit is de "trek" — minder drempel dan een abonnement.

**Architectuur:** Hergebruikt de bestaande Website-Check-pipeline (scrape → prompt → analyze) maar persisteert naar `leads` in plaats van `sessions`. Async-pattern volgt het bestaande model (server-action met `after()` voor fire-and-forget, client-polling via `router.refresh()`). UI hergebruikt de bestaande `WebsiteCheckResultView`. Simpele rate-limit (max 3 checks per e-mailadres per 24 uur) voorkomt misbruik.

**Tech Stack:** Next.js 15 (server actions + `next/server` `after()`), Drizzle ORM, vitest. Geen nieuwe dependencies.

**Scope-grens (bewust niet in PR 3):**
- Mollie-checkout / account-creatie (PR 4).
- Resend voor verzendingen vanaf `positionr.nl` (PR 4 / later).
- Captcha. Voor PR 3 alleen rate-limit per e-mail (per 24 uur). Captcha als blijkt dat misbruik probleem wordt.

**Bestandsstructuur:**

```
lib/
  db/schema.ts                              ← UITBREIDEN (leads: status, errorMessage, completedAt)
  rate-limit.ts                             ← NIEUW
  rate-limit.test.ts                        ← NIEUW
  supabase/middleware.ts                    ← AANPASSEN (/gratis-check publiek)
modules/website-check/
  freeCheck.ts                              ← NIEUW (runFreeCheck, naar leads i.p.v. sessions)
  freeCheck.test.ts                         ← NIEUW
app/(marketing)/
  gratis-check/
    page.tsx                                ← NIEUW (e-mail + URL formulier)
    actions.ts                              ← NIEUW (startFreeCheck server action)
    [id]/
      page.tsx                              ← NIEUW (resultaat-pagina, polling bij running)
      running-poll.tsx                      ← NIEUW (client-component, mirror bestaande)
  page.tsx                                  ← AANPASSEN (landing-CTA naar /gratis-check)
```

---

### Task 1: DB-uitbreiding — `leads` krijgt status + errorMessage + completedAt

Drie additieve kolommen op `leads` zodat we een async-flow kunnen draaien (running → completed/failed met foutmelding).

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Voeg een lead-status-enum + drie kolommen toe**

In `lib/db/schema.ts`, na de bestaande enums (na `subscriptionStatusEnum`) toevoegen:

```ts
export const leadStatusEnum = pgEnum("lead_status", [
  "running",
  "completed",
  "failed",
]);
```

In de `leads`-tabel-definitie (vervang het hele blok om order te bewaren):

Zoek:

```ts
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  websiteUrl: text("website_url").notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

Vervang door:

```ts
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  websiteUrl: text("website_url").notNull(),
  status: leadStatusEnum("status").default("running").notNull(),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
```

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Schema pushen naar Supabase**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm db:push`
Expected: drizzle stelt voor de enum `lead_status` aan te maken, en de kolommen `status`, `error_message`, `completed_at` aan `leads` toe te voegen. Pure additieve wijzigingen — bevestig met `Yes`.

Verificatie (in eigen terminal of via de inline-script-aanpak):

```bash
cat > /tmp/verify-leads.mjs <<'EOF'
import postgres from "postgres";
import { config } from "dotenv";
config({ path: "/Users/olivierarnolds/positionr-website/.env.local" });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='leads' order by ordinal_position`;
console.log("leads kolommen:", cols.map(r => r.column_name).join(", "));
await sql.end();
EOF
node /tmp/verify-leads.mjs; rm /tmp/verify-leads.mjs
```

Expected: `id, email, website_url, status, result, error_message, created_at, completed_at`.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(db): leads krijgt status + error_message + completed_at voor async-flow"
```

---

### Task 2: Rate-limit helper (`isEmailRateLimited`) + pure logic (TDD)

Pure helper voor "max 3 checks per e-mail per 24 uur".

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `lib/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { exceedsLimit, FREE_CHECK_DAILY_LIMIT } from "./rate-limit";

describe("FREE_CHECK_DAILY_LIMIT", () => {
  it("is 3 (per e-mail per 24 uur)", () => {
    expect(FREE_CHECK_DAILY_LIMIT).toBe(3);
  });
});

describe("exceedsLimit", () => {
  it("staat tellingen onder de limiet toe", () => {
    expect(exceedsLimit(0)).toBe(false);
    expect(exceedsLimit(1)).toBe(false);
    expect(exceedsLimit(2)).toBe(false);
  });

  it("weigert bij of boven de limiet", () => {
    expect(exceedsLimit(3)).toBe(true);
    expect(exceedsLimit(4)).toBe(true);
    expect(exceedsLimit(100)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/rate-limit.test.ts`
Expected: FAIL — "Cannot find module './rate-limit'".

- [ ] **Step 3: Write minimal implementation**

Maak `lib/rate-limit.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const FREE_CHECK_DAILY_LIMIT = 3;

/** Pure check: is een aantal hits ≥ de limiet? */
export function exceedsLimit(count: number): boolean {
  return count >= FREE_CHECK_DAILY_LIMIT;
}

/**
 * Heeft dit e-mailadres in de laatste 24 uur de gratis-check-limiet bereikt?
 * (Telt rijen uit `leads` ongeacht status — running/completed/failed tellen mee.)
 */
export async function isEmailRateLimited(email: string): Promise<boolean> {
  const rows = await db.execute(
    sql`select count(*)::int as c from leads
        where lower(email) = lower(${email})
          and created_at > now() - interval '24 hours'`,
  );
  const count = Number((rows as Array<{ c: number }>)[0]?.c ?? 0);
  return exceedsLimit(count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/rate-limit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts
git commit -m "feat(rate-limit): exceedsLimit + isEmailRateLimited (3 / 24u)"
```

---

### Task 3: `runFreeCheck` — Website-Check-pipeline naar `leads`

Parallel aan `runAnalysis` uit `service.ts`, maar persisteert naar `leads` (i.p.v. `sessions`) en hardcodeert `companyName: "Onbekend"` (geen extra invoer). Test met dependency-injection net als de bestaande service.

**Files:**
- Create: `modules/website-check/freeCheck.ts`
- Test: `modules/website-check/freeCheck.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `modules/website-check/freeCheck.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runFreeCheck } from "./freeCheck";
import type { WebsiteCheckOutput } from "./schema";

const OUTPUT: WebsiteCheckOutput = {
  companyName: "Acme",
  websiteUrl: "https://example.com",
  overallScore: 7,
  executiveSummary: "ok",
  onderdelen: [],
  sterkePunten: [],
  verbeterpunten: [],
  topActies: [],
};

describe("runFreeCheck", () => {
  it("schrijft completed met resultaat bij succes", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-1", websiteUrl: "https://example.com" },
      {
        scrape: async () => "<html>...</html>",
        fetchPrompt: async () => ({
          prompt: "Analyseer {websiteUrl} {scrapedContent} {companyName}",
          provider: "claude",
        }),
        analyze: async () => ({
          data: OUTPUT,
          llmModel: "test",
          llmInputTokens: 1,
          llmOutputTokens: 1,
          llmCostCents: 0,
          promptUsed: "Analyseer https://example.com",
        }),
        updateLead,
      },
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead.mock.calls[0][0]).toBe("lead-1");
    expect(updateLead.mock.calls[0][1]).toMatchObject({
      status: "completed",
      result: OUTPUT,
    });
    expect(updateLead.mock.calls[0][1].completedAt).toBeInstanceOf(Date);
  });

  it("schrijft failed met errorMessage bij fout", async () => {
    const updateLead = vi.fn();
    await runFreeCheck(
      { leadId: "lead-1", websiteUrl: "https://example.com" },
      {
        scrape: async () => {
          throw new Error("scrape kapot");
        },
        fetchPrompt: async () => ({ prompt: "", provider: "claude" }),
        analyze: async () => {
          throw new Error("zou niet moeten gebeuren");
        },
        updateLead,
      },
    );
    expect(updateLead).toHaveBeenCalledTimes(1);
    expect(updateLead.mock.calls[0][1]).toMatchObject({
      status: "failed",
      errorMessage: "scrape kapot",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test modules/website-check/freeCheck.test.ts`
Expected: FAIL — "Cannot find module './freeCheck'".

- [ ] **Step 3: Write minimal implementation**

Maak `modules/website-check/freeCheck.ts`:

```ts
import { analyze, type AnalyzeArgs } from "@/lib/ai/analyze";
import { getModulePrompt, substitutePlaceholders } from "@/lib/modules/prompts";
import { scrapeWebsite } from "./scraper";
import {
  WebsiteCheckOutputSchema,
  type WebsiteCheckOutput,
} from "./schema";
import { MODULE_SLUG } from "./index";

export type FreeCheckDeps = {
  scrape: (url: string) => Promise<string>;
  fetchPrompt: typeof getModulePrompt;
  analyze: (
    args: AnalyzeArgs<WebsiteCheckOutput>,
  ) => ReturnType<typeof analyze<WebsiteCheckOutput>>;
  updateLead: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

export const defaultFreeCheckDeps: FreeCheckDeps = {
  scrape: scrapeWebsite,
  fetchPrompt: getModulePrompt,
  analyze: (args) => analyze<WebsiteCheckOutput>(args),
  updateLead: async (id, patch) => {
    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("@/lib/db/client");
    const { leads } = await import("@/lib/db/schema");
    // WHERE-guard op status='running' voorkomt dat een late achtergrond-update
    // een al-afgehandelde lead overschrijft.
    await db
      .update(leads)
      .set(patch)
      .where(and(eq(leads.id, id), eq(leads.status, "running")));
  },
};

export async function runFreeCheck(
  args: { leadId: string; websiteUrl: string },
  deps: FreeCheckDeps = defaultFreeCheckDeps,
): Promise<void> {
  try {
    const scraped = await deps.scrape(args.websiteUrl);
    const { prompt: template, provider } = await deps.fetchPrompt(MODULE_SLUG);
    const prompt = substitutePlaceholders(template, {
      websiteUrl: args.websiteUrl,
      companyName: "Onbekend",
      scrapedContent: scraped || "(Kon website niet laden)",
    });
    const result = await deps.analyze({
      provider,
      prompt,
      schema: WebsiteCheckOutputSchema,
    });
    await deps.updateLead(args.leadId, {
      status: "completed",
      result: result.data,
      completedAt: new Date(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.updateLead(args.leadId, {
      status: "failed",
      errorMessage: msg,
      completedAt: new Date(),
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test modules/website-check/freeCheck.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add modules/website-check/freeCheck.ts modules/website-check/freeCheck.test.ts
git commit -m "feat(website-check): runFreeCheck → schrijft naar leads i.p.v. sessions"
```

---

### Task 4: `/gratis-check` — formulier

Publieke pagina met e-mail + URL formulier. Server-component. Submit gaat naar de server-action uit Task 5.

**Files:**
- Create: `app/(marketing)/gratis-check/page.tsx`

- [ ] **Step 1: Maak de pagina**

Maak `app/(marketing)/gratis-check/page.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startFreeCheck } from "./actions";

export const metadata = {
  title: "Gratis Website Check — Positionr",
};

export default function GratisCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <section className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-center text-4xl font-bold">Gratis Website Check</h1>
      <p className="mt-4 text-center text-muted-foreground">
        Geef je e-mail en website-URL — binnen een minuut zie je een score met
        concrete verbeterpunten.
      </p>

      <ErrorBox searchParams={searchParams} />

      <form
        action={startFreeCheck}
        className="mt-8 space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="jij@bedrijf.nl"
            className="mt-1"
          />
        </div>
        <div>
          <label htmlFor="websiteUrl" className="text-sm font-medium">
            Website
          </label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            required
            placeholder="https://www.jouwbedrijf.nl"
            className="mt-1"
          />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Start gratis analyse
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We mailen je niet ongevraagd. Door dit te versturen ga je akkoord met
          ons <a href="/privacy" className="underline">privacybeleid</a>.
        </p>
      </form>
    </section>
  );
}

async function ErrorBox({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      {error}
    </div>
  );
}
```

- [ ] **Step 2: Verifieer typecheck**

`startFreeCheck` bestaat nog niet — typecheck slaagt pas ná Task 5. Sla deze verificatie hier over; check 'm aan het eind van Task 5.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/gratis-check/page.tsx"
git commit -m "feat(marketing): /gratis-check formulier (e-mail + URL)"
```

---

### Task 5: `startFreeCheck` server-action

Valideert input, checkt rate-limit, maakt `leads`-rij aan (status `running`), start de analyse op de achtergrond via `after()`, en redirect naar de resultaat-pagina.

**Files:**
- Create: `app/(marketing)/gratis-check/actions.ts`

- [ ] **Step 1: Maak het bestand**

Maak `app/(marketing)/gratis-check/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { isEmailRateLimited } from "@/lib/rate-limit";
import { runFreeCheck } from "@/modules/website-check/freeCheck";

const FreeCheckInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Vul een geldig e-mailadres in."),
  websiteUrl: z
    .string()
    .trim()
    .url("Vul een geldige URL in (incl. https://)."),
});

export async function startFreeCheck(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email"),
    websiteUrl: formData.get("websiteUrl"),
  };

  const parsed = FreeCheckInputSchema.safeParse(raw);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Ongeldige invoer.";
    redirect(`/gratis-check?error=${encodeURIComponent(msg)}`);
  }

  if (await isEmailRateLimited(parsed.data.email)) {
    redirect(
      `/gratis-check?error=${encodeURIComponent(
        "Je hebt vandaag het maximum (3) gratis checks bereikt. Probeer morgen opnieuw of word lid.",
      )}`,
    );
  }

  const [row] = await db
    .insert(leads)
    .values({
      email: parsed.data.email,
      websiteUrl: parsed.data.websiteUrl,
      status: "running",
    })
    .returning({ id: leads.id });

  // Achtergrond-analyse na het response (Next 15 `after`). Vangt zelf fouten
  // en schrijft 'failed' naar de lead — geen exception lekt uit.
  after(() =>
    runFreeCheck({
      leadId: row.id,
      websiteUrl: parsed.data.websiteUrl,
    }),
  );

  redirect(`/gratis-check/${row.id}`);
}
```

- [ ] **Step 2: Verifieer typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS — geen errors, alle tests groen.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/gratis-check/actions.ts"
git commit -m "feat(marketing): startFreeCheck server-action (validatie + rate-limit + fire-and-forget)"
```

---

### Task 6: Resultaat-pagina `/gratis-check/[id]`

Toont running/failed/completed-staat. Bij completed: bestaande `WebsiteCheckResultView` + CTA-strip "Word lid → /prijzen".

**Files:**
- Create: `app/(marketing)/gratis-check/[id]/page.tsx`

- [ ] **Step 1: Maak de pagina**

Maak `app/(marketing)/gratis-check/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ArrowRight, CheckCircle2, Circle, Globe, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { WebsiteCheckOutputSchema } from "@/modules/website-check/schema";
import { WebsiteCheckResultView } from "@/modules/website-check/components/WebsiteCheckResultView";
import { RunningPoll } from "./running-poll";

const STUCK_THRESHOLD_SECONDS = 6 * 60; // 1 min grace boven Vercel maxDuration

export default async function GratisCheckResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (rows.length === 0) {
    redirect("/gratis-check?error=" + encodeURIComponent("Check niet gevonden."));
  }
  let row = rows[0];

  // Auto-fail bij hangende running-lead (zoals in /modules/website-check).
  if (row.status === "running") {
    const elapsedSec = Math.floor(
      (Date.now() - new Date(row.createdAt).getTime()) / 1000,
    );
    if (elapsedSec > STUCK_THRESHOLD_SECONDS) {
      const failedAt = new Date();
      const msg = "Analyse onderbroken (timeout). Probeer opnieuw.";
      await db
        .update(leads)
        .set({ status: "failed", errorMessage: msg, completedAt: failedAt })
        .where(and(eq(leads.id, row.id), eq(leads.status, "running")));
      row = {
        ...row,
        status: "failed",
        errorMessage: msg,
        completedAt: failedAt,
      };
    }
  }

  if (row.status === "running") {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000),
    );
    const elapsedLabel =
      elapsed < 60
        ? `${elapsed}s`
        : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    const steps = [
      { label: "Pagina ophalen", doneAt: 8 },
      { label: "Inhoud analyseren met AI", doneAt: 45 },
      { label: "Resultaat opmaken", doneAt: Number.POSITIVE_INFINITY },
    ];
    const currentStepIdx = steps.findIndex((s) => elapsed < s.doneAt);

    return (
      <>
        <RunningPoll />
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Gratis Website Check</h1>
              <p className="text-gray-600">
                We analyseren je website — dit duurt 20–50 seconden.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border-2 border-purple-200 bg-purple-50 p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <span className="font-semibold text-gray-900">
                Bezig met analyseren…
              </span>
              <span className="ml-auto text-sm tabular-nums text-gray-600">
                {elapsedLabel}
              </span>
            </div>
            <p className="mt-4 truncate text-sm text-gray-700">
              <span className="font-semibold">URL:</span>{" "}
              <span className="text-purple-700">{row.websiteUrl}</span>
            </p>
            <ul className="mt-5 space-y-2">
              {steps.map((step, i) => {
                const state =
                  i < currentStepIdx
                    ? "done"
                    : i === currentStepIdx
                      ? "current"
                      : "pending";
                return (
                  <li key={step.label} className="flex items-center gap-2 text-sm">
                    {state === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {state === "current" && (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    )}
                    {state === "pending" && (
                      <Circle className="h-4 w-4 text-gray-300" />
                    )}
                    <span
                      className={
                        state === "pending"
                          ? "text-gray-400"
                          : state === "current"
                            ? "font-semibold text-gray-900"
                            : "text-gray-700"
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </>
    );
  }

  if (row.status === "failed") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-lg font-semibold text-rose-700">Analyse mislukt</p>
        <p className="mt-2 text-sm text-gray-700">
          {row.errorMessage ?? "Onbekende fout."}
        </p>
        <p className="mt-1 text-xs text-gray-500">URL: {row.websiteUrl}</p>
        <div className="mt-6">
          <Link href="/gratis-check">
            <Button size="lg">Opnieuw proberen</Button>
          </Link>
        </div>
      </div>
    );
  }

  // status === "completed"
  const parsed = WebsiteCheckOutputSchema.safeParse(row.result);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-rose-700">
        Resultaat-output is ongeldig opgeslagen.
      </div>
    );
  }

  return (
    <>
      <WebsiteCheckResultView data={parsed.data} readOnly />

      {/* CTA-strip: word lid */}
      <section className="mx-auto mt-6 mb-16 max-w-4xl px-6">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-purple-50 to-blue-50 p-8 text-center">
          <h2 className="text-2xl font-bold">
            Wil je ook ICP-analyse, LinkedIn-check en meer?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Word lid voor alle Positionr-modules in één portal.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/prijzen">
              <Button size="lg">
                Bekijk de abonnementen <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Al lid? Inloggen
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Verifieer typecheck**

`RunningPoll` bestaat nog niet — typecheck slaagt pas ná Task 7.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/gratis-check/[id]/page.tsx"
git commit -m "feat(marketing): /gratis-check/[id] resultaatpagina met CTA naar prijzen"
```

---

### Task 7: `RunningPoll` client-component

Polled `router.refresh()` — exact patroon van de bestaande variant in `/modules/website-check/[sessionId]/running-poll.tsx`. Aparte file om de marketing-route-groep self-contained te houden.

**Files:**
- Create: `app/(marketing)/gratis-check/[id]/running-poll.tsx`

- [ ] **Step 1: Maak het component**

Maak `app/(marketing)/gratis-check/[id]/running-poll.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polled server-side refresh: roept `router.refresh()` elke 3s aan zolang de
 * gebruiker op deze pagina staat. Geen volledige page-reload — de gebruiker
 * kan vrij weg navigeren zonder dat de analyse stopt (die loopt server-side).
 */
export function RunningPoll({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
```

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/gratis-check/[id]/running-poll.tsx"
git commit -m "feat(marketing): RunningPoll voor /gratis-check polling"
```

---

### Task 8: Middleware — `/gratis-check` publiek

**Files:**
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: Voeg `/gratis-check` toe aan `isPublic`**

Zoek:

```ts
  const isPublic =
    path === "/" ||
    path.startsWith("/prijzen") ||
    path.startsWith("/voorwaarden") ||
    path.startsWith("/privacy") ||
    path.startsWith("/checkout") ||
    path.startsWith("/login") ||
```

Vervang door:

```ts
  const isPublic =
    path === "/" ||
    path.startsWith("/prijzen") ||
    path.startsWith("/voorwaarden") ||
    path.startsWith("/privacy") ||
    path.startsWith("/checkout") ||
    path.startsWith("/gratis-check") ||
    path.startsWith("/login") ||
```

- [ ] **Step 2: Verifieer typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat(middleware): /gratis-check publiek"
```

---

### Task 9: Landing — primaire CTA → `/gratis-check`

Maak de gratis-check de hoofd-CTA op de landing (de "trek"). `/prijzen` wordt secundair.

**Files:**
- Modify: `app/(marketing)/page.tsx`

- [ ] **Step 1: Vervang de hero-CTA-knoppen**

Zoek:

```tsx
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/prijzen">
            <Button size="lg">
              Bekijk de abonnementen <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Inloggen
            </Button>
          </Link>
        </div>
```

Vervang door:

```tsx
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/gratis-check">
            <Button size="lg">
              Doe de gratis Website Check <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/prijzen">
            <Button size="lg" variant="outline">
              Bekijk abonnementen
            </Button>
          </Link>
        </div>
```

- [ ] **Step 2: Verifieer typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(marketing)/page.tsx"
git commit -m "feat(marketing): primaire landing-CTA wijst naar gratis Website Check"
```

---

### Task 10: Eindcheck — typecheck, tests, smoke

**Files:** (geen wijzigingen)

- [ ] **Step 1: Typecheck**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Volledige testsuite**

Run: `cd /Users/olivierarnolds/positionr-website && pnpm test`
Expected: PASS — 63 (PR2-baseline) + 5 (rate-limit) + 2 (freeCheck) = **70 tests**, 15 files.

- [ ] **Step 3: Handmatige smoke (door Olivier)**

Run:

```bash
cd /Users/olivierarnolds/positionr-website && pnpm dev
```

Test-flow in de browser:
1. `http://localhost:3000` — landing toont nu "Doe de gratis Website Check" als primaire knop. Klik 'm → `/gratis-check`.
2. `/gratis-check` — formulier met e-mail + URL. Submit → redirect naar `/gratis-check/<id>` met spinner + stappen-lijst.
3. Wacht ~20–50s. Pagina ververst zichzelf elke 3s (door `RunningPoll`).
4. Bij voltooiing: de `WebsiteCheckResultView` met score-banner + onderdelen + paarse CTA-strip "Word lid".
5. Klik in de CTA "Bekijk de abonnementen" → `/prijzen`. Klik "Al lid? Inloggen" → `/login`.
6. Verifieer rate-limit: probeer 4× achter elkaar met hetzelfde e-mailadres binnen 24u — de 4e moet de foutmelding tonen (bovenaan het formulier).

---

## Self-review (na voltooiing PR 3)

- [ ] `pnpm typecheck` — schoon.
- [ ] `pnpm test` — alle tests groen (verwacht 70 totaal).
- [ ] `/gratis-check` is publiek (zonder login te bereiken).
- [ ] Lead-rij wordt aangemaakt + status loopt running → completed of failed.
- [ ] Bij completed: result-view toont, CTA naar `/prijzen` zichtbaar.
- [ ] Bij failed: foutpagina, "opnieuw proberen"-knop.
- [ ] Rate-limit (3/24u per e-mail) blokkeert correct.
- [ ] Geen regressie in de ingelogde `/modules/website-check`-flow.

## Wat deze PR NIET doet

- Mollie-checkout + magic-link (PR 4).
- Tier-gating in de portal + `/account`-beheer (PR 5).
- Captcha tegen bot-misbruik (parkeren tot signaal).
- Sturen van een resultaten-e-mail vanaf Resend (PR 4 — komt op Resend).
