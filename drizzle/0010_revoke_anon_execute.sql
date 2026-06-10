-- ===== positionr-app: revoke execute van anon-rol =====
-- Follow-up op 0009: de "Public Can Execute SECURITY DEFINER" warnings
-- bleven staan omdat de `anon`-rol (niet-ingelogde users) nog execute
-- mocht. 0009 trok alleen `public, authenticated` in.
--
-- Triggers werken nog steeds (definer-context, geen execute-permissie
-- nodig van de aanroeper).

revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.rls_auto_enable() from anon;
