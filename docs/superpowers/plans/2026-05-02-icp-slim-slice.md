# ICP Slim Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eerste werkende module (ICP-analyse) op Positionr-app, inclusief klant-hub voor cross-module data-hergebruik.

**Architecture:** Klant-hub (`clients` tabel met `facts` JSONB) + auditspoor (bestaande `sessions` tabel). ICP-flow: form → cheerio scrape → Claude Sonnet 4.6 met cached system prompt → zod-validatie → opslag in beide laagjes → resultaatpagina met 4 secties. Re-run dialog detecteert duplicate runs en logt intentie.

**Tech Stack:** Next.js 15 (App Router, Server Actions) + Supabase (Postgres + Auth + RLS) + Drizzle ORM + Anthropic SDK (Claude Sonnet 4.6, prompt caching) + cheerio + Tailwind/shadcn-ui + zod.

**Verificatie-stijl:** Geen unit tests (project heeft geen test-framework). Per taak: code → handmatige browser/curl/SQL-verificatie → commit. Past bij user working style ("verify in browser before moving on, commit each step").

**Spec:** `docs/superpowers/specs/2026-05-02-icp-slim-slice-design.md`

---

## Task 1: Database — `clients` tabel + `sessions.clientId`

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Voeg `clients` tabel + `clientId` op `sessions` toe aan schema**

Voeg toe ná de `modules` tabel-definitie en vóór de `sessions` tabel (binnen `lib/db/schema.ts`):

```ts
// ── Clients ─────────────────────────────────────────────────
// Per gebruiker: bedrijven die geanalyseerd worden. Kennishub.
// `facts` JSONB groeit met output van module-runs (canonieke staat).

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),                                  // = auth.users.id
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  kvk: text("kvk"),
  sector: text("sector"),
  facts: jsonb("facts").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
```

Voeg in de `sessions` definitie een `clientId` kolom toe (na `moduleSlug`):

```ts
clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
```

- [ ] **Step 2: Push schema naar Supabase**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm db:push
```

Verwacht: drizzle-kit toont migratie-prompt voor `clients` tabel + `client_id` kolom op `sessions`. Bevestig met `y`.

- [ ] **Step 3: Verifieer in DB**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`select column_name, data_type from information_schema.columns where table_name='clients' order by ordinal_position\`
  .then(r => { console.table(r); return sql\`select column_name from information_schema.columns where table_name='sessions' and column_name='client_id'\`; })
  .then(r => { console.log('sessions.client_id:', r); return sql.end(); });
"
```

Verwacht: tabel `clients` met 8 kolommen + `sessions.client_id` aanwezig.

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add lib/db/schema.ts && git commit -m "Add clients table + sessions.client_id"
```

---

## Task 2: RLS-policies voor `clients`

**Files:**
- Create: `drizzle/0002_clients_rls.sql`

- [ ] **Step 1: Schrijf RLS-migratie**

Maak `drizzle/0002_clients_rls.sql` met:

```sql
-- RLS voor clients-tabel
-- Run handmatig na pnpm db:push (zelfde flow als 0001_rls.sql).

alter table clients enable row level security;

create policy "users see own clients"
  on clients for select
  using (auth.uid() = user_id);

create policy "users insert own clients"
  on clients for insert
  with check (auth.uid() = user_id);

create policy "users update own clients"
  on clients for update
  using (auth.uid() = user_id);

create policy "users delete own clients"
  on clients for delete
  using (auth.uid() = user_id);

create policy "admins see all clients"
  on clients for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-update updated_at op elke UPDATE
create or replace function public.touch_clients_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on clients;
create trigger clients_touch_updated_at
  before update on clients
  for each row execute procedure public.touch_clients_updated_at();
```

- [ ] **Step 2: Voer migratie uit via psql**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node -e "
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
const stmt = fs.readFileSync('drizzle/0002_clients_rls.sql', 'utf8');
sql.unsafe(stmt).then(() => { console.log('OK'); return sql.end(); }).catch(e => { console.error(e.message); sql.end(); process.exit(1); });
"
```

Verwacht: `OK`.

- [ ] **Step 3: Verifieer policies**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`select policyname, cmd from pg_policies where tablename='clients' order by policyname\`
  .then(r => { console.table(r); return sql.end(); });
"
```

Verwacht: 5 rijen (4× user-policy + 1× admin-select).

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add drizzle/0002_clients_rls.sql && git commit -m "Add RLS policies for clients table"
```

---

## Task 3: AI-helper `lib/ai/claude.ts`

**Files:**
- Create: `lib/ai/claude.ts`

- [ ] **Step 1: Schrijf de helper**

Maak `lib/ai/claude.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;

// Sonnet 4.6 prijzen per miljoen tokens ($USD)
const PRICE = {
  input: 3.0,
  cacheWrite: 3.75,
  cacheRead: 0.3,
  output: 15.0,
} as const;

export type AnalyzeResult<T> = {
  data: T;
  promptUsed: string;
  llmModel: string;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCostCents: number;
};

