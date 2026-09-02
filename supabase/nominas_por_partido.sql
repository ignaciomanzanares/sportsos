-- ═══════════════════════════════════════════════════════════════════════════
--  Las nóminas pasan a ser de un PARTIDO, no de un equipo
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Hasta ahora una nómina se guardaba por equipo ("Primera", "Intermedia"), y
--  como solo hay tres equipos, publicar la del sábado que viene pisaba la del
--  sábado pasado. El club no podía mirar contra quién jugó cada uno ni cuántas
--  veces lo convocaron: el historial de convocatorias, que es la mitad del
--  valor de tener esto, no existía.
--
--  Ahora cada nómina apunta a su partido, y el partido ya trae el rival y la
--  fecha. Se acumulan en vez de pisarse.
--
--  Correr entero en el SQL Editor de Supabase.

alter table public.lineups
  add column if not exists match_id uuid references public.matches(id) on delete cascade;

create index if not exists lineups_match_idx on public.lineups (match_id);

-- Una nómina por partido. La restricción vieja era por equipo y ya no aplica:
-- ese era justamente el motivo de que se pisaran.
alter table public.lineups drop constraint if exists lineups_club_team_unique;
alter table public.lineups drop constraint if exists lineups_club_match_unique;

-- Parcial: las filas viejas sin partido (si quedara alguna de antes de esta
-- migración) no chocan entre sí ni bloquean nada.
create unique index if not exists lineups_club_match_unique
  on public.lineups (club_id, match_id) where match_id is not null;

-- team_id se queda: sirve para mostrar "Primera" sin volver a leer el partido,
-- y para que las nóminas viejas —guardadas antes de esto— se sigan leyendo.
comment on column public.lineups.match_id is
  'Partido al que corresponde la nómina. Null solo en las guardadas antes de la migración de septiembre 2026.';
