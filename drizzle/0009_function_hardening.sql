-- ===== positionr-app: function hardening =====
-- Reden: Supabase database-linter warnings op 2026-06-08.
--
-- 1. Function Search Path Mutable: trigger-functies zonder vaste
--    `search_path` zijn theoretisch vatbaar voor search-path injection.
--    Fix: search_path = '' (forceert volledig gekwalificeerde namen).
--
-- 2. SECURITY DEFINER functions publiek aanroepbaar: handle_new_user()
--    en rls_auto_enable() draaien met definer-rechten. Ze worden in
--    praktijk alleen door triggers aangeroepen — directe execute
--    voor public/authenticated is onnodige attack-surface.
--    Fix: revoke execute. Triggers blijven werken (triggers gebruiken
--    de definer-context, geen execute-permissie van de aanroeper).

-- 1. Search-path vastzetten op trigger-functies
alter function public.touch_clients_updated_at() set search_path = '';
alter function public.touch_icp_products_updated_at() set search_path = '';

-- 2. EXECUTE-rechten intrekken voor SECURITY DEFINER functies
revoke execute on function public.handle_new_user() from public, authenticated;
revoke execute on function public.rls_auto_enable() from public, authenticated;
