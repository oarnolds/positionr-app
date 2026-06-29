-- Voeg "both" toe aan de provider-enum.
-- Wordt gebruikt door de admin prompt-editor om een module te configureren
-- voor synthese-modus: parallel Claude + Perplexity → derde Claude-call merget
-- beide outputs tot één rijkere rapportage.
--
-- ALTER TYPE ... ADD VALUE is veilig en idempotent met IF NOT EXISTS, maar
-- moet OUTSIDE een transactie draaien — vandaar de losse statement.
-- (Migratie al toegepast in Supabase via MCP; deze file dient als
--  checkpoint in de repo.)

alter type public.provider add value if not exists 'both';
