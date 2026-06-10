-- ===== module_layout_history: note kolom + saved_by nullable =====
-- PR-L2 voorbereiding: de admin-editor schrijft per save een history-rij.
-- - `note` text geeft restore-acties een label ("Hersteld van versie xxx")
-- - `saved_by` nullable voor toekomstige system-saves (cron, scripts).
--
-- Idempotent (if not exists / drop not null is no-op als al gedaan).

alter table public.module_layout_history
  add column if not exists note text;

alter table public.module_layout_history
  alter column saved_by drop not null;
