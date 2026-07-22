-- lineups.team_id era uuid con FK a teams(id), pero la app usa ids de
-- equipo fijos en código ("primer","reserva","sub20", ver src/data/sports.js
-- TEAMS) — nunca UUIDs reales de una fila de teams. Cada intento de guardar
-- una nómina fallaba con "invalid input syntax for type uuid".
alter table lineups drop constraint if exists lineups_team_id_fkey;
alter table lineups alter column team_id type text using team_id::text;

-- getLineups() ordena por created_at, que no existe en lineups (solo
-- updated_at) — el select también fallaba siempre.
alter table lineups add column if not exists created_at timestamptz default now();

-- Verificación
select column_name, data_type from information_schema.columns
where table_name='lineups' and column_name in ('team_id','created_at');
