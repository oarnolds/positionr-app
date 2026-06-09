-- Row Level Security voor module_layout_history.
-- Volgt het patroon van module_prompt_history.
-- Run dit ná `pnpm db:push` in de Supabase SQL editor.

alter table module_layout_history enable row level security;

create policy "module_layout_history admin all"
  on module_layout_history for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
