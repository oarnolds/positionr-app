-- ===== positionr-app: markdown_snapshots — RLS =====
-- Doel: per-user cache van URL → markdown conversies voor gedeeld gebruik
-- door meerdere modules (website-check, icp-analyse, …).
-- Run dit ná `pnpm db:push` (die de tabel zelf aanmaakt).
--
-- Strategie: uniform met andere user-bezitten tabellen — "authenticated all".
-- Server-actions gebruiken SUPABASE_SERVICE_KEY (bypasst RLS).
-- Idempotent.

alter table public.markdown_snapshots enable row level security;
drop policy if exists "markdown_snapshots authenticated all" on public.markdown_snapshots;
create policy "markdown_snapshots authenticated all" on public.markdown_snapshots
  for all to authenticated using (true) with check (true);

-- Unieke (user_id, kind, source_url) zodat één rij per cache-sleutel bestaat.
-- IF NOT EXISTS zodat re-runnen geen fout geeft.
create unique index if not exists markdown_snapshots_user_kind_url_uidx
  on public.markdown_snapshots (user_id, kind, source_url);

-- Index voor TTL-checks en cleanup-jobs.
create index if not exists markdown_snapshots_expires_at_idx
  on public.markdown_snapshots (expires_at);
