# Positionr Marketingsite + Abonnementen — ontwerp (v1)

- **Datum:** 2026-05-28
- **Status:** Ontwerp ter review (nog niet goedgekeurd)
- **Repo:** `oarnolds/positionr-app` (Next.js App Router, Supabase, Drizzle, Claude)
- **Referentie (blauwdruk):** `oarnolds/smb-marketing-hub` — Manus-prototype
  "Je Marketingvrienden" met Home, Subscriptions (Basis/Pro/Premium), Register +
  vragenlijst, tool-matrix. **We porten het idee/ontwerp, niet de code** (andere
  stack: Vite + tRPC + MySQL). Visuele referentie + tier-structuur komen hiervandaan.
- **Strategische context:** `~/Desktop/Positionr/ANALYSE_BUSINESSMODEL.md` +
  `MODULES_ANALYSE.md`. Kernpunt: businessmodel/prijzen zijn bewust **nog niet
  gevalideerd**; advies is "valideer betalingsbereidheid met een wedge-module
  vóór je breed bouwt". Daarom: prijzen/tiers **configureerbaar**, niet
  vastgemetseld. Website Check is de aangewezen wedge-module (laagste drempel).

---

## 1. Doel & context

Positionr heeft een portal (deze repo) met AI-marketinganalyses (Website Check
actief, ICP in de maak), maar **geen publieke website**. De analyse noemt dit
expliciet als gat ("schoenmaker zonder schoenen"). We bouwen de site waar
ondernemers naartoe getrokken worden, een abonnement afsluiten (betaling via
**Mollie**) en doorklikken naar de portal.

De funnel:

```
positionr.nl  →  gratis Website Check (lead-capture)  →  /prijzen  →  /checkout
   →  Mollie-betaling  →  (webhook) account + abonnement aangemaakt
   →  magic-link per mail  →  app.positionr.nl (portal, modules op tier-niveau)
```

Architectuur is al beslist: **alles in deze ene Next.js-app**, marketing als
publieke route-groep. Eén codebase, één login, abonnement direct naast de
gebruiker.

## 2. Scope

We bouwen **wedge-eerst, gefaseerd** (afgestemd met Olivier).

**In fase 1 (deze spec)**

- Data-laag: `plans`-registry (code), `subscriptions`-tabel, `leads`-tabel,
  `min_tier`-kolom op `modules` + registry-meta. RLS volgens projectpatroon.
- Publieke route-groep `app/(marketing)/`: landing (`/`), `/prijzen`,
  `/gratis-check`, `/checkout`, `/checkout/bedankt`, `/voorwaarden`, `/privacy`.
- Middleware: marketing-routes + gratis-check + Mollie-webhook publiek; portal
  blijft achter login.
- **Gratis Website Check** publiek (e-mail vóór uitslag → lead opgeslagen →
  bestaande score-output getoond → CTA naar `/prijzen`).
- **Mollie-checkout** met twee betaalvormen per tier:
  - **maand** = doorlopend (mandaat + maandelijkse auto-incasso)
  - **jaar** = eenmalig bedrag, 12 maanden toegang, daarna handmatig verlengen
- **Webhook** (`/api/mollie/webhook`): idempotent, haalt status op bij Mollie,
  maakt bij betaald: Supabase-gebruiker (indien nieuw) + `subscriptions`-rij +
  (maand) Mollie-abonnement + verstuurt magic-link.
- **Tier-gating** in de portal: modules tonen op slot als de tier te laag is /
  geen actief abonnement → upgrade-CTA.
- Abonnementbeheer op `/account` (tier + status + periode-einde + opzeggen).
- Branding: strakke professionele look afgeleid van de blauwdruk, met
  plaatshouders voor logo/kleur. Tiers: Basis / Pro / Premium.
- Tests (vitest): tier-vergelijking, plan-registry, webhook-handler (Mollie
  gemockt), lead-opslag, provisioning-flow.

**Fase 2 (latere spec, buiten deze)**

