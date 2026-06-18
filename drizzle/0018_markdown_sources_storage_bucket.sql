-- Private storage bucket voor originele bronbestanden van de
-- markdown-bibliotheek (PDF + DOCX). Server-side upload via service_role.
-- Pad-conventie: <user_id>/<uuid>.<ext>
-- (Migratie al toegepast in Supabase via MCP; deze file dient als
--  checkpoint in de repo.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'markdown-sources',
  'markdown-sources',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- RLS: gebruikers alleen toegang tot bestanden in hun eigen userId-prefix.
-- Server actions die service_role gebruiken bypassen deze policies.
drop policy if exists "markdown sources users select own" on storage.objects;
create policy "markdown sources users select own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'markdown-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "markdown sources users insert own" on storage.objects;
create policy "markdown sources users insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'markdown-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "markdown sources users delete own" on storage.objects;
create policy "markdown sources users delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'markdown-sources'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
