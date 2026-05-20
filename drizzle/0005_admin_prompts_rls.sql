-- RLS-policies voor module_prompt_history
-- Run dit ná 0004_admin_prompts.sql in de Supabase SQL Editor.
--
-- Patroon: admin-only read + write. De modules-tabel zelf heeft al
-- RLS (public read, admin write) uit drizzle/0001_rls.sql, dus daar
-- hoeft niets aangepast te worden voor de nieuwe `provider` kolom.

alter table "module_prompt_history" enable row level security;

create policy "module_prompt_history admin read"
  on "module_prompt_history" for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "module_prompt_history admin write"
  on "module_prompt_history" for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