- Contentpagina's: `/functies` (modules uitgelegd), `/over`, `/contact`.
- Blog/resources als MDX-pagina's in de repo (SEO), geen apart CMS.
- Extra modules ontsluiten per tier zodra ze productierijp zijn.

**Buiten scope (bewust niet)**

- Automatische jaarverlenging (jaar = eenmalig, handmatig verlengen in fase 1).
- Meerdere seats/teamleden per abonnement (1 gebruiker = 1 abonnement).
- Kortingscodes/coupons, proefperiode (trial). Gratis check ís het lokkertje.
- Facturen/boekhoudkoppeling (Mollie levert betaalbewijs; facturatie later).

## 3. Architectuur: route-zones & domeinen

### 3.1 Route-groepen

```
app/
  (marketing)/              ← NIEUW, publiek
    layout.tsx              ← marketing-header + footer (los van portal-chrome)
    page.tsx                ← landing (vervangt huidige placeholder app/page.tsx)
    prijzen/page.tsx
    gratis-check/page.tsx   ← + result-weergave
    checkout/page.tsx
    checkout/bedankt/page.tsx
    voorwaarden/page.tsx
    privacy/page.tsx
  (app)/                    ← bestaand, achter login → krijgt tier-gating
  (admin)/                  ← bestaand
  api/
    mollie/webhook/route.ts ← NIEUW, publiek (Mollie roept aan)
```

De huidige `app/page.tsx` (kale placeholder) verhuist naar de marketing-groep
en wordt de echte landing.

### 3.2 Middleware

`lib/supabase/middleware.ts` heeft al een `isPublic`-check. We breiden die uit
met de marketing-paden + de webhook:

```ts
const isPublic =
  path === "/" ||
  path.startsWith("/prijzen") ||
  path.startsWith("/gratis-check") ||
  path.startsWith("/checkout") ||
  path.startsWith("/voorwaarden") ||
  path.startsWith("/privacy") ||
  path.startsWith("/login") ||
  path.startsWith("/auth") ||
  path.startsWith("/api/mollie") ||   // webhook
  path.startsWith("/_next") ||
  path.startsWith("/favicon");
```

(De `/preview`-regel kan blijven of weg — niet relevant voor deze spec.)

### 3.3 Domeinen

- `positionr.nl` → marketing (root van deze app).
- `app.positionr.nl` → portal (zelfde app; de `(app)`/`(admin)`-routes).
- Eén Vercel-deploy serveert beide; verschil is puur welk pad/host. Links:
  "Inloggen" → `/login`, "Start gratis" → `/gratis-check`, "Word lid" →
  `/prijzen`. `NEXT_PUBLIC_APP_URL` blijft de canonieke app-URL voor
  magic-link-redirects.

> Aanname: `positionr.nl` is/wordt van Olivier. Registratie + DNS (incl. Mollie
> en Supabase redirect-URLs) is een externe afhankelijkheid, geen code.

## 4. Data-laag

### 4.1 Plannen als configuratie (geen tabel)

Conform het bestaande "registry als bron van waarheid"-patroon
(`lib/modules/registry.ts`) komen de plannen in `lib/plans/registry.ts`. Prijzen
staan hier op één plek; prijzenpagina én checkout lezen hieruit.

```ts
export type Tier = "basis" | "pro" | "premium";
export const TIER_ORDER: Tier[] = ["basis", "pro", "premium"]; // oplopend

export type Plan = {
  slug: Tier;
  name: string;
  tagline: string;
  monthlyPriceCents: number;   // bv. 14900
  yearlyPriceCents: number;    // bv. 149000 (eenmalig, 12 mnd)
  features: string[];          // bullets voor de prijzenpagina
};

export const PLANS: Plan[] = [ /* Basis, Pro, Premium — prijzen invulbaar */ ];

/** Mag een gebruiker met `userTier` een module met `minTier` openen? */
export function tierAllows(userTier: Tier | null, minTier: Tier): boolean {
  if (!userTier) return false;
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier);
}
```

