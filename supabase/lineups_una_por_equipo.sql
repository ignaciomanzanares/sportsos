-- ═══════════════════════════════════════════════════════════════════════════
--  Una nómina por equipo, no una fila nueva cada vez que se publica
-- ═══════════════════════════════════════════════════════════════════════════
--
--  saveLineup() usa .upsert() pero la tabla no tiene ninguna restricción única
--  sobre (club_id, team_id), así que Postgres no tiene contra qué chocar y el
--  upsert se comporta como un insert: cada vez que el entrenador publica la
--  nómina de Primera, se crea otra fila.
--
--  No se ve, porque getLineups() lee la más reciente y devuelve esa. Pero la
--  tabla crece una fila por publicación para siempre, `updated_at` no
--  significa nada —ninguna fila se actualiza nunca— y si algún día se quiere
--  mostrar el historial, lo que hay es un montón de versiones sin saber a qué
--  partido corresponde cada una.
--
--  Con la restricción, el upsert hace lo que dice: si ya hay nómina de ese
--  equipo, la reemplaza.
--
--  Se puede correr sin miedo: hoy la tabla está vacía (nadie publicó todavía),
--  así que no hay duplicados que resolver antes.
--
--  Correr entero en el SQL Editor de Supabase.

-- Por si alguna vez se corre con datos ya cargados: deja solo la más reciente
-- de cada equipo. Con la tabla vacía no hace nada.
delete from public.lineups a
 using public.lineups b
 where a.club_id = b.club_id
   and a.team_id = b.team_id
   and a.created_at < b.created_at;

alter table public.lineups
  drop constraint if exists lineups_club_team_unique;

alter table public.lineups
  add constraint lineups_club_team_unique unique (club_id, team_id);
