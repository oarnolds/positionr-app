# Kennisbibliotheek (subsysteem 1) — ontwerp

**Datum:** 2026-07-09
**Status:** goedgekeurd ontwerp, klaar voor implementatieplan

## Context

We willen "kennisblokjes ter inspiratie" tonen tussen de output van de modules,
gebaseerd op marketing/sales-theorie uit boeken van bekende auteurs. Dit ontwerp
dekt **subsysteem 1**: het opbouwen en beheren van de kennisbibliotheek zelf.
Het tonen in de modules (matching + rendering) is subsysteem 2 en valt buiten
deze spec.

De aanpak is **gedistilleerde concept-kaarten** (niet een live-RAG over
boektekst): we verwerken elk boek één keer tot kaarten in Positionr's eigen
woorden, met bronvermelding. Dat is juridisch veilig (we distilleren ideeën,
we reproduceren geen boektekst), consistenter van kwaliteit en goedkoper in
gebruik. Een proef op Cialdini's *Invloed* (EPUB) bevestigde de kwaliteit.

## Doel

Een admin kan een boek (PDF/EPUB) aanleveren; het systeem distilleert het tot
concept-kaarten in het Nederlands; de admin keurt elke kaart goed, bewerkt of
verwijdert. Alleen goedgekeurde kaarten zijn beschikbaar voor subsysteem 2.

## Niet-doelen (YAGNI)

- Geen matching aan module-output en geen rendering in de modules (subsysteem 2).
- Geen embeddings/semantische index in dit subsysteem — tags volstaan voor de
  latere matching; embeddings voegen we pas in subsysteem 2 toe indien nodig.
- Geen zelfbediening voor eindgebruikers: dit is volledig admin-beheerd.
- Het bronboek wordt nooit aan eindgebruikers getoond of served.

## Kaartformaat

Elke concept-kaart heeft:

- **titel** — naam van het principe (bv. "Sociale bewijskracht")
- **kern** — 2-4 zinnen in Positionr's eigen woorden
- **toepassing** — één praktische zin ("zo pas je 't toe")
- **tags** — array van thema's/situaties (bv. `bewijsvoering`, `waardepropositie`)
- **bron** — auteur + boektitel (bv. "Robert Cialdini — Invloed")

## Flow (admin-tab)

Nieuwe tab **"Kennisbibliotheek"** in `ADMIN_NAV` (admin-only, geguard door de
bestaande `app/(admin)/layout.tsx`). Twee schermen:

1. **Bronnen** (`/admin/kennis`) — lijst van aangeleverde boeken (titel, auteur,
   taal, status, aantal kaarten) + een upload-vak. Upload verwerkt het boek en
   start de distillatie.
2. **Kaarten van een boek** (`/admin/kennis/[sourceId]`) — de goedkeur-wachtrij:
   alle kaarten van dat boek. Per kaart: bewerken (alle velden), goedkeuren
   (`concept` → `goedgekeurd`), of verwijderen. Toont de distillatie-voortgang
   zolang die loopt.

## Boek-ingestie

- **Formaten:** PDF en EPUB.
- **Opslag:** een privé, admin-only Supabase Storage bucket `knowledge-books`
  (los van `markdown-sources`), met een ruimer size-limit (50 MB) omdat boeken
  groter zijn dan de 10 MB-uploads elders.
- **Extractie tot hoofdstukken:**
  - EPUB = zip met XHTML. Uitpakken (via `jszip`), spine-volgorde uit
    `content.opf` lezen, per document de tekst strippen (via `cheerio`, al een
    dependency). Hoofdstukgrenzen = de spine-documenten.
  - PDF: tekst extraheren. Hergebruikt de bestaande Claude-conversie
    (`lib/scraping/pdf-to-markdown.ts`) per pagina-batch; hoofdstukgrenzen
    worden heuristisch bepaald (kop-detectie), met een terugval op vaste
    tekstblokken van ~6000 woorden als er geen duidelijke koppen zijn.