> Prijzen zijn **plaatshouders** tot Olivier ze (na validatie) vaststelt.
> Wijzigen = één bestand aanpassen, geen migratie.

### 4.2 DB-migratie (Drizzle / Postgres)

```sql
CREATE TYPE tier_enum AS ENUM ('basis', 'pro', 'premium');
CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'expired');

-- Modules: minimaal vereiste tier (cumulatief; premium ziet alles)
ALTER TABLE modules
  ADD COLUMN min_tier tier_enum NOT NULL DEFAULT 'basis';

-- Abonnement per gebruiker (1-op-1 met auth.users)
CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE,          -- = auth.users.id
  tier                   tier_enum NOT NULL,
  interval               billing_interval NOT NULL,
  status                 subscription_status NOT NULL DEFAULT 'active',
  current_period_end     timestamptz NOT NULL,          -- toegang geldig t/m
  mollie_customer_id     text,
  mollie_subscription_id text,                          -- alleen bij 'monthly'
  mollie_payment_id      text,                          -- laatste/initiële betaling
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON subscriptions(user_id);

-- Leads uit de gratis Website Check (publiek, server-side ingevoegd)
CREATE TABLE leads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  website_url  text NOT NULL,
  result       jsonb,                                   -- output van de check
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_email_idx ON leads(email);
```

### 4.3 RLS (volgt `drizzle/0001_rls.sql`)

```sql
-- subscriptions: gebruiker leest eigen rij; admins alles. Schrijven gebeurt
-- alleen server-side met de service-role-key (webhook) → die bypasst RLS.
alter table subscriptions enable row level security;

create policy "users see own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

create policy "admins see all subscriptions"
  on subscriptions for all
  using (exists (select 1 from profiles
                 where profiles.id = auth.uid() and profiles.role = 'admin'));

-- leads: geen client-toegang. Insert/select uitsluitend via service-role
-- (gratis-check server action + admin). RLS aan, géén policy voor 'authenticated'.
alter table leads enable row level security;
create policy "admins read leads"
  on leads for select
  using (exists (select 1 from profiles
                 where profiles.id = auth.uid() and profiles.role = 'admin'));
```

`modules` heeft al RLS (public read / admin write) — `min_tier` erft dat, geen
wijziging nodig. De bestaande `handle_new_user`-trigger maakt automatisch een
`profiles`-rij bij elke nieuwe `auth.users` — daar leunt de provisioning op.

## 5. De funnel & pagina's

### 5.1 Landing (`/`)

Hero (kop + subkop + "Start gratis"-knop → `/gratis-check`, secundair
"Inloggen"), waardepropositie, korte uitleg van de modules (uit de
module-registry), social proof (plaatshouders), prijzen-teaser → `/prijzen`,
footer met juridische links. Visueel afgeleid van de blauwdruk; portal-stijl
(blauw/paars gradient) als basis.

### 5.2 Gratis Website Check (`/gratis-check`) — de "trek"

1. Formulier: **e-mail + website-URL** (e-mail vóór uitslag = lead-capture).
2. Server action (service-role): valideer → **insert `leads`** → draai de
   Website-Check-analyse → schrijf `result` terug op de lead-rij.
3. Toon de bestaande score-output (paarse banner + score-grid per onderdeel) via
   de bestaande `components/module-result/*`.
4. CTA onder de uitslag: *"Wil je ook ICP-analyse, LinkedIn-check en meer? Word
   lid →"* naar `/prijzen`.

**Hergebruik zonder sessie:** de huidige Website-Check-service schrijft naar
`sessions` (vereist `user_id`). We extraheren de analyse-kern tot een pure
functie `analyzeWebsite(url): Promise<WebsiteCheckOutput>` (scrape → prompt →
`analyze` → gevalideerde output). De ingelogde module blijft die output in een
`sessions`-rij persisteren; de gratis check persisteert 'm op `leads.result`.
Geen schema-wijziging aan `sessions`.

