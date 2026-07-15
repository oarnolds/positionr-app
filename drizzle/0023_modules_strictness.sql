-- Strengheidsknop — globale beoordelingsstrengheid per module (1-5, default 3)
alter table "modules"
  add column "strictness" integer not null default 3;
