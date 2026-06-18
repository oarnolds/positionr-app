-- Pivot: "Je start APK" is geen module-launcher meer maar een
-- markdown-bibliotheek. Verwijder de net-toegevoegde apk_runs tabel
-- en de FK kolom op sessions.
-- (Migratie al toegepast in Supabase via MCP; deze file dient als
--  checkpoint in de repo.)

alter table public.sessions drop column if exists apk_run_id;
drop table if exists public.apk_runs;