**Misbruik/kosten:** elke run kost LLM-tokens. Rate-limit per e-mail+IP
(bv. max 3/dag) in de server action; bij overschrijding nette melding.

### 5.3 Prijzen (`/prijzen`)

Drie tier-kaarten (Basis/Pro/Premium) uit `PLANS`, met een **maand/jaar-schakelaar**
die de getoonde prijs en de checkout-parameter omzet. "Kies dit plan" →
`/checkout?plan=<tier>&interval=<monthly|yearly>`.

### 5.4 Checkout (`/checkout`)

Formulier: e-mail + bedrijfsnaam (optioneel KvK/contactpersoon — minimaal in
fase 1). Toont gekozen plan + interval + prijs. "Afrekenen" → server action die
de Mollie-betaling start (zie §6) en doorstuurt naar de Mollie-betaalpagina.

### 5.5 Bedankt (`/checkout/bedankt`)

Retour-URL van Mollie. Toont: *"Gelukt — check je mail voor de inloglink"* +
knop "Mail niet ontvangen? Opnieuw sturen" (roept `sendMagicLink` aan). Bij
afgebroken/mislukte betaling: nette melding + "Opnieuw proberen" → `/prijzen`.

### 5.6 Juridisch (`/voorwaarden`, `/privacy`)

Statische MDX/JSX-pagina's. Nodig vóór live (betaalproduct + e-mailopslag/AVG).

## 6. Mollie-integratie

API-key uit `MOLLIE_API_KEY` (server-only). Twee paden, beide gestart vanuit de
checkout-server-action; metadata draagt `planSlug`, `interval`, `email`.

### 6.1 Maand (doorlopend)

1. **Klant** aanmaken: `POST /v2/customers` (email, naam).
2. **Eerste betaling**: `POST /v2/payments` met `customerId`,
   `sequenceType: "first"`, bedrag = `monthlyPriceCents`, `redirectUrl` →
   `/checkout/bedankt`, `webhookUrl` → `/api/mollie/webhook`, `metadata`.
3. Redirect klant naar `payment._links.checkout`.
4. **Webhook** (betaald + `sequenceType=first`): mandaat is nu geldig →
   `POST /v2/customers/{id}/subscriptions` (`amount`, `interval: "1 month"`,
   `webhookUrl`, `metadata`) → provisioning (§7).
5. Maandelijkse incasso's → telkens webhook → `current_period_end` +1 maand,
   `status='active'`. Mislukt → `status='past_due'` → gating sluit toegang.

### 6.2 Jaar (eenmalig)

1. **Klant** aanmaken (voor koppeling/herhaling later).
2. **Betaling**: `POST /v2/payments` (default `oneoff`), bedrag =
   `yearlyPriceCents`, `redirectUrl`, `webhookUrl`, `metadata`.
3. **Webhook** (betaald): provisioning met `interval='yearly'`,
   `current_period_end = now + 12 maanden`, géén `mollie_subscription_id`.
4. Verlenging = handmatig (nieuwe checkout) in fase 1. Optionele
   herinneringsmail bij naderend einde is fase 2.

### 6.3 Webhook-robuustheid

- Mollie stuurt enkel een `id`; we **vertrouwen de body niet** en doen
  `GET /v2/payments/{id}` (resp. subscription) met onze key.
- **Idempotent**: verwerking is een upsert op `subscriptions` (uniek op
  `user_id`) + check op reeds verwerkte `mollie_payment_id`. Dubbele webhooks =
  no-op.
- Altijd `200` teruggeven na verwerking (anders blijft Mollie herproberen);
  fouten loggen + (later) alerten.

## 7. Account-provisioning + magic-link

In de webhook, bij status = betaald (service-role-client, bypasst RLS):