export async function analyzeWithCachedSystem<T>(args: {
  system: string;
  user: string;
  schema: ZodType<T>;
}): Promise<AnalyzeResult<T>> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: args.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: args.user }],
  });

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Claude returnde geen geldige JSON: ${text.slice(0, 200)}`);
  }

  const data = args.schema.parse(parsed);

  const u = response.usage;
  const inputRegular = u.input_tokens ?? 0;
  const inputCacheWrite = (u as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0;
  const inputCacheRead = (u as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0;
  const output = u.output_tokens ?? 0;

  const totalInput = inputRegular + inputCacheWrite + inputCacheRead;

  // Kostencalculatie: prijs/MTok × tokens, omgerekend naar centen
  const costCents = Math.round(
    (inputRegular * PRICE.input +
      inputCacheWrite * PRICE.cacheWrite +
      inputCacheRead * PRICE.cacheRead +
      output * PRICE.output) /
      10_000
  );

  return {
    data,
    promptUsed: `[system]\n${args.system}\n\n[user]\n${args.user}`,
    llmModel: MODEL,
    llmInputTokens: totalInput,
    llmOutputTokens: output,
    llmCostCents: costCents,
  };
}
```

- [ ] **Step 2: Verifieer typecheck slaagt**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors. Als er een error komt over Anthropic types — check dat `@anthropic-ai/sdk` versie ^0.32.1 nog actueel is, anders eventueel ook `^@types` updaten.

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add lib/ai/claude.ts && git commit -m "Add Claude analyze helper with prompt caching + cost telemetry"
```

---

## Task 4: ICP module — `schema.ts` (zod input + output)

**Files:**
- Create: `modules/icp-analyse/schema.ts`

- [ ] **Step 1: Schrijf schema's**

Maak `modules/icp-analyse/schema.ts`:

```ts
import { z } from "zod";

export const RUN_INTENTS = ["new", "replace", "version", "topic"] as const;
export type RunIntent = (typeof RUN_INTENTS)[number];

export const ICPInput = z.object({
  clientId: z.string().uuid(),
  product: z.string().trim().min(2).max(120),
  productDescription: z.string().trim().min(10).max(1000),
  runIntent: z.enum(RUN_INTENTS).default("new"),
});
export type ICPInput = z.infer<typeof ICPInput>;

export const ICPOutput = z.object({
  bedrijfsnaam: z.string(),
  product: z.string(),

  banner: z.object({
    samenvatting: z.string().min(20),
    sectorPositie: z.string(),
    websiteAnalyseScore: z.number().min(0).max(100),
  }),

  firmografisch: z.object({
    sector: z.string(),
    subsector: z.string(),
    bedrijfsgrootte: z.string(),
    contactpersoon: z.string(),
    beslisser: z.string(),
    contractwaarde: z.string(),
    geografie: z.string(),
  }),

  pijnpunten: z.array(z.string()).min(3).max(7),
  triggers: z.array(z.string()).min(3).max(7),

  dienstFocus: z.object({
    kernBelofte: z.string(),
    prijsindicatie: z.string(),
    onderscheidend: z.string(),
  }),
});
export type ICPOutput = z.infer<typeof ICPOutput>;

// Shape van clients.facts.icp[i]
export type ICPFactEntry = {
  product: string;
  sessionId: string;
  output: ICPOutput;
  runAt: string; // ISO
  runIntent: RunIntent;
};

// Shape van clients.facts.website_snapshot
export type WebsiteSnapshot = {
  url: string;
  title: string;
  metaDescription: string;
  heroText: string;
  bodyExcerpt: string;
  scrapedAt: string;
};
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add modules/icp-analyse/schema.ts && git commit -m "Add ICP module zod schemas"
```

---

## Task 5: Scraper `modules/icp-analyse/scraper.ts`

**Files:**
- Create: `modules/icp-analyse/scraper.ts`

- [ ] **Step 1: Schrijf scraper**

Maak `modules/icp-analyse/scraper.ts`:

```ts
import * as cheerio from "cheerio";
import type { WebsiteSnapshot } from "./schema";

