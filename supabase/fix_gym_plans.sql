-- El módulo Microciclo (preparador) y Mi Gym (jugador) eran 100% mock:
-- el plan de la semana era un objeto hardcodeado en el frontend
-- (data/gymPlan.js, "13-19 Mayo · Prof. Marcos Díaz"), "Publicar plan" no
-- persistía nada, y el registro de series del jugador solo vivía en memoria
-- (se perdía al recargar) sin escribir jamás en gym_logs — por lo que el
-- Ranking de Fuerza (que sí lee gym_logs) siempre aparecía vacío para
-- clubes reales.

create table if not exists gym_plans (
  club_id     uuid primary key references clubs(id) on delete cascade,
  week_label  text not null default '',
  coach_name  text,
  sessions    jsonb not null default '{}'::jsonb,
  published   boolean default false,
  updated_at  timestamptz default now()
);

alter table gym_plans enable row level security;

drop policy if exists "club reads gym plans" on gym_plans;
drop policy if exists "preparador manages gym plans" on gym_plans;
drop policy if exists "superadmin manages gym plans" on gym_plans;

create policy "club reads gym plans" on gym_plans for select using (club_id = my_club_id());
create policy "preparador manages gym plans" on gym_plans for all using (
  club_id = my_club_id() and exists (select 1 from profiles where id = auth.uid() and rol in ('preparador','admin'))
);
create policy "superadmin manages gym plans" on gym_plans for all using (is_superadmin());
