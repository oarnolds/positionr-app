-- ===== positionr-app: RLS aanzetten op alle publieke tabellen =====
-- Reden: Supabase security-alert "rls_disabled_in_public" op 2026-06-08.
-- 8 publieke tabellen hadden RLS uit; iedereen met de anon-key kon via
-- de REST-API rauwe data lezen/schrijven.
--
-- Strategie: uniform "authenticated mag alles" per tabel.
-- - Server-actions gebruiken SUPABASE_SERVICE_KEY (bypasst RLS) en
--   blijven dus onveranderd werken (gratis-check anon-flow ook).
-- - Anonieme REST-calls worden geblokkeerd door de policy.
-- - Geen per-user data-isolatie in v1 (we zijn solo); migratie naar
--   fijnmazigere policies kan later zonder code-aanpassingen.
--
-- Idempotent (drop policy if exists + enable row level security is no-op).

-- clients
alter table public.clients enable row level security;
drop policy if exists "clients authenticated all" on public.clients;
create policy "clients authenticated all" on public.clients
  for all to authenticated using (true) with check (true);

-- icp_products
alter table public.icp_products enable row level security;
drop policy if exists "icp_products authenticated all" on public.icp_products;
create policy "icp_products authenticated all" on public.icp_products
  for all to authenticated using (true) with check (true);

-- leads
alter table public.leads enable row level security;
drop policy if exists "leads authenticated all" on public.leads;
create policy "leads authenticated all" on public.leads
  for all to authenticated using (true) with check (true);

-- module_prompt_history
alter table public.module_prompt_history enable row level security;
drop policy if exists "module_prompt_history authenticated all" on public.module_prompt_history;
create policy "module_prompt_history authenticated all" on public.module_prompt_history
  for all to authenticated using (true) with check (true);

-- modules
alter table public.modules enable row level security;
drop policy if exists "modules authenticated all" on public.modules;
create policy "modules authenticated all" on public.modules
  for all to authenticated using (true) with check (true);

-- profiles
alter table public.profiles enable row level security;
drop policy if exists "profiles authenticated all" on public.profiles;
create policy "profiles authenticated all" on public.profiles
  for all to authenticated using (true) with check (true);

-- sessions
alter table public.sessions enable row level security;
drop policy if exists "sessions authenticated all" on public.sessions;
create policy "sessions authenticated all" on public.sessions
  for all to authenticated using (true) with check (true);

-- subscriptions
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions authenticated all" on public.subscriptions;
create policy "subscriptions authenticated all" on public.subscriptions
  for all to authenticated using (true) with check (true);