- **Auto-detectie:** auteur en brontaal worden automatisch bepaald (uit
  EPUB-metadata `content.opf` waar aanwezig; anders via een korte LLM-call op
  de eerste pagina's). De admin kan ze achteraf corrigeren in het bron-scherm.

## Distillatie-pijplijn

Per hoofdstuk, in twee stappen door Claude:

1. **Map** — uit de hoofdstuktekst de kernconcepten, frameworks en signature-
   voorbeelden halen als gestructureerde notities.
2. **Reduce** — die notities omzetten naar concept-kaarten in het kaartformaat.

**Taal:** de reduce-stap schrijft **altijd in het Nederlands**, ongeacht de
brontaal (vertalen-tijdens-distilleren, één stap). De originele auteur/boektitel
blijft ongewijzigd in de bron.

**Uitvoering (belangrijkste technische keuze):** een heel boek past niet binnen
Vercel's 300s serverless-limiet. Daarom draait de distillatie **op de
achtergrond, hoofdstuk voor hoofdstuk** — elk hoofdstuk is één (map+reduce-)
verwerking, ruim binnen de limiet. De `knowledge_sources`-rij houdt de voortgang
bij (`chapters_total`, `chapters_done`, `status`). Het bron-scherm pollt de
status, vergelijkbaar met de bestaande `running-poll`-patronen in de modules.
Kaarten verschijnen incrementeel als `concept` naarmate hoofdstukken klaar zijn.

## Datamodel

Twee nieuwe, gedeelde tabellen (geen `user_id` — admin-beheerd, globaal).

**`knowledge_sources`**
- `id` uuid pk
- `title` text
- `author` text (auto-gedetecteerd, admin-bewerkbaar)
- `language` text (auto-gedetecteerd bronstaal, bv. "en" / "nl")
- `kind` enum (`pdf` | `epub`)
- `storage_path` text (pad in bucket `knowledge-books`)
- `status` enum (`extracting` | `distilling` | `done` | `failed`)
- `chapters_total` int, `chapters_done` int
- `error_message` text null
- `created_at`, `updated_at` timestamptz

**`knowledge_cards`**
- `id` uuid pk
- `source_id` uuid → `knowledge_sources.id` (on delete cascade)
- `title` text
- `kern` text
- `toepassing` text
- `tags` text[] (default `{}`)
- `source_label` text (auteur + boek, voor bronvermelding)
- `status` enum (`concept` | `goedgekeurd`, default `concept`)
- `chapter_index` int (herkomst; voor sortering/debug)
- `created_at`, `updated_at` timestamptz

RLS: beide tabellen alleen leesbaar/schrijfbaar voor admins (server-side via
service-client; consistent met de bestaande admin-tabellen).

## Te bouwen (bestanden)

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `lib/db/schema.ts` | Twee tabellen + enums toevoegen |
| DB-migratie (Supabase) | Tabellen + bucket `knowledge-books` |
| `lib/knowledge/extract.ts` | Boek (PDF/EPUB) → hoofdstukken (tekst) + auteur/taal-detectie |
| `lib/knowledge/distill.ts` | Hoofdstuk → concept-kaarten (Claude, NL-output) |
| `lib/knowledge/service.ts` | Orkestratie: bron aanmaken, per hoofdstuk achtergrond-distillatie, statusbijwerking |
| `app/(admin)/admin/kennis/page.tsx` | Bronnen-lijst + upload |
| `app/(admin)/admin/kennis/[sourceId]/page.tsx` | Goedkeur-wachtrij per boek |
| `app/(admin)/admin/kennis/actions.ts` | Server-actions: upload, goedkeuren, bewerken, verwijderen |
| `app/(admin)/layout.tsx` | `ADMIN_NAV`-entry "Kennisbibliotheek" |
| `package.json` | Dependency `jszip` voor EPUB |

## Teststrategie

- **Extractie** — EPUB (zip+XHTML) → correcte hoofdstukken en volgorde; PDF-
  hoofdstuk-splitsing; auteur/taal-detectie op een fixture. Getest met een klein
  gefabriceerd EPUB (jszip kan ook schrijven) zodat er geen echt boek in de repo
  hoeft.
- **Distillatie** — promptbouw (map + reduce), en dat de reduce-prompt om
  Nederlandse output vraagt ongeacht brontaal.
- **Kaart-schema** — Zod-validatie van een kaart; ongeldige velden falen netjes.
- **Status-overgang** — `concept` → `goedgekeurd` via de server-action, en dat
  alleen admins dat mogen.
- De feitelijke distillatie-inhoud is LLM-werk; we testen de promptbouw en de
  orkestratie, niet de gegenereerde tekst.

## Bekende beperkingen / risico's

- **Distillatiekwaliteit** varieert per boek; daarom is menselijke goedkeuring
  verplicht (elke kaart start als `concept`).
- **Vercel 300s**: opgelost door per-hoofdstuk-verwerking; een zeer lang
  hoofdstuk zou alsnog krap kunnen zijn — dan splitsen we dat hoofdstuk verder
  op woordgrens.
- **PDF-hoofdstukdetectie** is heuristisch; EPUB (met echte spine) is
  betrouwbaarder. Voor PDF's zonder duidelijke koppen vallen we terug op
  vaste tekstblokken.
- **Auteursrecht:** het bronboek staat privé en admin-only opgeslagen en wordt
  nooit geserveerd; de kaarten zijn Positionr's eigen woorden met bronvermelding.
