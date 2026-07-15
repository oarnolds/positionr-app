-- Kennisblokjes — gesnapshotte matches op de sessie
alter table "sessions"
  add column "knowledge_blocks" jsonb;
