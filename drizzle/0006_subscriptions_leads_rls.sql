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