```
1. Zoek auth-gebruiker op e-mail (admin API).
2. Bestaat niet? → supabase.auth.admin.createUser({ email, email_confirm: true,
   user_metadata: { full_name } })  → trigger maakt profiles-rij.
3. Upsert subscriptions-rij (user_id, tier, interval, status='active',
   current_period_end, mollie_*-id's, mollie_payment_id).
4. Stuur magic-link: supabase.auth.signInWithOtp({ email,
   emailRedirectTo: `${APP_URL}/auth/callback?next=/modules` }).
```

Bestaande gebruiker die upgradet → stap 2 overslaan, abonnement koppelen/bijwerken.
De bedankt-pagina draait niet op de webhook maar toont alleen het "check je
mail"-bericht; provisioning is volledig webhook-gedreven (betrouwbaar, niet
afhankelijk van of de gebruiker terugkeert).

## 8. Tier-gating in de portal

- Helper `getActiveSubscription(userId)` →
  `{ tier } | null`. Actief = `status='active'` **en**
  `current_period_end > now()` (dekt zowel maand als verlopen jaar).
- `app/(app)/modules/page.tsx`: elke module-kaart checkt
  `tierAllows(sub?.tier ?? null, module.minTier)`:
  - toegestaan → normale kaart/link;
  - te lage tier → kaart **op slot** met "Upgrade naar <tier>" → `/prijzen`;
  - geen abonnement → alle kaarten op slot + bovenaan "Kies een abonnement".
- Module-pagina's + server actions doen **server-side** dezelfde check
  (defense-in-depth; UI-gating alleen is niet genoeg).
- `app/(app)/account/page.tsx`: toon tier, interval, status, periode-einde, en
  "Abonnement opzeggen" (maand → `DELETE` Mollie-subscription, toegang loopt tot
  periode-einde; jaar → loopt af op einddatum).

## 9. Branding & content

- Geen bestaande visuele identiteit. We zetten een strakke, professionele basis
  op: portal-gradient (paars/blauw), heldere typografie, één hero-beeld,
  rustige sectie-opbouw — geleend van de blauwdruk. Logo/kleur als makkelijk te
  vervangen plaatshouders (`lib/brand.ts` of CSS-variabelen).
- Naam: **Positionr** als woordmerk. (De analyse merkt op dat de naam smal kan
  voelen t.o.v. de brede scope — buiten scope van deze bouw, puur genoteerd.)
- Blog/resources: **fase 2**, als MDX in de repo.

## 10. Env-variabelen (Vercel)

| Var | Bestaat al? | Gebruik |
|---|---|---|
| `MOLLIE_API_KEY` | nieuw | Mollie (server-only) |
| `SUPABASE_SERVICE_ROLE_KEY` | ja (`.env.example`) | admin user-creatie + RLS-bypass in webhook |
| `NEXT_PUBLIC_APP_URL` | ja | magic-link redirect |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | ja | client |

Test- en live-Mollie-keys gescheiden (test t/m verificatie, live bij launch).

## 11. Foutafhandeling

| Geval | Afhandeling |
|---|---|
| Betaling afgebroken/mislukt | Geen account; bedankt-pagina toont "opnieuw proberen" |
| Dubbele/herhaalde webhook | Idempotente upsert; reeds-verwerkte `payment_id` = no-op |
| E-mail bestaat al | Abonnement aan bestaand account koppelen, geen dubbele user |
| Recurring incasso mislukt | `status='past_due'` → gating sluit toegang tot herstel |
| Magic-link niet ontvangen | "Opnieuw sturen"-knop op bedankt-pagina + `/login` |
| Gratis check misbruikt | Rate-limit per e-mail+IP; nette melding |
| Mollie-API down bij checkout | Foutmelding + retry; geen lead/abonnement-corruptie |

## 12. Testing (vitest, bestaand)

