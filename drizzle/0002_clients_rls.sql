-- RLS voor clients-tabel
-- Run handmatig na pnpm db:push (zelfde flow als 0001_rls.sql).

alter table clients enable row level security;

create policy "users see own clients"
  on clients for select
  using (auth.uid() = user_id);

create policy "users insert own clients"
  on clients for insert
  with check (auth.uid() = user_id);

create policy "users update own clients"
  on clients for update
  using (auth.uid() = user_id);

create policy "users delete own clients"
  on clients for delete
  using (auth.uid() = user_id);

create policy "admins see all clients"
  on clients for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-update updated_at op elke UPDATE
create or replace function public.touch_clients_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on clients;
create trigger clients_touch_updated_at
  before update on clients
  for each row execute procedure public.touch_clients_updated_at();
