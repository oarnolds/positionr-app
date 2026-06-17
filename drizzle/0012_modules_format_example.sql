-- Voegt format-template per module toe. Dit is de markdown-blueprint die de
-- runtime aan de AI doorgeeft als doel-format en die de admin bewerkt via
-- /admin/layouts/[slug].
ALTER TABLE modules
  ADD COLUMN format_example text;
