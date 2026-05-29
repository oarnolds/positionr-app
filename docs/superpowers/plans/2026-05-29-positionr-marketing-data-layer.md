# Positionr Marketingsite — PR 1: Data-laag — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leg het databasefundament + de bedrijfslogica voor abonnementen en leads, zodat latere PR's (marketing-pagina's, gratis check, Mollie, tier-gating) erop kunnen bouwen.

**Architecture:** Pure, geteste TypeScript-helpers (`lib/plans/`) voor tier-vergelijking en actief-abonnement-bepaling, plus Drizzle-schema-uitbreidingen (`subscriptions`- en `leads`-tabel, `min_tier`-kolom op `modules`) met RLS volgens het bestaande projectpatroon. Prijzen/tiers staan in een configuratiebestand, geen DB-tabel.

**Tech Stack:** Next.js 15, Drizzle ORM (postgres-js), Supabase/Postgres, Vitest. Geen nieuwe dependencies in deze PR.

**Scope-grens:** Deze PR raakt **geen UI**, geen Mollie, geen seed-logica. De `min_tier`-waarde per module (welke module bij welke tier hoort) wordt in PR 5 (tier-gating) gezet; hier krijgt de kolom alleen de default `basis`.

**Verificatie zonder DB:** Alle tests en `pnpm typecheck` draaien offline (tests zijn puur / mocken niets externs). Alleen Taak 5 (schema toepassen) vereist een werkende `.env.local` met `DATABASE_URL` en wordt door Olivier in Supabase uitgevoerd.

---

### Task 1: Plannen-registry + tier-vergelijking

Eén bron van waarheid voor de drie tiers (Basis/Pro/Premium), hun prijzen (maand + jaar), en de cumulatieve tier-vergelijking.

**Files:**
- Create: `lib/plans/registry.ts`
- Test: `lib/plans/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/plans/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PLANS,
  TIER_ORDER,
  tierAllows,
  getPlan,
  type Tier,
} from "./registry";

describe("PLANS registry", () => {
  it("bevat precies drie tiers: basis, pro, premium", () => {
    expect(PLANS.map((p) => p.slug)).toEqual(["basis", "pro", "premium"]);
  });

  it("heeft voor elk plan positieve maand- en jaarprijzen en minstens 1 feature", () => {
    for (const plan of PLANS) {
      expect(plan.monthlyPriceCents).toBeGreaterThan(0);
      expect(plan.yearlyPriceCents).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });

  it("jaarprijs is voordeliger dan 12x de maandprijs (incentive)", () => {
    for (const plan of PLANS) {
      expect(plan.yearlyPriceCents).toBeLessThan(plan.monthlyPriceCents * 12);
    }
  });

  it("getPlan vindt een plan op slug en geeft undefined voor onbekend", () => {
    expect(getPlan("pro")?.name).toBeDefined();
    expect(getPlan("onbekend" as Tier)).toBeUndefined();
  });
});

describe("tierAllows", () => {
  it("staat gelijke tier toe", () => {
    expect(tierAllows("basis", "basis")).toBe(true);
    expect(tierAllows("premium", "premium")).toBe(true);
  });

  it("staat hogere tier toe bij lagere eis (cumulatief)", () => {
    expect(tierAllows("premium", "basis")).toBe(true);
    expect(tierAllows("pro", "basis")).toBe(true);
    expect(tierAllows("premium", "pro")).toBe(true);
  });

  it("weigert lagere tier bij hogere eis", () => {
    expect(tierAllows("basis", "pro")).toBe(false);
    expect(tierAllows("pro", "premium")).toBe(false);
  });

  it("weigert wanneer de gebruiker geen tier heeft (null)", () => {
    expect(tierAllows(null, "basis")).toBe(false);
  });

  it("TIER_ORDER is oplopend van goedkoop naar duur", () => {
    expect(TIER_ORDER).toEqual(["basis", "pro", "premium"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/plans/registry.test.ts`
