-- Uitbreiding voor de markdown-bibliotheek: bron kan nu ook een geüploade
-- PDF of Word-document zijn. Bewaar bron-bestand in Supabase Storage en
-- registreer storage_path + originele filename voor display.
-- (Migratie al toegepast in Supabase via MCP; deze file dient als
--  checkpoint in de repo.)

alter type public.markdown_snapshot_kind add value if not exists 'pdf';
alter type public.markdown_snapshot_kind add value if not exists 'docx';

alter table public.markdown_snapshots
  add column if not exists source_filename text,
  add column if not exists source_storage_path text;
