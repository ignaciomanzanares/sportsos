-- ─────────────────────────────────────────────────────────────────
-- Registro de lesiones: injury_reports
-- ─────────────────────────────────────────────────────────────────
-- El panel de Salud actual solo cuenta semáforos desde players.med_status:
-- muestra cuántos hay en verde/amarillo/rojo hoy, pero no cómo llegaron ahí.
-- Sin historial no se puede ver que alguien lleva tres sesiones seguidas en
-- amarillo, que es justo la señal que anticipa una lesión.
--
-- Esta tabla guarda un reporte por jugador y por sesión. La idea viene de la
-- rama demo/usuarios (archivada en el tag archivo/demo-usuarios), donde estaba
-- resuelta con datos falsos dentro de App.jsx; acá queda persistida y con RLS.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente.

create table if not exists injury_reports (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id)   on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  -- verde = apto, amarillo = molestia, rojo = no apto
  status      text not null default 'amarillo',
  nota        text,
  -- Qué sesión/entrenamiento se está reportando ("Lunes", "Sábado", ...).
  -- Texto libre a propósito: cada club nombra sus sesiones distinto.
  sesion      text,
  fecha       date not null default current_date,
  reported_by uuid references profiles(id),
  created_at  timestamptz default now(),
  constraint injury_status_valido check (status in ('verde','amarillo','rojo'))
);

create index if not exists injury_reports_club_fecha_idx
  on injury_reports (club_id, fecha desc);
create index if not exists injury_reports_player_idx
  on injury_reports (player_id, fecha desc);

alter table injury_reports enable row level security;

-- Todo el club puede leer el estado de salud del plantel: el jugador necesita
-- ver el suyo y el cuerpo técnico necesita verlos todos.
drop policy if exists "club ve reportes de lesion" on injury_reports;
create policy "club ve reportes de lesion" on injury_reports
  for select using (club_id = my_club_id());

-- Escribir es del cuerpo técnico, o del propio jugador sobre su ficha: quien
-- mejor sabe que le duele algo es el que entrena.
drop policy if exists "staff o dueno registra lesion" on injury_reports;
create policy "staff o dueno registra lesion" on injury_reports
  for insert with check (
    club_id = my_club_id() and (soy_staff() or es_mi_ficha(player_id))
  );

drop policy if exists "staff corrige lesion" on injury_reports;
create policy "staff corrige lesion" on injury_reports
  for update using (club_id = my_club_id() and soy_staff());

drop policy if exists "staff borra lesion" on injury_reports;
create policy "staff borra lesion" on injury_reports
  for delete using (club_id = my_club_id() and soy_staff());

-- El semáforo de la ficha queda siempre igual al último reporte, para que el
-- panel de Salud y la lista de jugadores no puedan contradecirse.
create or replace function sync_med_status()
returns trigger language plpgsql security definer
set search_path = public as $function$
begin
  update public.players
     set med_status = new.status
   where id = new.player_id
     and not exists (
       select 1 from public.injury_reports r
        where r.player_id = new.player_id
          and (r.fecha > new.fecha
               or (r.fecha = new.fecha and r.created_at > new.created_at))
     );
  return new;
end;
$function$;

drop trigger if exists injury_reports_sync_med_status on injury_reports;
create trigger injury_reports_sync_med_status
  after insert or update on injury_reports
  for each row execute function sync_med_status();