Expected: FAIL — "Cannot find module './registry'".

- [ ] **Step 3: Write minimal implementation**

Maak `lib/plans/registry.ts`:

```ts
/**
 * Bron van waarheid voor de abonnementsplannen.
 * Prijzen zijn VOORLOPIG (Olivier stelt definitieve prijzen vast na validatie).
 * Wijzigen = dit bestand aanpassen, geen DB-migratie.
 */

export type Tier = "basis" | "pro" | "premium";

/** Oplopend van goedkoop → duur. Index = rang voor cumulatieve toegang. */
export const TIER_ORDER: Tier[] = ["basis", "pro", "premium"];

export type Plan = {
  slug: Tier;
  name: string;
  tagline: string;
  monthlyPriceCents: number; // doorlopend, per maand
  yearlyPriceCents: number; // eenmalig, 12 maanden toegang
  features: string[];
};

export const PLANS: Plan[] = [
  {
    slug: "basis",
    name: "Basis",
    tagline: "Voor wie zelf aan de slag wil.",
    monthlyPriceCents: 14900,
    yearlyPriceCents: 149000,
    features: ["Website Check", "Onbeperkt analyses", "E-mailsupport"],
  },
  {
    slug: "pro",
    name: "Pro",
    tagline: "Voor groeiende B2B-bedrijven.",
    monthlyPriceCents: 24900,
    yearlyPriceCents: 249000,
    features: ["Alles uit Basis", "ICP-analyse", "LinkedIn-analyse"],
  },
  {
    slug: "premium",
    name: "Premium",
    tagline: "Alle modules, maximale grip.",
    monthlyPriceCents: 39900,
    yearlyPriceCents: 399000,
    features: ["Alles uit Pro", "Alle modules", "Prioriteit-support"],
  },
];

export function getPlan(slug: Tier): Plan | undefined {
  return PLANS.find((p) => p.slug === slug);
}

/** Mag een gebruiker met `userTier` iets met vereiste `minTier` openen? Cumulatief. */
export function tierAllows(userTier: Tier | null, minTier: Tier): boolean {
  if (!userTier) return false;
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/plans/registry.test.ts`
Expected: PASS (alle tests groen).

- [ ] **Step 5: Commit**

```bash
git add lib/plans/registry.ts lib/plans/registry.test.ts
git commit -m "feat(plans): tier-registry (Basis/Pro/Premium) + tierAllows"
```

---

### Task 2: Actief-abonnement-logica

Pure bepaling of een abonnement actief is en welke tier het geeft, los van de DB-fetch (zodat het volledig testbaar is). Plus een dunne DB-wrapper.

**Files:**
- Create: `lib/plans/subscription.ts`
- Test: `lib/plans/subscription.test.ts`

- [ ] **Step 1: Write the failing test**

Maak `lib/plans/subscription.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activeTier, type SubscriptionState } from "./subscription";

const NOW = new Date("2026-06-01T12:00:00Z");
const FUTURE = new Date("2026-07-01T12:00:00Z");
const PAST = new Date("2026-05-01T12:00:00Z");

function sub(partial: Partial<SubscriptionState>): SubscriptionState {
  return {
    tier: "pro",
    status: "active",
    currentPeriodEnd: FUTURE,
    ...partial,
  };
}

describe("activeTier", () => {
  it("geeft de tier bij status=active en periode in de toekomst", () => {
    expect(activeTier(sub({ tier: "pro" }), NOW)).toBe("pro");
    expect(activeTier(sub({ tier: "premium" }), NOW)).toBe("premium");
  });

  it("geeft null wanneer de periode verlopen is (bv. jaar afgelopen)", () => {
    expect(activeTier(sub({ currentPeriodEnd: PAST }), NOW)).toBeNull();
  });

  it("geeft null bij status past_due (mislukte incasso)", () => {
    expect(activeTier(sub({ status: "past_due" }), NOW)).toBeNull();
  });

  it("geeft null bij status canceled of expired", () => {
    expect(activeTier(sub({ status: "canceled" }), NOW)).toBeNull();
    expect(activeTier(sub({ status: "expired" }), NOW)).toBeNull();
  });

  it("behandelt periode-einde exact op nu als verlopen", () => {
    expect(activeTier(sub({ currentPeriodEnd: NOW }), NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/plans/subscription.test.ts`