export async function scrapeForIcp(url: string): Promise<WebsiteSnapshot> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let res: Response;
  try {
    res = await fetch(normalized, {
      headers: { "User-Agent": "Positionr/1.0 (+https://app.positionr.nl)" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new Error(`Kon ${normalized} niet ophalen: ${(e as Error).message}`);
  }

  if (!res.ok) {
    throw new Error(`${normalized} gaf HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";

  const heroText = $("h1, h2")
    .slice(0, 3)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join(" | ");

  // Strip scripts/styles, neem body, comprimeer whitespace, limit
  $("script, style, noscript").remove();
  const bodyExcerpt = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);

  return {
    url: normalized,
    title,
    metaDescription,
    heroText,
    bodyExcerpt,
    scrapedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Smoke-test scraper**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node --experimental-strip-types -e "
import('./modules/icp-analyse/scraper.ts').then(async (m) => {
  const r = await m.scrapeForIcp('example.com');
  console.log({ title: r.title, len: r.bodyExcerpt.length, hero: r.heroText.slice(0,80) });
});
" 2>&1 | head -20
```

Als `--experimental-strip-types` faalt: bouw via `pnpm build` of skip deze step en verifieer in browser bij Task 8.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add modules/icp-analyse/scraper.ts && git commit -m "Add ICP website scraper using cheerio"
```

---

## Task 6: Prompt-builder `modules/icp-analyse/prompt.ts`

**Files:**
- Create: `modules/icp-analyse/prompt.ts`

- [ ] **Step 1: Schrijf prompt-builders**

Maak `modules/icp-analyse/prompt.ts`:

```ts
import type { WebsiteSnapshot } from "./schema";

export function buildSystemPrompt(): string {
  return `Je bent een B2B-marketingexpert gespecialiseerd in Ideale Klantprofielen (ICP).
Je werkt vanuit het perspectief van de prospect, niet de aanbieder. Je communiceert in
begrijpelijke taal voor ondernemers zonder marketingkennis. Je toon is positief,
eerlijk en concreet.

# Doel
Definieer voor het opgegeven bedrijf en product een Ideale Klantprofiel met vier secties:
banner, firmografisch profiel, pijnpunten/triggers, dienst-focus.

# Output-secties

## 1. Banner
- samenvatting: 2-3 zinnen die positionering en doelgroep helder maken
- sectorPositie: korte typering (bv. "Niche-speler in MKB-financieel")
- websiteAnalyseScore: 0-100, hoe rijk de website-input was om op te kunnen leunen

## 2. Firmografisch profiel
- sector / subsector: in welke markt opereert de typische klant
- bedrijfsgrootte: bv. "10-50 fte" of "€2-10M omzet"
- contactpersoon: typische rol die contact zoekt (bv. "Hoofd Operations")
- beslisser: rol die finale tekenbevoegdheid heeft (bv. "CFO")
- contractwaarde: indicatie (bv. "€5k-15k/jaar")
- geografie: bv. "Nederland, Vlaanderen"

## 3. Pijnpunten & Triggers
- pijnpunten: 3-7 concrete pijnpunten van de doelgroep, kort en specifiek
- triggers: 3-7 events die kopen veroorzaken (bv. "Nieuwe wetgeving in werking")

## 4. Dienst-focus
- kernBelofte: wat krijgt de klant uiteindelijk? (uitkomst, niet feature)
- prijsindicatie: bv. "Vanaf €750/maand" of "€15-50k/project"
- onderscheidend: wat maakt deze propositie anders dan generieke alternatieven

# Principes
- Outside-in: schrijf vanuit beleving van de prospect, niet de aanbieder
- Specifiek boven generiek: "MKB-accountantskantoren" beter dan "zakelijke dienstverlening"
- Pijnpunten zijn problemen, geen wensen ("rapportages kosten 4 dagen per maand", niet "betere rapportages")
- Triggers zijn gebeurtenissen die actie veroorzaken, geen statische pijnpunten

# Outputformaat
Geef je antwoord als geldig JSON-object met deze top-level keys:
- bedrijfsnaam (string)
- product (string)
- banner (object met samenvatting, sectorPositie, websiteAnalyseScore)
- firmografisch (object met sector, subsector, bedrijfsgrootte, contactpersoon, beslisser, contractwaarde, geografie)
- pijnpunten (array van 3-7 strings)
- triggers (array van 3-7 strings)
- dienstFocus (object met kernBelofte, prijsindicatie, onderscheidend)

Geef ALLEEN het JSON-object terug, geen toelichting daarbuiten.`;
}

export function buildUserPrompt(args: {
  bedrijfsnaam: string;
  product: string;
  productDescription: string;
  snapshot: WebsiteSnapshot;
}): string {
  return `# Bedrijf
${args.bedrijfsnaam}

# Hoofdproduct/-dienst
Naam: ${args.product}
Omschrijving: ${args.productDescription}

# Website-snapshot (${args.snapshot.url})
Titel: ${args.snapshot.title || "(leeg)"}
Meta-description: ${args.snapshot.metaDescription || "(leeg)"}
Hero/koppen: ${args.snapshot.heroText || "(geen H1/H2 gevonden)"}

Body-uittreksel (eerste 2000 tekens):
"""
${args.snapshot.bodyExcerpt || "(leeg)"}
"""

Definieer de Ideale Klantprofiel volgens de structuur en geef het JSON-object terug.`;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add modules/icp-analyse/prompt.ts && git commit -m "Add ICP system + user prompt builders"
```

---

## Task 7: Service-orchestrator `modules/icp-analyse/service.ts`

**Files:**
- Create: `modules/icp-analyse/service.ts`

- [ ] **Step 1: Schrijf service**

Maak `modules/icp-analyse/service.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, sessions } from "@/lib/db/schema";
import { analyzeWithCachedSystem } from "@/lib/ai/claude";
import { scrapeForIcp } from "./scraper";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import {
  ICPOutput,
  type ICPInput,
  type ICPFactEntry,
  type WebsiteSnapshot,
} from "./schema";

const MODULE_SLUG = "icp-analyse";

/**
 * Voer ICP-analyse uit voor een klant + product.
 * Houdt sessions-rij bij (audit) en updatet clients.facts (canoniek).
 * Retourneert sessionId; gooit op fout (waarna sessions.status = 'failed').
 */
export async function runICPAnalysis(
  userId: string,
  input: ICPInput
): Promise<string> {
  // 1. Klant ophalen (en valideren dat hij van de gebruiker is — RLS dekt dit ook,
  //    maar Drizzle bypassed RLS met de service role-key dus expliciete check).
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) throw new Error("Klant niet gevonden");
  if (client.userId !== userId) throw new Error("Geen toegang tot deze klant");
  if (!client.websiteUrl) throw new Error("Klant heeft geen website-URL — vul eerst in");

  // 2. Maak draft-sessie
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      clientId: client.id,
      moduleSlug: MODULE_SLUG,
      status: "running",
      input: input as unknown as Record<string, unknown>,
    })
    .returning();

  try {
    // 3. Scrape (met cache via clients.facts.website_snapshot)
    const existingFacts = (client.facts ?? {}) as Record<string, unknown>;
    const cachedSnapshot = existingFacts.website_snapshot as WebsiteSnapshot | undefined;
    const snapshotAge = cachedSnapshot
      ? Date.now() - new Date(cachedSnapshot.scrapedAt).getTime()
      : Infinity;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const snapshot: WebsiteSnapshot =
      cachedSnapshot && cachedSnapshot.url === client.websiteUrl && snapshotAge < ONE_DAY_MS
        ? cachedSnapshot
        : await scrapeForIcp(client.websiteUrl);

    // 4. Bouw prompt + run Claude
    const system = buildSystemPrompt();
    const user = buildUserPrompt({
      bedrijfsnaam: client.name,
      product: input.product,
      productDescription: input.productDescription,
      snapshot,
    });

    const result = await analyzeWithCachedSystem({
      system,
      user,
      schema: ICPOutput,
    });

    // 5. Update sessie met output + telemetrie
    await db
      .update(sessions)
      .set({
        status: "review",
        output: result.data as unknown as Record<string, unknown>,
        promptUsed: result.promptUsed,
        llmModel: result.llmModel,
        llmInputTokens: result.llmInputTokens,
        llmOutputTokens: result.llmOutputTokens,
        llmCostCents: result.llmCostCents,
        completedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    // 6. Promote naar clients.facts
    const facts = { ...existingFacts };
    if (snapshot !== cachedSnapshot) {
      facts.website_snapshot = snapshot;
    }
    const existingICP = (facts.icp as ICPFactEntry[] | undefined) ?? [];
    const newEntry: ICPFactEntry = {
      product: input.product,
      sessionId: session.id,
      output: result.data,
      runAt: new Date().toISOString(),
      runIntent: input.runIntent,
    };

    let updatedICP: ICPFactEntry[];
    if (input.runIntent === "replace" || input.runIntent === "version") {
      // Vervang entry met zelfde product (case-insensitive match)
      const idx = existingICP.findIndex(
        (e) => e.product.toLowerCase() === input.product.toLowerCase()
      );
      if (idx >= 0) {
        updatedICP = [...existingICP];
        updatedICP[idx] = newEntry;
      } else {
        updatedICP = [...existingICP, newEntry];
      }
    } else {
      // 'new' of 'topic' → push als nieuwe entry
      updatedICP = [...existingICP, newEntry];
    }
    facts.icp = updatedICP;

    await db
      .update(clients)
      .set({ facts })
      .where(eq(clients.id, client.id));

    return session.id;
  } catch (err) {
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));
    throw err;
  }
}

/**
 * Detecteer of voor (clientId, product) al een ICP-fact bestaat.
 * Gebruikt door RerunDialog op input-pagina.
 */
export async function findExistingICP(
  clientId: string,
  product: string
): Promise<ICPFactEntry | null> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;
  const facts = (client.facts ?? {}) as Record<string, unknown>;
  const icp = (facts.icp as ICPFactEntry[] | undefined) ?? [];
  const match = icp.find((e) => e.product.toLowerCase() === product.toLowerCase());
  return match ?? null;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add modules/icp-analyse/service.ts && git commit -m "Add ICP service orchestrator (scrape→Claude→sessions+facts)"
```

---

## Task 8: Server actions `app/(app)/modules/icp-analyse/actions.ts`

**Files:**
- Create: `app/(app)/modules/icp-analyse/actions.ts`

- [ ] **Step 1: Schrijf server actions**

Maak `app/(app)/modules/icp-analyse/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { runICPAnalysis, findExistingICP } from "@/modules/icp-analyse/service";
import { ICPInput } from "@/modules/icp-analyse/schema";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Maakt een nieuwe klant voor de huidige gebruiker.
 * Gebruikt door InputForm wanneer "+ Nieuwe klant" gekozen is.
 */
export async function createClientForUser(formData: FormData): Promise<{ id: string }> {
  const user = await getUser();
  const name = String(formData.get("name") ?? "").trim();
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();

  if (name.length < 2) throw new Error("Bedrijfsnaam is verplicht");
  if (!websiteUrl) throw new Error("Website-URL is verplicht");

  const normalizedUrl = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;

  const [client] = await db
    .insert(clients)
    .values({
      userId: user.id,
      name,
      websiteUrl: normalizedUrl,
    })
    .returning({ id: clients.id });

  revalidatePath("/modules/icp-analyse");
  return { id: client.id };
}

/**
 * Detecteer bestaande ICP voor (clientId, product). Voor RerunDialog op de form.
 */
export async function checkExistingICP(
  clientId: string,
  product: string
): Promise<{ exists: boolean; runAt?: string }> {
  await getUser();
  const existing = await findExistingICP(clientId, product);
  return existing ? { exists: true, runAt: existing.runAt } : { exists: false };
}

/**
 * Start ICP-analyse. Redirect naar resultaatpagina (running of done).
 */
export async function startICPAnalysis(formData: FormData) {
  const user = await getUser();

  const parsed = ICPInput.parse({
    clientId: formData.get("clientId"),
    product: formData.get("product"),
    productDescription: formData.get("productDescription"),
    runIntent: formData.get("runIntent") ?? "new",
  });

  let sessionId: string;
  try {
    sessionId = await runICPAnalysis(user.id, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    redirect(`/modules/icp-analyse?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/modules/icp-analyse/${sessionId}`);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add app/\(app\)/modules/icp-analyse/actions.ts && git commit -m "Add ICP server actions (create client, start analysis, check existing)"
```

---

## Task 9: Input-pagina + InputForm

**Files:**
- Modify: `app/(app)/modules/icp-analyse/page.tsx` (overschrijven; bestaat nog niet — zo ja, eerst checken)
- Create: `app/(app)/modules/icp-analyse/page.tsx`
- Create: `modules/icp-analyse/components/InputForm.tsx`

- [ ] **Step 1: Schrijf input-pagina (server component)**

Maak `app/(app)/modules/icp-analyse/page.tsx` (let op: huidige pad is `app/(app)/modules/website-check/page.tsx` — voor ICP nieuwe pagina):

```tsx
import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";
import { InputForm } from "@/modules/icp-analyse/components/InputForm";

export default async function ICPInputPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const myClients = await db
    .select({ id: clients.id, name: clients.name, websiteUrl: clients.websiteUrl })
    .from(clients)
    .where(eq(clients.userId, user.id))
    .orderBy(clients.name);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/modules"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar modules
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl bg-cyan-100 p-3 text-cyan-600">
          <UserCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Ideale Klant (ICP) Analyse</h1>
          <p className="text-gray-600">
            Definieer het ideale klantprofiel voor jouw product op basis van je website en
            een korte productomschrijving.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-8">
        <InputForm clients={myClients} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Schrijf InputForm (client component)**

Maak `modules/icp-analyse/components/InputForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startICPAnalysis,
  createClientForUser,
  checkExistingICP,
} from "@/app/(app)/modules/icp-analyse/actions";
import { RerunDialog } from "./RerunDialog";

type ClientOption = { id: string; name: string; websiteUrl: string | null };

export function InputForm({ clients }: { clients: ClientOption[] }) {
  const [mode, setMode] = useState<"existing" | "new">(
    clients.length > 0 ? "existing" : "new"
  );
  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id ?? ""
  );
  const [newClientName, setNewClientName] = useState("");
  const [newClientUrl, setNewClientUrl] = useState("");
  const [product, setProduct] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [rerunInfo, setRerunInfo] = useState<{ runAt: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    let clientId = selectedClientId;
    if (mode === "new") {
      try {
        const fd = new FormData();
        fd.set("name", newClientName);
        fd.set("websiteUrl", newClientUrl);
        const created = await createClientForUser(fd);
        clientId = created.id;
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Klant aanmaken mislukt");
        return;
      }
    }

    if (!clientId) {
      setErrorMsg("Kies een klant of maak een nieuwe aan.");
      return;
    }

    // Check op bestaande ICP voor dit product
    const existing = await checkExistingICP(clientId, product);
    if (existing.exists) {
      setRerunInfo({ runAt: existing.runAt! });
      // Wacht op gebruikerskeuze in RerunDialog
      return;
    }

    submitToServer(clientId, "new");
  }

  function submitToServer(clientId: string, runIntent: "new" | "replace" | "version" | "topic") {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("product", product);
    fd.set("productDescription", productDescription);
    fd.set("runIntent", runIntent);
    startTransition(() => {
      startICPAnalysis(fd);
    });
  }

  function handleRerunChoice(intent: "replace" | "version" | "topic") {
    setRerunInfo(null);
    submitToServer(selectedClientId, intent);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">Klant</legend>

          {clients.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`rounded-lg px-3 py-1 text-sm ${
                  mode === "existing"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Bestaande klant
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`rounded-lg px-3 py-1 text-sm ${
                  mode === "new" ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                + Nieuwe klant
              </button>
            </div>
          )}

          {mode === "existing" && clients.length > 0 ? (
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.websiteUrl ? `— ${c.websiteUrl}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Bedrijfsnaam"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                required={mode === "new"}
              />
              <Input
                type="url"
                placeholder="https://example.com"
                value={newClientUrl}
                onChange={(e) => setNewClientUrl(e.target.value)}
                required={mode === "new"}
              />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-900">Product / Dienst</legend>
          <Input
            placeholder="Naam van product of dienst"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            required
          />
          <textarea
            placeholder="Korte omschrijving (10-1000 tekens) — wat is het, voor wie?"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </fieldset>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Bezig met analyse..." : "Start ICP-analyse"}
        </Button>
      </form>

      {rerunInfo && (
        <RerunDialog
          previousRunAt={rerunInfo.runAt}
          product={product}
          onChoose={handleRerunChoice}
          onCancel={() => setRerunInfo(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Maak placeholder RerunDialog (Task 11 vult content)**

Maak `modules/icp-analyse/components/RerunDialog.tsx` als placeholder zodat InputForm typecheckt:

```tsx
"use client";

export function RerunDialog({
  previousRunAt,
  product,
  onChoose,
  onCancel,
}: {
  previousRunAt: string;
  product: string;
  onChoose: (intent: "replace" | "version" | "topic") => void;
  onCancel: () => void;
}) {
  // Placeholder — uitgewerkt in Task 11
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">Bestaande ICP gevonden</h2>
        <p className="mt-2 text-sm text-gray-600">
          Voor &ldquo;{product}&rdquo; is er al een analyse op{" "}
          {new Date(previousRunAt).toLocaleString("nl-NL")}.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button onClick={() => onChoose("replace")} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white">
            Vervangen (correctie)
          </button>
          <button onClick={() => onChoose("version")} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm text-white">
            Nieuwe versie over tijd
          </button>
          <button onClick={() => onChoose("topic")} className="rounded-lg border px-3 py-2 text-sm">
            Nieuw onderwerp (ander product, zelfde naam)
          </button>
          <button onClick={onCancel} className="text-xs text-gray-500">
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update registry — ICP active**

Modify `lib/modules/registry.ts`: zoek de `icp-analyse` entry en wijzig:

```ts
{
    slug: "icp-analyse",
    name: "Ideale Klant (ICP) Analyse",
    description:
      "Definieer uw ideale klantprofiel op basis van firmographics, pijnpunten en koopgedrag.",
    icon: UserCheck,
    color: "from-cyan-500 to-cyan-700",
    borderColor: "border-cyan-200",
    bgLight: "bg-cyan-50",
    iconColor: "text-cyan-600",
    status: "active",
    href: "/modules/icp-analyse",
  },
```

(De entry bestaat al; verander alleen `status: "soon"` → `status: "active"` en voeg `href` toe.)

- [ ] **Step 5: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 6: Verifieer in browser**

Login (als nog niet gelukt) → ga naar http://localhost:3000/modules — ICP-card moet "Start →" tonen.
Klik → http://localhost:3000/modules/icp-analyse moet form tonen.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/modules/icp-analyse
```

Verwacht: `200`.

- [ ] **Step 7: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add app/\(app\)/modules/icp-analyse modules/icp-analyse/components lib/modules/registry.ts && git commit -m "Add ICP input page + form + activate module in registry"
```

---

## Task 10: Resultaatpagina + ResultView + gedeelde componenten

**Files:**
- Create: `components/module-result/ResultBanner.tsx`
- Create: `components/module-result/ChipList.tsx`
- Create: `components/module-result/FactGrid.tsx`
- Create: `components/module-result/ServiceFocusCard.tsx`
- Create: `modules/icp-analyse/components/ResultView.tsx`
- Create: `app/(app)/modules/icp-analyse/[id]/page.tsx`

- [ ] **Step 1: ResultBanner**

Maak `components/module-result/ResultBanner.tsx`:

```tsx
export function ResultBanner({
  bedrijfsnaam,
  product,
  samenvatting,
  sectorPositie,
  scoreLabel,
  score,
  gradient = "from-cyan-500 to-cyan-700",
}: {
  bedrijfsnaam: string;
  product: string;
  samenvatting: string;
  sectorPositie: string;
  scoreLabel: string;
  score: number;
  gradient?: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-r ${gradient} p-6 text-white shadow-md`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide opacity-80">{bedrijfsnaam}</p>
          <h2 className="text-2xl font-bold">{product}</h2>
          <p className="mt-2 text-sm opacity-90">{samenvatting}</p>
          <span className="mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs">
            {sectorPositie}
          </span>
        </div>
        <div className="rounded-xl bg-white/20 px-4 py-3 text-center">
          <div className="text-3xl font-bold">{score}</div>
          <div className="text-xs opacity-80">{scoreLabel}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ChipList**

Maak `components/module-result/ChipList.tsx`:

```tsx
export function ChipList({
  title,
  items,
  variant = "default",
}: {
  title: string;
  items: string[];
  variant?: "default" | "warning";
}) {
  const chipBase =
    variant === "warning"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-gray-50 border-gray-200 text-gray-800";
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className={`rounded-full border px-3 py-1 text-xs ${chipBase}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: FactGrid**

Maak `components/module-result/FactGrid.tsx`:

```tsx
export function FactGrid({
  title,
  facts,
}: {
  title: string;
  facts: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs uppercase tracking-wide text-gray-500">{f.label}</dt>
            <dd className="text-sm text-gray-900">{f.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: ServiceFocusCard**

Maak `components/module-result/ServiceFocusCard.tsx`:

```tsx
export function ServiceFocusCard({
  kernBelofte,
  prijsindicatie,
  onderscheidend,
}: {
  kernBelofte: string;
  prijsindicatie: string;
  onderscheidend: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
      <h3 className="text-sm font-semibold text-cyan-900">Dienst-focus</h3>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-cyan-700">Kernbelofte</div>
          <p className="text-gray-900">{kernBelofte}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-cyan-700">Prijsindicatie</div>
          <p className="text-gray-900">{prijsindicatie}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-cyan-700">Onderscheidend</div>
          <p className="text-gray-900">{onderscheidend}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: ResultView**

Maak `modules/icp-analyse/components/ResultView.tsx`:

```tsx
import { ResultBanner } from "@/components/module-result/ResultBanner";
import { ChipList } from "@/components/module-result/ChipList";
import { FactGrid } from "@/components/module-result/FactGrid";
import { ServiceFocusCard } from "@/components/module-result/ServiceFocusCard";
import type { ICPOutput } from "@/modules/icp-analyse/schema";

export function ResultView({ data }: { data: ICPOutput }) {
  return (
    <div className="space-y-5">
      <ResultBanner
        bedrijfsnaam={data.bedrijfsnaam}
        product={data.product}
        samenvatting={data.banner.samenvatting}
        sectorPositie={data.banner.sectorPositie}
        scoreLabel="Website-rijkdom"
        score={data.banner.websiteAnalyseScore}
      />

      <FactGrid
        title="Firmografisch profiel"
        facts={[
          { label: "Sector", value: data.firmografisch.sector },
          { label: "Subsector", value: data.firmografisch.subsector },
          { label: "Bedrijfsgrootte", value: data.firmografisch.bedrijfsgrootte },
          { label: "Contactpersoon", value: data.firmografisch.contactpersoon },
          { label: "Beslisser", value: data.firmografisch.beslisser },
          { label: "Contractwaarde", value: data.firmografisch.contractwaarde },
          { label: "Geografie", value: data.firmografisch.geografie },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <ChipList title="Pijnpunten" items={data.pijnpunten} variant="warning" />
        <ChipList title="Triggers (kopen-events)" items={data.triggers} />
      </div>

      <ServiceFocusCard
        kernBelofte={data.dienstFocus.kernBelofte}
        prijsindicatie={data.dienstFocus.prijsindicatie}
        onderscheidend={data.dienstFocus.onderscheidend}
      />
    </div>
  );
}
```

- [ ] **Step 6: Resultaatpagina**

Maak `app/(app)/modules/icp-analyse/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { ResultView } from "@/modules/icp-analyse/components/ResultView";
import { ICPOutput } from "@/modules/icp-analyse/schema";

export default async function ICPResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!session) notFound();
  if (session.userId !== user.id) notFound();
  if (session.moduleSlug !== "icp-analyse") notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/modules/icp-analyse"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> Nieuwe analyse
      </Link>

      <div className="mt-6">
        {session.status === "running" && (
          <RunningState />
        )}
        {session.status === "failed" && (
          <FailedState message={session.errorMessage ?? "Onbekende fout"} />
        )}
        {(session.status === "review" || session.status === "approved" || session.status === "draft") && session.output && (
          <ResultView data={ICPOutput.parse(session.output)} />
        )}
      </div>
    </div>
  );
}

function RunningState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-12 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
      <p className="mt-4 text-sm text-cyan-900">Analyse wordt uitgevoerd... pagina ververst zich automatisch.</p>
      <meta httpEquiv="refresh" content="3" />
    </div>
  );
}

function FailedState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-900">Analyse mislukt</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <Link href="/modules/icp-analyse" className="mt-4 inline-block text-sm text-red-700 underline">
        Probeer opnieuw
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && pnpm typecheck
```

Verwacht: geen errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && git add components/module-result modules/icp-analyse/components/ResultView.tsx app/\(app\)/modules/icp-analyse/\[id\] && git commit -m "Add ICP result view + shared module-result components"
```

---

## Task 11: End-to-end browser-verificatie

**Files:** geen wijzigingen — alleen handmatige verificatie van het volledige pad.

- [ ] **Step 1: Server live**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/modules/icp-analyse
```

Verwacht: `200`. Als niet: check `/Users/olivierarnolds/Desktop/positionr-app` dev-server draait via `lsof -iTCP:3000 -sTCP:LISTEN`.

- [ ] **Step 2: Run flow handmatig**

Open in browser, ingelogd:
1. http://localhost:3000/modules — ICP-card heeft "Start →"
2. Klik → input-pagina
3. Mode = "+ Nieuwe klant" als nog geen klanten; vul in:
   - Bedrijfsnaam: "Datapas"
   - Website-URL: "https://datapas.nl"
   - Product: "Datapas Cloud"
   - Productomschrijving: "SaaS-platform voor datapaspoorten in MKB-financieel."
4. Klik "Start ICP-analyse"
5. Browser navigeert naar `/modules/icp-analyse/<uuid>` — eerst loading, dan result
6. Verifieer 4 secties: banner, firmografisch, twee chip-lijsten, dienst-focus

- [ ] **Step 3: Verifieer DB-state**

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
Promise.all([
  sql\`select id, name, website_url, jsonb_pretty(facts) as facts from clients order by created_at desc limit 1\`,
  sql\`select id, status, module_slug, llm_input_tokens, llm_output_tokens, llm_cost_cents from sessions order by created_at desc limit 1\`
]).then(([cs, ss]) => { console.log('CLIENT:', cs[0]); console.log('SESSION:', ss[0]); return sql.end(); });
"
```

Verwacht:
- 1 rij in `clients` met `facts` JSON met `icp` array (1 entry) en `website_snapshot`
- 1 rij in `sessions` met `status='review'`, `llm_input_tokens > 0`, `llm_cost_cents > 0`

- [ ] **Step 4: Verifieer rerun-flow**

Ga terug naar `/modules/icp-analyse`. Kies bestaande klant "Datapas". Vul zelfde product "Datapas Cloud" in (zelfde omschrijving mag). Klik start.
- Verwacht: RerunDialog verschijnt met 3 opties.
- Kies "Vervangen (correctie)".
- Verwacht: nieuwe analyse start, redirect naar nieuw resultaat.
- DB-check (herhaal Step 3): `clients.facts.icp` heeft nog steeds 1 entry maar met nieuwe `sessionId`. `sessions` heeft nu 2 rijen.

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`select count(*) from sessions where module_slug='icp-analyse'\`
  .then(r => { console.log('icp sessions:', r[0].count); return sql\`select jsonb_array_length(facts->'icp') as icp_count from clients order by created_at desc limit 1\`; })
  .then(r => { console.log('icp facts entries (laatst aangemaakte klant):', r[0].icp_count); return sql.end(); });
"
```

Verwacht: `icp sessions: 2`, `icp facts entries: 1`.

- [ ] **Step 5: Verifieer rerun met nieuw onderwerp**

Zelfde klant Datapas, product = "Datapas On-Prem" (nieuw), omschrijving "On-premise variant voor banken". Submit zonder dialog (geen bestaande entry).
- Verwacht: redirect naar resultaatpagina, DB heeft 3 sessions, facts.icp heeft 2 entries.

```bash
cd /Users/olivierarnolds/Desktop/positionr-app && node -e "
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`select jsonb_array_length(facts->'icp') as icp_count, facts->'icp' as entries from clients order by created_at desc limit 1\`
  .then(r => { console.log(r[0]); return sql.end(); });
"
```

Verwacht: `icp_count: 2`, en in `entries` zie je `Datapas Cloud` + `Datapas On-Prem`.

- [ ] **Step 6: Optioneel — test failure-pad**

Maak een nieuwe klant met onbereikbare URL (`https://nietbestaand-zzzzz.invalid`). Submit — verwacht resultaatpagina met error-state ("Kon ... niet ophalen").

- [ ] **Step 7: Commit alleen als er hier nog code-wijzigingen waren**

(Geen wijzigingen verwacht — verificatie is alleen lezen.)

---

## Self-Review

**Spec coverage check:**

| Spec § | Behandeld in | OK |
|---|---|---|
| §2 Klant-hub model | Task 1, 7 | ✓ |
| §3 DB-wijzigingen | Task 1, 2 | ✓ |
| §4 Module-folder | Tasks 4, 5, 6, 7, 9, 10 | ✓ |
| §5 Output-schema | Task 4 | ✓ |
| §6a Input-pagina | Task 9 | ✓ |
| §6b Server action | Task 7, 8 | ✓ |
| §6c Resultaatpagina | Task 10 | ✓ |
| §7 AI-laag | Task 3 | ✓ |
| §8 Scraper | Task 5 | ✓ |
| §10 Bestandswijzigingen | Tasks 1-10 | ✓ |
| §11 Acceptance criteria | Task 11 | ✓ |

**Placeholder scan:** geen TBD/TODO/"vergelijkbaar met"-verwijzingen. Code-blokken volledig.

**Type-consistency:** `ICPInput`, `ICPOutput`, `ICPFactEntry`, `WebsiteSnapshot`, `RunIntent` consistent gebruikt over schema.ts → service.ts → actions.ts → ResultView. Function-namen: `runICPAnalysis`, `findExistingICP`, `startICPAnalysis`, `createClientForUser`, `checkExistingICP`, `analyzeWithCachedSystem`, `scrapeForIcp`, `buildSystemPrompt`, `buildUserPrompt` — allemaal eenduidig.

**Bekende beperkingen / opmerkingen:**

- RerunDialog is in Task 9 als directe UI-component opgenomen (niet als losse Task 11) — speelde simpeler uit. Spec genoemde "Task 12 voor RerunDialog" is samengevoegd.
- `pnpm db:push` zal vragen om bevestiging voor schema-wijzigingen in dev — bij prod gebruiken we `db:migrate` met gegenereerde files (latere zorg).
- Resultaatpagina gebruikt `meta http-equiv="refresh"` voor running-state polling. Werkt, maar voor productie zou een client-side polling met `useSWR` netter zijn — buiten scope.
- Bij failure tijdens scraping landt de gebruiker via redirect op `/modules/icp-analyse?error=...` (server action throws → catch in actions.ts redirects). Bij failure binnen `runICPAnalysis` zelf (na sessie-creatie) komt de gebruiker op de resultaatpagina met `status: failed`. Twee paden, beide afgevangen.
