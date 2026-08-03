-- Integración con ARUSA (Asociación Rugby de Santiago): el club configura
-- su ID de club en ARUSA y los partidos se importan automáticamente desde
-- el calendario público de arusa.cl (mismo endpoint que usa el filtro
-- público del sitio, sin necesidad de credenciales).

alter table clubs add column if not exists arusa_club_id text;
alter table clubs add column if not exists arusa_last_sync timestamptz;

alter table matches add column if not exists external_source text;
alter table matches add column if not exists external_id text;

create unique index if not exists matches_external_unique
  on matches (club_id, external_source, external_id)
  where external_source is not null;