Expected: FAIL — "Cannot find module './subscription'".

- [ ] **Step 3: Write minimal implementation**

Maak `lib/plans/subscription.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptions } from "@/lib/db/schema";
import type { Tier } from "./registry";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export type SubscriptionState = {
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
};

/**
 * Pure bepaling: welke tier geeft dit abonnement NU? null = geen toegang.
 * Actief = status 'active' EN periode-einde strikt na `now`.
 * Dekt zowel maand (status bijgewerkt door webhook) als jaar (verloopt op datum).
 */
export function activeTier(sub: SubscriptionState, now: Date): Tier | null {
  if (sub.status !== "active") return null;
  if (sub.currentPeriodEnd.getTime() <= now.getTime()) return null;
  return sub.tier;
}

/**
 * Dunne DB-wrapper: haalt het abonnement van de gebruiker op en past `activeTier` toe.
 * (Geverifieerd via de gating-smoke-test in PR 5; de logica zelf is getest in activeTier.)
 */
export async function getActiveSubscription(
  userId: string,
): Promise<{ tier: Tier } | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!row) return null;

  const tier = activeTier(
    {
      tier: row.tier,
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd,
    },
    new Date(),
  );

  return tier ? { tier } : null;
}
```

> NB: `getActiveSubscription` importeert `subscriptions` uit het schema — die tabel wordt in Taak 3 toegevoegd. De typecheck van dit bestand slaagt pas ná Taak 3. De **unit-test** (alleen `activeTier`) slaagt nu al, want die importeert geen DB.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/plans/subscription.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/plans/subscription.ts lib/plans/subscription.test.ts
git commit -m "feat(plans): activeTier-logica + getActiveSubscription-wrapper"
```

---

### Task 3: Drizzle-schema — enums, subscriptions, leads, min_tier

**Files:**
- Modify: `lib/db/schema.ts` (enums bovenaan bij de andere `pgEnum`'s; `min_tier` op `modules`; nieuwe tabellen + types onderaan)

- [ ] **Step 1: Voeg de enums toe**

In `lib/db/schema.ts`, bij de bestaande enums (na `providerEnum`), toevoegen:

```ts
export const tierEnum = pgEnum("tier", ["basis", "pro", "premium"]);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "yearly",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "expired",
]);
```

- [ ] **Step 2: Voeg `minTier` toe aan de bestaande `modules`-tabel**

In de `modules`-tabeldefinitie, een veld toevoegen (na `provider`):

```ts
  minTier: tierEnum("min_tier").default("basis").notNull(),
```

- [ ] **Step 3: Voeg de `subscriptions`- en `leads`-tabellen + types toe**

Onderaan `lib/db/schema.ts`, vóór de `// ── Types ──`-sectie (of bij de andere tabellen):

```ts
// ── Subscriptions ───────────────────────────────────────────────────
// 1-op-1 met auth.users. Waarheid voor portal-toegang + tier-niveau.

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(), // = auth.users.id
  tier: tierEnum("tier").notNull(),
  interval: billingIntervalEnum("interval").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  currentPeriodEnd: timestamp("current_period_end", {
    withTimezone: true,
  }).notNull(),
  mollieCustomerId: text("mollie_customer_id"),
  mollieSubscriptionId: text("mollie_subscription_id"), // alleen bij 'monthly'
  molliePaymentId: text("mollie_payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Leads ───────────────────────────────────────────────────────────
// Uit de publieke gratis Website Check. Server-side ingevoegd (service-role).

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

En bij de `// ── Types ──`-sectie de exports toevoegen:

