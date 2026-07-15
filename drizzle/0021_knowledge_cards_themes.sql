-- Kennisbibliotheek — themes-kolom op knowledge_cards
-- Run dit in de Supabase SQL Editor (dit project gebruikt handmatige
-- SQL-migratie i.p.v. drizzle-kit migrate; journal blijft leeg).
--
-- Voegt toe: knowledge_cards.themes — taxonomie-gemapte thema's (naast de
-- vrije `tags`), gebruikt door de matching-engine (subsysteem 2).
-- Additief en non-breaking (default '{}' NOT NULL).

alter table "knowledge_cards"
  add column "themes" text[] default '{}' not null;
