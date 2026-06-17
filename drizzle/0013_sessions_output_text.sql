-- sessions.output van jsonb naar text. Pre-launch, bestaande output-data
-- wordt vernietigd (geen klant-data).
ALTER TABLE sessions DROP COLUMN output;
ALTER TABLE sessions ADD COLUMN output text;