```ts
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```

> `uuid`, `text`, `timestamp`, `jsonb`, `pgTable`, `pgEnum` worden al geïmporteerd
> bovenaan `schema.ts` — geen import-wijziging nodig.

- [ ] **Step 4: Verifieer met typecheck**

Run: `pnpm typecheck`
Expected: PASS — geen type-errors. Dit bevestigt ook dat `getActiveSubscription` uit Taak 2 nu correct typecheckt (de `subscriptions`-tabel bestaat nu).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(db): subscriptions + leads tabellen, min_tier op modules"
```

---

### Task 4: RLS-policies

Volgt exact het patroon uit `drizzle/0001_rls.sql` en `drizzle/0002_clients_rls.sql`. Client-toegang is read-only op de eigen rij; schrijven gebeurt server-side met de service-role-key (die RLS bypasst).

**Files:**
- Create: `drizzle/0006_subscriptions_leads_rls.sql`

- [ ] **Step 1: Maak het RLS-bestand**

Maak `drizzle/0006_subscriptions_leads_rls.sql`:

```sql
-- Row Level Security voor subscriptions + leads.
-- Run dit ná `pnpm db:push` in de Supabase SQL editor.

-- ── subscriptions ───────────────────────────────────────────
-- Gebruiker leest eigen abonnement; admins alles.
-- Schrijven gebeurt uitsluitend server-side (service-role bypasst RLS).
alter table subscriptions enable row level security;

create policy "users see own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

create policy "admins manage all subscriptions"
  on subscriptions for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ── leads ───────────────────────────────────────────────────
-- Geen client-toegang. Insert/select alleen via service-role of admin.
alter table leads enable row level security;

create policy "admins read leads"
  on leads for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add drizzle/0006_subscriptions_leads_rls.sql
git commit -m "feat(db): RLS-policies voor subscriptions + leads"
```

---

### Task 5: Schema toepassen op Supabase (door Olivier)

Dit is de enige stap die een werkende DB-verbinding vereist. **Olivier voert dit uit** (Claude doet geen destructieve/DB-acties zelf).

**Voorwaarde:** `.env.local` met geldige `DATABASE_URL` (Supabase connection string).

- [ ] **Step 1: Schema pushen naar Supabase**

Run: `pnpm db:push`
Expected: drizzle-kit meldt de nieuwe enums (`tier`, `billing_interval`, `subscription_status`), de nieuwe kolom `modules.min_tier`, en de tabellen `subscriptions` + `leads` als toe te voegen → bevestigen.

- [ ] **Step 2: RLS toepassen**

Open de Supabase SQL editor en plak de volledige inhoud van
`drizzle/0006_subscriptions_leads_rls.sql`. Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verifieer de tabellen en RLS**

Run in de Supabase SQL editor:

```sql
select table_name, row_security
from information_schema.tables
where table_name in ('subscriptions', 'leads');
```

Expected: beide tabellen aanwezig met `row_security = 'YES'`.

```sql
select column_name, data_type from information_schema.columns
where table_name = 'modules' and column_name = 'min_tier';
```

Expected: één rij — `min_tier | USER-DEFINED` (de `tier`-enum).

---

## Self-review (na voltooiing PR 1)

- [ ] `pnpm test` — alle tests groen (registry + subscription + bestaande suites).
- [ ] `pnpm typecheck` — geen type-errors.
- [ ] Geen secrets/credentials toegevoegd aan de repo.
- [ ] `subscriptions`, `leads` + `modules.min_tier` bestaan in Supabase met RLS aan.
- [ ] Geen regressie: bestaande tests die vóór deze PR groen waren, blijven groen.

## Wat deze PR NIET doet (volgende PR's)

- Marketing-pagina's, prijzenpagina, gratis check, checkout → PR 2–4.
- Mollie-integratie + account-provisioning → PR 4.
- `min_tier` per module zetten + tier-gating in de portal + `/account`-beheer → PR 5.