| Niveau | Wat |
|---|---|
| Unit | `tierAllows` / `getActiveSubscription` — alle tier-combinaties + verlopen periode |
| Unit | `PLANS`-registry consistent (slugs, prijzen > 0, features) |
| Unit | Webhook-handler met gemockte Mollie (first/oneoff/recurring/failed + dubbele call) |
| Unit | Provisioning: nieuwe user vs. bestaande user (admin API gemockt) |
| Unit | `analyzeWebsite` pure functie (scrape + analyze gemockt) + lead-opslag |
| Smoke (test-mode) | Volledige checkout maand + jaar via Mollie-testmodus → magic-link → portal |

## 13. Rollout — vijf PR's (elk apart deploybaar/revertbaar)

1. **PR 1 — Data-laag.** Migratie (`min_tier`, `subscriptions`, `leads`) + RLS +
   `lib/plans/registry.ts` + `tierAllows`/`getActiveSubscription` + tests.
   Niet-disruptief (geen UI/flow).
2. **PR 2 — Marketing-shell.** `(marketing)`-route-groep + layout/middleware
   publiek + landing + `/prijzen` (leest `PLANS`) + juridische pagina's +
   branding-basis. Nog geen betaling (knoppen → checkout-stub).
3. **PR 3 — Gratis Website Check.** `analyzeWebsite`-refactor + `/gratis-check`
   (lead-capture + result-weergave + rate-limit) + CTA naar prijzen.
4. **PR 4 — Mollie + provisioning.** Checkout-action (maand + jaar) + webhook +
   account-aanmaak + magic-link + bedankt-pagina. Test-mode end-to-end.
5. **PR 5 — Tier-gating + accountbeheer.** Modules op slot + server-side checks +
   `/account` (status + opzeggen). Live-Mollie-keys + smoke-test.

Fase 2 (aparte spec): `/functies`, `/over`, `/contact`, blog (MDX), extra modules.

## 14. Risico's & onbekenden

| Risico | Impact | Mitigatie |
|---|---|---|
| Prijzen/tiers nog niet gevalideerd | Verkeerde pricing live | Prijzen configureerbaar (`PLANS`); start met wedge + valideer |
| Mollie recurring-shape/edge-cases | Foutieve abonnementsstatus | Status altijd ophalen bij Mollie; idempotente upsert; testmodus eerst |
| Magic-link deliverability | Klant kan niet inloggen na betaling | "Opnieuw sturen"-knop; later eigen mail (Resend) als nodig |
| Gratis check = LLM-kosten/misbruik | Onverwachte kosten | Rate-limit per e-mail+IP; later evt. captcha |
| AVG: leads (e-mail) opslaan | Compliance | Privacy-pagina + duidelijke opt-in-tekst bij de gratis check |
| Twee betaalvormen tegelijk bouwen | Meer complexiteit fase 1 | Gedeeld datamodel; verschil zit alleen in checkout + wel/geen mandaat |
| Domein `positionr.nl` nog niet geregeld | Blokkeert launch, niet de bouw | Externe taak; ontwerp draait lokaal/op Vercel-preview |

## 15. Acceptatiecriteria (fase 1)

- Bezoeker kan op `/gratis-check` met e-mail + URL een Website Check draaien, de
  score zien, en wordt als `leads`-rij opgeslagen.
- `/prijzen` toont Basis/Pro/Premium met werkende maand/jaar-schakelaar uit `PLANS`.
- Een nieuwe klant kan via `/checkout` een **maand**- én een **jaar**-abonnement
  afrekenen in Mollie-testmodus; na betaling krijgt hij automatisch een account +
  `subscriptions`-rij + magic-link en kan inloggen in de portal.
- In de portal zijn modules met te hoge `min_tier` zichtbaar **op slot** met
  upgrade-CTA; toegestane modules werken; server-side check blokkeert directe
  URL-toegang zonder geldige tier.
- `/account` toont tier/interval/status/periode-einde en kan een maandabonnement
  opzeggen (toegang t/m periode-einde).
- Bestaande portal-functionaliteit (login, Website Check ingelogd, admin) heeft
  geen regressie.
- Geen secrets in de repo; `MOLLIE_API_KEY` + service-role-key server-only.
