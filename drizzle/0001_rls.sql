-- Row Level Security policies
-- Run dit ná `pnpm db:push` (of voeg toe aan migration-flow).

-- ── profiles ────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "users see own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "admins see all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-create profile bij nieuwe auth.users rij
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── modules ─────────────────────────────────────────────────
-- Modules zijn voor iedereen leesbaar, alleen admins kunnen muteren
alter table modules enable row level security;

create policy "modules public read"
  on modules for select
  using (true);

create policy "modules admin write"
  on modules for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ── sessions ────────────────────────────────────────────────
alter table sessions enable row level security;

create policy "users see own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "users insert own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own sessions"
  on sessions for update
  using (auth.uid() = user_id);

create policy "admins see all sessions"
  on sessions for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
