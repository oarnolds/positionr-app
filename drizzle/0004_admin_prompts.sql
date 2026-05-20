-- Admin Prompt Editor — schema-uitbreiding
-- Run dit in de Supabase SQL Editor (per CLAUDE.md gebruikt dit project
-- handmatige SQL-migratie i.p.v. drizzle-kit migrate).
--
-- Verandert:
--  1. Nieuw enum `provider` met waarden 'claude' | 'perplexity'
--  2. `modules` krijgt nieuwe kolom `provider` (default 'claude')
--  3. Nieuwe tabel `module_prompt_history` voor audit-trail van prompt-saves

-- 1. provider enum
create type "public"."provider" as enum ('claude', 'perplexity');

-- 2. modules.provider kolom
alter table "modules"
  add column "provider" "provider" default 'claude' not null;

-- 3. module_prompt_history tabel
create table "module_prompt_history" (
  "id" uuid primary key default gen_random_uuid() not null,
  "module_slug" text not null
    references "modules"("slug") on delete cascade,
  "prompt" text not null,
  "provider" "provider" not null,
  "saved_by" uuid not null,
  "saved_at" timestamp with time zone default now() not null
);

create index "module_prompt_history_module_idx"
  on "module_prompt_history" ("module_slug", "saved_at" desc);
