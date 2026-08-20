-- ===== site_content: key-value store voor bewerkbare homepage-tekst =====
-- Reden: PR-C1 (data-layer voor inline WYSIWYG content editing). Homepage-
-- copy verhuist van hardcoded naar DB met code-fallback. PR-C2 bouwt
-- daar de <Editable>-component + inline edit-mode bovenop.

create table if not exists public.site_content (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

create table if not exists public.site_content_history (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  value      text not null,
  saved_at   timestamptz not null default now(),
  saved_by   uuid references auth.users(id),
  note       text
);

-- Snelle lookup laatste-versies-per-key (voor undo + prune)
create index if not exists site_content_history_key_saved_at_idx
  on public.site_content_history (key, saved_at desc);

-- RLS: uniform 'authenticated mag alles'. Admin-check zit in server-actions.
alter table public.site_content enable row level security;
drop policy if exists "site_content authenticated all" on public.site_content;
create policy "site_content authenticated all" on public.site_content
  for all to authenticated using (true) with check (true);

alter table public.site_content_history enable row level security;
drop policy if exists "site_content_history authenticated all" on public.site_content_history;
create policy "site_content_history authenticated all" on public.site_content_history
  for all to authenticated using (true) with check (true);
