# Positionr

B2B-marketinganalyse-platform op Next.js + Supabase.

## Stack

- **Next.js 15** (App Router, server actions, typed routes)
- **Supabase** (Postgres + Auth via magic link + Storage + RLS)
- **Drizzle ORM** (Postgres dialect)
- **Tailwind 3 + shadcn/ui**
- **Anthropic Claude** (analyse) + **Perplexity** (web research)
- **Vercel** (deploy via push naar `main`)

## Status

**Week 1 — Foundation** ✅ scaffold compleet
- [x] Project structuur + dependencies
- [x] Drizzle schema (profiles, modules, sessions)
- [x] Supabase client/server/middleware setup
- [x] Auth flow (magic link → callback)
- [x] Publieke routes: `/`, `/modules` (12 cards, 1 actief), `/account`
- [x] Admin shell: `/admin`, `/admin/prompts`, `/admin/gebruikers`
- [x] Module-registry als source-of-truth + DB-seed script
- [x] RLS policies (in `drizzle/0001_rls.sql`)

**Week 2 — Website Check end-to-end** ⏳ volgt
- [ ] Module-folder `modules/website-check/`
- [ ] Server action: scrape → Claude → validate → opslaan
- [ ] `<ResultView>` pagina-presentatie (geen PDF — alles op scherm)
- [ ] Gedeelde bouwstenen: `<ResultBanner>`, `<ScoreGrid>`, `<TopActions>`

**Week 3 — Admin layer + launch** ⏳ volgt
- [ ] Sessies-overzicht + per-sessie detail (prompt-override, regenereer)
- [ ] Prompt Editor per module (rich-text)
- [ ] Gebruikersbeheer
- [ ] 3 design-partners testen

## Eerste keer opzetten

### 1. Dependencies installeren

```bash
pnpm install
```

### 2. Supabase project aanmaken

1. Maak een nieuw project op [supabase.com](https://supabase.com) (naam: `positionr-prod`)
2. Region: West EU (Ierland)
3. Onthoud database password (komt in `DATABASE_URL`)

### 3. Environment variables

Kopieer `.env.example` naar `.env.local` en vul in:

```bash
cp .env.example .env.local
```

Waar te vinden:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` → idem (gevoelig — server-only)
- `DATABASE_URL` → Supabase Project Settings → Database → Connection string (URI, met password)
- `ANTHROPIC_API_KEY` → console.anthropic.com
- `PERPLEXITY_API_KEY` → perplexity.ai/settings/api

### 4. Database migreren

```bash
pnpm db:generate    # genereer SQL uit schema.ts
pnpm db:push        # push naar Supabase
```

Run daarna **handmatig** de RLS-policies in de Supabase SQL editor:

```sql
-- copy/paste van drizzle/0001_rls.sql
```

### 5. Modules seeden

```bash
pnpm tsx scripts/seed-modules.ts
```

### 6. Auth instellen in Supabase

1. **Authentication → Providers → Email**: zet alleen **magic link** aan, geen wachtwoorden
2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (lokaal) of `https://app.positionr.nl` (prod)
   - Redirect URLs: idem + `/auth/callback`

### 7. Admins instellen

Na eerste login (magic link voor `olivier@eclectik.co` en `martijn@dehaasbcd.nl`):

```sql
update profiles set role = 'admin'
where id in (
  select id from auth.users where email in ('olivier@eclectik.co', 'martijn@dehaasbcd.nl')
);
```

(Tijdelijk staat er ook een hardcoded check op email in `app/(app)/layout.tsx` en `app/(admin)/layout.tsx` — die kan eruit zodra `profiles.role` overal gebruikt wordt.)

### 8. Run dev

```bash
pnpm dev
```

→ http://localhost:3000

## Folder-structuur

```
positionr-app/
├── app/
│   ├── (auth)/                    # publiek
│   │   ├── login/                 # magic-link form
│   │   └── auth/callback/         # Supabase OTP exchange
│   ├── (app)/                     # protected user-app
│   │   ├── layout.tsx             # auth-check, header met user/admin
│   │   ├── modules/               # catalogus + per-module pages
│   │   │   ├── page.tsx
│   │   │   └── website-check/
│   │   ├── account/
│   │   └── actions.ts             # signOut etc.
│   ├── (admin)/                   # alleen voor admins
│   │   ├── layout.tsx             # role-check, sidebar
│   │   └── admin/
│   │       ├── page.tsx           # sessies-overzicht
│   │       ├── prompts/           # prompt-editor
│   │       └── gebruikers/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # landing
├── components/
│   ├── ui/                        # Button, Input, etc. (shadcn-stijl)
│   └── module-result/             # ResultBanner, ScoreGrid, TopActions (week 2)
├── modules/                       # ★ per module: alles bij elkaar
│   └── website-check/             # week 2
│       ├── meta.ts
│       ├── schema.ts
│       ├── prompt.ts
│       ├── service.ts
│       └── components/
├── lib/
│   ├── supabase/                  # client.ts, server.ts, middleware.ts
│   ├── db/                        # schema.ts, client.ts
│   ├── ai/                        # claude.ts, perplexity.ts (week 2)
│   ├── modules/registry.ts        # source-of-truth voor catalogus
│   └── utils.ts                   # cn()
├── drizzle/                       # gegenereerde migraties + 0001_rls.sql
├── scripts/seed-modules.ts        # vul `modules`-tabel
├── middleware.ts                  # session refresh + redirect
└── ...config files
```

## Architectuurprincipes

1. **Een sessie-tabel voor alle modules** — geen `*_sessions`-proliferatie
2. **Frameworks als code, niet in DB** — `modules/<x>/framework.ts` is git-versioned
3. **Per-module folder** — alles bij elkaar (prompts, schema, service, UI, PDF)
4. **Public/Admin gescheiden** — twee Next.js route-groups + RLS in Postgres
5. **Audit-trail van prompts** — `promptUsed` opgeslagen bij elke run
6. **Telemetrie ingebouwd** — `llmModel`, `*_tokens`, `llmCostCents` voor unit economics

## Volgende stappen

Zie issue/sprint-plan in `/Users/olivierarnolds/Desktop/Positionr/PLAN_WEBSITECHECK_MVP.md`.
