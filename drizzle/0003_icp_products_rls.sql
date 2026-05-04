-- RLS voor icp_products-tabel
-- Run handmatig na pnpm db:push.

alter table icp_products enable row level security;

-- Gebruikers zien producten van hun eigen klanten
create policy "users see own client products"
  on icp_products for select
  using (
    exists (
      select 1 from clients c
      where c.id = icp_products.client_id and c.user_id = auth.uid()
    )
  );

create policy "users insert products for own clients"
  on icp_products for insert
  with check (
    exists (
      select 1 from clients c
      where c.id = icp_products.client_id and c.user_id = auth.uid()
    )
  );

create policy "users update own client products"
  on icp_products for update
  using (
    exists (
      select 1 from clients c
      where c.id = icp_products.client_id and c.user_id = auth.uid()
    )
  );

create policy "users delete own client products"
  on icp_products for delete
  using (
    exists (
      select 1 from clients c
      where c.id = icp_products.client_id and c.user_id = auth.uid()
    )
  );

create policy "admins see all products"
  on icp_products for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-update updated_at op elke UPDATE
create or replace function public.touch_icp_products_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists icp_products_touch_updated_at on icp_products;
create trigger icp_products_touch_updated_at
  before update on icp_products
  for each row execute procedure public.touch_icp_products_updated_at();
