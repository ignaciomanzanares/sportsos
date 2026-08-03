-- ══════════════════════════════════════════════════════════════
--  SportOS — Schema Supabase
--  Ejecuta esto en: Supabase → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════

-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- ─── CLUBS ────────────────────────────────────────────────────
create table if not exists clubs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  sport       text not null,           -- rugby | futbol | handball | basketball | hockey
  country     text not null default 'CL',
  plan        text not null default 'starter', -- starter | pro | enterprise
  colors      jsonb default '{"primary":"#1B4332","secondary":"#FFD700"}',
  created_at  timestamptz default now(),
  join_code       text unique,          -- código para que jugadores/staff soliciten unirse (ej. RUGBY-4F2A)
  plan_vence      date,
  plan_notas      text,
  suspended       boolean not null default false,
  plan_updated_at timestamptz
);

-- Si la tabla ya existía sin estas columnas
alter table clubs add column if not exists join_code       text unique;
alter table clubs add column if not exists plan_vence      date;
alter table clubs add column if not exists plan_notas      text;
alter table clubs add column if not exists suspended       boolean not null default false;
alter table clubs add column if not exists plan_updated_at timestamptz;
alter table clubs add column if not exists arusa_club_id   text;
alter table clubs add column if not exists arusa_last_sync timestamptz;

-- ─── PROFILES (extiende auth.users) ──────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null,           -- superadmin | admin | entrenador | preparador | jugador
  club_id     uuid references clubs(id),
  avatar_url  text,
  created_at  timestamptz default now(),
  invited_by      uuid references profiles(id),
  onboarding_done boolean not null default false,
  plan            text not null default 'free',
  telefono                     text,
  direccion                    text,
  fecha_nacimiento             date,
  altura_cm                    numeric(5,2),
  peso_kg                      numeric(5,2),
  posicion_1                   text,
  posicion_2                   text,
  seguro_salud                 text,
  grupo_sanguineo              text,
  contacto_emergencia_nombre   text,
  contacto_emergencia_tel      text,
  pie_hab                      text,
  numero_camiseta              int
);

-- Si la tabla ya existía sin estas columnas
alter table profiles add column if not exists invited_by      uuid references profiles(id);
alter table profiles add column if not exists onboarding_done boolean not null default false;
alter table profiles add column if not exists plan            text not null default 'free';
-- Campos de "Mi Perfil" (PerfilView.jsx) — antes no existían y el guardado
-- fallaba en silencio (el código no revisaba el error del update).
alter table profiles add column if not exists telefono                   text;
alter table profiles add column if not exists direccion                  text;
alter table profiles add column if not exists fecha_nacimiento           date;
alter table profiles add column if not exists altura_cm                  numeric(5,2);
alter table profiles add column if not exists peso_kg                    numeric(5,2);
alter table profiles add column if not exists posicion_1                 text;
alter table profiles add column if not exists posicion_2                 text;
alter table profiles add column if not exists seguro_salud               text;
alter table profiles add column if not exists grupo_sanguineo            text;
alter table profiles add column if not exists contacto_emergencia_nombre text;
alter table profiles add column if not exists contacto_emergencia_tel    text;
alter table profiles add column if not exists pie_hab                    text;
alter table profiles add column if not exists numero_camiseta            int;

-- Si se borra un club, los perfiles de sus miembros quedan sin club_id en
-- vez de bloquear el delete (por defecto la FK no tenía ON DELETE, lo que
-- impedía borrar cualquier club con usuarios).
alter table profiles drop constraint if exists profiles_club_id_fkey;
alter table profiles add constraint profiles_club_id_fkey foreign key (club_id) references clubs(id) on delete set null;

-- Crear perfil automáticamente al registrarse
-- set search_path = public es necesario: el servicio de Auth dispara este
-- trigger en un contexto sin "public" en el search_path por defecto, así
-- que "profiles" sin calificar no se encuentra ("relation does not exist").
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, rol, club_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'jugador'),
    (new.raw_user_meta_data->>'club_id')::uuid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── PLAYERS ──────────────────────────────────────────────────
create table if not exists players (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  number      int,
  position    text,
  category    text,
  age         int,
  med_status  text default 'verde',   -- verde | amarillo | rojo
  hia_reason  text,
  cuota_status text default 'ok',     -- ok | vencida
  profile_id  uuid references profiles(id),
  avatar_url  text,
  created_at  timestamptz default now(),
  telefono                     text,
  email                        text,
  contacto_emergencia_nombre   text,
  contacto_emergencia_telefono text,
  rut               text,
  fecha_nacimiento  date,
  isapre            text,
  seguro            text,
  peso_kg           numeric(5,2),
  altura_m          numeric(3,2)
);

-- Si la tabla ya existe, agregar columnas si faltan
alter table players add column if not exists avatar_url text;
alter table players add column if not exists telefono                     text;
alter table players add column if not exists email                        text;
alter table players add column if not exists contacto_emergencia_nombre   text;
alter table players add column if not exists contacto_emergencia_telefono text;
alter table players add column if not exists rut              text;
alter table players add column if not exists fecha_nacimiento date;
alter table players add column if not exists isapre           text;
alter table players add column if not exists seguro           text;
alter table players add column if not exists peso_kg          numeric(5,2);
alter table players add column if not exists altura_m         numeric(3,2);

-- RUT único por club (permite hacer upsert al re-subir la nómina sin
-- crear duplicados); NULL no choca con NULL así que jugadores sin RUT
-- no se ven afectados.
drop index if exists players_club_rut_unique;
create unique index players_club_rut_unique on players (club_id, rut) where rut is not null;

-- ─── TEAMS (equipos dentro de un club) ───────────────────────
create table if not exists teams (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  category    text,
  created_at  timestamptz default now()
);

-- ─── MATCHES ──────────────────────────────────────────────────
create table if not exists matches (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  team_id     uuid references teams(id),
  rival       text not null,
  match_date  date not null,
  location    text,
  result      text,                   -- victoria | derrota | empate | pendiente
  score_home  int,
  score_away  int,
  notes       text,
  created_at  timestamptz default now(),
  hora        text,
  estado      text default 'programado', -- programado | jugado
  equipo      text default 'A',
  cat         text,
  destacados  jsonb default '[]',
  autor       text,
  tarjetas    jsonb default '[]'
);

-- Si la tabla ya existe, agregar columnas si faltan (db.js saveMatch() las
-- usa desde antes pero no existían — el insert fallaba en silencio)
alter table matches add column if not exists hora       text;
alter table matches add column if not exists estado     text default 'programado';
alter table matches add column if not exists equipo     text default 'A';
alter table matches add column if not exists cat        text;
alter table matches add column if not exists destacados jsonb default '[]';
alter table matches add column if not exists autor      text;
alter table matches add column if not exists tarjetas   jsonb default '[]';

-- Partidos importados automáticamente desde una fuente externa (ARUSA, etc.)
alter table matches add column if not exists external_source text;
alter table matches add column if not exists external_id     text;
create unique index if not exists matches_external_unique
  on matches (club_id, external_source, external_id)
  where external_source is not null;

-- ─── ATTENDANCE ───────────────────────────────────────────────
create table if not exists attendance (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  date        date not null,
  present     boolean default false,
  notes       text,
  unique (player_id, date)
);

-- ─── GYM LOGS ─────────────────────────────────────────────────
create table if not exists gym_logs (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid not null references players(id) on delete cascade,
  exercise    text not null,
  set_index   int not null,
  weight_kg   numeric(6,2),
  reps        int,
  rpe         int,
  one_rm_kg   numeric(6,2) generated always as (weight_kg * (1 + reps::numeric/30)) stored,
  volume_kg   numeric(8,2) generated always as (weight_kg * reps) stored,
  week_start  date,
  logged_at   timestamptz default now(),
  unique (player_id, exercise, set_index, week_start)
);

-- ─── PAYMENTS (cuotas) ────────────────────────────────────────
create table if not exists payments (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  amount      numeric(12,2) not null,
  currency    text default 'CLP',
  method      text,                   -- khipu | webpay | transferencia
  status      text default 'pending', -- pending | declarado | paid | failed
  due_date    date,
  paid_at     timestamptz,
  created_at  timestamptz default now(),
  mercadopago_payment_id text
);

alter table payments add column if not exists mercadopago_payment_id text;

-- ─── POSTS (el Muro) ──────────────────────────────────────────
create table if not exists posts (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  author_id   uuid references profiles(id),
  text        text not null,
  type        text default 'general',  -- general | resultado | medico | admin | advertencia
  created_at  timestamptz default now()
);

create table if not exists post_likes (
  post_id     uuid references posts(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists post_comments (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid not null references posts(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  author_id   uuid references profiles(id),
  author_name text not null,
  text        text not null,
  created_at  timestamptz default now()
);

-- ─── JOIN REQUESTS (solicitudes de unión vía código de club) ──
create table if not exists join_requests (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  nombre      text not null,
  email       text not null,
  posicion    text,
  categoria   text,
  status      text not null default 'pendiente', -- pendiente | aprobado | rechazado
  created_at  timestamptz default now()
);

-- ─── PLAN HISTORY (historial de cambios de membresía) ─────────
create table if not exists plan_history (
  id            uuid primary key default uuid_generate_v4(),
  club_id       uuid not null references clubs(id) on delete cascade,
  plan_antes    text,
  plan_nuevo    text,
  notas         text,
  cambiado_por  uuid references profiles(id),
  created_at    timestamptz default now()
);

-- Corrige nombres de columna si la tabla ya existía con los nombres antiguos
alter table plan_history add column if not exists plan_antes   text;
alter table plan_history add column if not exists cambiado_por uuid references profiles(id);
alter table plan_history drop column if exists plan_anterior;
alter table plan_history drop column if exists changed_by;

-- ─── CLUB REQUESTS (auditoría de clubes creados por self-serve) ───
-- La creación de club sigue siendo instantánea (ver "anyone can create a
-- club"), pero acá queda un registro para que el superadmin pueda revisar
-- quién creó qué club y cuándo.
create table if not exists club_requests (
  id                 uuid primary key default uuid_generate_v4(),
  club_id            uuid references clubs(id) on delete set null,
  nombre_club        text not null,
  deporte            text,
  pais               text,
  nombre_solicitante text,
  email_solicitante  text,
  status             text not null default 'auto-aprobado',
  visto              boolean not null default false,
  created_at         timestamptz default now()
);

alter table club_requests add column if not exists visto boolean not null default false;

-- ─── INVITATIONS (respaldo real de los links de invitación) ───
-- El token deja de ser cosmético: cada link generado por un admin
-- crea una fila acá, y accept_invitation() es la única vía que
-- asigna rol/club_id a un perfil nuevo (ver sección RLS más abajo).
create table if not exists invitations (
  id          uuid primary key default uuid_generate_v4(),
  token       text not null unique,
  club_id     uuid not null references clubs(id) on delete cascade,
  rol         text not null,
  cats        text,
  player_id   uuid references players(id),
  created_by  uuid references profiles(id),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

-- ─── LINEUPS (nóminas) ────────────────────────────────────────
-- team_id es TEXT a propósito (no uuid/FK a teams): la app identifica
-- equipos con ids fijos en código ("primer","reserva","sub20", ver
-- src/data/sports.js TEAMS), no con filas reales de la tabla teams.
create table if not exists lineups (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  team_id     text,
  formation   text not null,
  slots       jsonb not null default '[]',  -- array de player_ids por posición
  bench       jsonb not null default '[]',  -- array de player_ids en el banco
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

-- Si la tabla ya existía con team_id uuid+FK (bloqueaba todo guardado real)
alter table lineups drop constraint if exists lineups_team_id_fkey;
alter table lineups alter column team_id type text using team_id::text;
alter table lineups add column if not exists created_at timestamptz default now();

-- ══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  Cada usuario solo ve datos de su propio club
-- ══════════════════════════════════════════════════════════════

alter table clubs      enable row level security;
alter table profiles   enable row level security;
alter table players    enable row level security;
alter table teams      enable row level security;
alter table matches    enable row level security;
alter table attendance enable row level security;
alter table gym_logs   enable row level security;
alter table payments   enable row level security;
alter table posts         enable row level security;
alter table post_likes    enable row level security;
alter table post_comments enable row level security;
alter table lineups       enable row level security;
alter table join_requests enable row level security;
alter table plan_history  enable row level security;
alter table invitations   enable row level security;
alter table club_requests enable row level security;

-- Función auxiliar: obtener club_id del usuario actual
create or replace function my_club_id()
returns uuid language sql stable
set search_path = public as $$
  select club_id from public.profiles where id = auth.uid()
$$;

-- Funciones auxiliares SECURITY DEFINER: se usan DENTRO de políticas de
-- la propia tabla profiles, así que deben ser security definer para no
-- volver a disparar las políticas de profiles y causar recursión.
create or replace function is_superadmin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'superadmin')
$$;

create or replace function current_profile_snapshot()
returns table(rol text, club_id uuid, plan text)
language sql stable security definer
set search_path = public as $$
  select rol, club_id, plan from public.profiles where id = auth.uid()
$$;

-- Eliminar políticas si ya existen (para poder re-ejecutar el script)
drop policy if exists "club members see their club"   on clubs;
drop policy if exists "anyone can create a club"      on clubs;
drop policy if exists "club admin updates own club"   on clubs;
drop policy if exists "superadmin manages all clubs"  on clubs;
drop policy if exists "own profile"                   on profiles;
drop policy if exists "own profile select"            on profiles;
drop policy if exists "own profile insert"            on profiles;
drop policy if exists "own profile update"            on profiles;
drop policy if exists "superadmin manages all profiles" on profiles;
drop policy if exists "club players"                  on players;
drop policy if exists "club teams"                    on teams;
drop policy if exists "club matches"                  on matches;
drop policy if exists "club attendance"               on attendance;
drop policy if exists "own gym logs"                  on gym_logs;
drop policy if exists "club payments"                 on payments;
drop policy if exists "club posts"                    on posts;
drop policy if exists "club post likes"               on post_likes;
drop policy if exists "club post comments"            on post_comments;
drop policy if exists "club lineups"                  on lineups;
drop policy if exists "anyone can request to join"    on join_requests;
drop policy if exists "club admins see join requests" on join_requests;
drop policy if exists "club admins update join requests" on join_requests;
drop policy if exists "superadmin manages plan history"  on plan_history;
drop policy if exists "club admins create invitations"    on invitations;
drop policy if exists "club admins see their invitations" on invitations;
drop policy if exists "anyone can log a club request"     on club_requests;
drop policy if exists "superadmin sees club requests"     on club_requests;
drop policy if exists "superadmin marks club requests seen" on club_requests;

-- Políticas: solo ver/editar registros de tu club
create policy "club members see their club"   on clubs      for select using (id = my_club_id());

-- Cualquiera puede crear un club nuevo (self-serve signup, ClubOnboarding.jsx)
create policy "anyone can create a club" on clubs for insert with check (true);

-- El admin de un club puede editar SU club (join_code, colores, etc.)
create policy "club admin updates own club" on clubs for update using (
  id = my_club_id() and exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
);
-- El superadmin gestiona todos los clubes (reemplaza el policy viejo hardcodeado por UUID)
create policy "superadmin manages all clubs" on clubs for all using (is_superadmin());

-- profiles: separado en select/insert/update para poder restringir qué
-- columnas puede tocar un usuario normal sobre SU PROPIA fila.
create policy "own profile select" on profiles for select using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());

-- Un usuario normal puede actualizar su propia fila, PERO no puede cambiar
-- su propio rol/club_id/plan (eso solo lo hace accept_invitation(), que es
-- SECURITY DEFINER y por lo tanto no pasa por esta política, o el superadmin).
-- Esto cierra el hueco por el que cualquier cuenta podía auto-asignarse
-- rol:"superadmin" haciendo un update directo a su propio perfil.
create policy "own profile update" on profiles for update using (id = auth.uid()) with check (
  id = auth.uid() and (
    is_superadmin()
    or (
      rol = (select rol from current_profile_snapshot())
      and club_id is not distinct from (select club_id from current_profile_snapshot())
      and plan = (select plan from current_profile_snapshot())
    )
  )
);
-- El superadmin gestiona cualquier perfil (reemplaza el policy viejo hardcodeado por UUID)
create policy "superadmin manages all profiles" on profiles for all using (is_superadmin());

create policy "club players"                  on players    for all    using (club_id = my_club_id());
create policy "club teams"                    on teams      for all    using (club_id = my_club_id());
create policy "club matches"                  on matches    for all    using (club_id = my_club_id());
create policy "club attendance"               on attendance for all    using (club_id = my_club_id());
create policy "own gym logs"                  on gym_logs   for all    using (player_id in (select id from players where club_id = my_club_id()));
create policy "club payments"                 on payments   for all    using (club_id = my_club_id());
create policy "club posts"                    on posts      for all    using (club_id = my_club_id());
create policy "club post likes"               on post_likes for all    using (post_id in (select id from posts where club_id = my_club_id()));
create policy "club post comments"            on post_comments for all using (club_id = my_club_id());
create policy "club lineups"                  on lineups    for all    using (club_id = my_club_id());

-- Cualquiera (sin cuenta) puede enviar una solicitud de unión con un código válido
create policy "anyone can request to join" on join_requests for insert with check (true);

-- Solo admin/entrenador del club correspondiente ven y gestionan sus solicitudes
create policy "club admins see join requests" on join_requests for select using (
  club_id in (select club_id from profiles where id = auth.uid() and rol in ('admin','entrenador'))
);
create policy "club admins update join requests" on join_requests for update using (
  club_id in (select club_id from profiles where id = auth.uid() and rol = 'admin')
);

-- Solo superadmin gestiona el historial de planes
create policy "superadmin manages plan history" on plan_history for all using (
  exists (select 1 from profiles where id = auth.uid() and rol = 'superadmin')
);

-- Función pública (RPC): buscar club por join_code sin exponer toda la fila
-- (evita filtrar plan_notas, suspended, etc. a un visitante anónimo)
create or replace function lookup_club_by_code(p_code text)
returns table(id uuid, name text, sport text)
language sql security definer stable
set search_path = public as $$
  select id, name, sport from public.clubs where join_code = upper(p_code);
$$;
grant execute on function lookup_club_by_code(text) to anon, authenticated;

-- Cualquiera puede dejar un registro de auditoría al crear un club (mismo
-- momento que "anyone can create a club" — puede ser antes de autenticarse)
create policy "anyone can log a club request" on club_requests for insert with check (true);
-- Solo el superadmin revisa el historial de clubes creados y marca cuáles ya vio
create policy "superadmin sees club requests" on club_requests for select using (is_superadmin());
create policy "superadmin marks club requests seen" on club_requests for update using (is_superadmin());

-- Solo admin/entrenador de un club pueden generar invitaciones para su club
create policy "club admins create invitations" on invitations for insert with check (
  club_id in (select club_id from profiles where id = auth.uid() and rol in ('admin','entrenador'))
);
-- Y ver las que ellos mismos generaron (auditoría/UI)
create policy "club admins see their invitations" on invitations for select using (
  club_id in (select club_id from profiles where id = auth.uid() and rol in ('admin','entrenador'))
);

-- RPC: única vía para canjear un link de invitación y asignar rol/club_id.
-- SECURITY DEFINER: valida el token contra la tabla invitations (no confía
-- en nada que venga del cliente) y solo entonces escribe en profiles/players.
create or replace function accept_invitation(p_token text)
returns table(rol text, club_id uuid, club_name text, sport text, cats text, player_id uuid)
language plpgsql security definer
set search_path = public as $$
declare
  inv record;
begin
  select * into inv from public.invitations where token = p_token;

  if inv.id is null then
    raise exception 'invitacion_no_encontrada';
  end if;
  if inv.used_at is not null then
    raise exception 'invitacion_ya_usada';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitacion_expirada';
  end if;

  update public.profiles
    set rol = inv.rol, club_id = inv.club_id, invited_by = inv.created_by
    where id = auth.uid();

  if inv.player_id is not null then
    update public.players set profile_id = auth.uid() where id = inv.player_id;
  end if;

  update public.invitations set used_at = now() where id = inv.id;

  return query
    select inv.rol, inv.club_id, c.name, c.sport, inv.cats, inv.player_id
    from public.clubs c where c.id = inv.club_id;
end;
$$;
grant execute on function accept_invitation(text) to authenticated;

-- RPC: reclamar el rol de admin de un club RECIÉN CREADO (self-serve signup,
-- ClubOnboarding.jsx). Solo funciona si el club todavía no tiene ningún admin,
-- para que no sirva para tomar control de un club ya existente.
create or replace function claim_new_club_admin(p_club_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if exists (select 1 from public.profiles where club_id = p_club_id and rol = 'admin') then
    raise exception 'club_ya_tiene_admin';
  end if;
  update public.profiles set rol = 'admin', club_id = p_club_id where id = auth.uid();
end;
$$;
grant execute on function claim_new_club_admin(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════
--  PAGOS — datos de transferencia manual del club + confirmación
-- ══════════════════════════════════════════════════════════════

-- Separada de "clubs" a propósito: datos sensibles (número de cuenta, y
-- más adelante el access token de Mercado Pago) que NO debe ver cualquier
-- miembro del club — solo el admin (y superadmin).
create table if not exists club_payment_settings (
  club_id                  uuid primary key references clubs(id) on delete cascade,
  banco                    text,
  tipo_cuenta              text,
  numero_cuenta            text,
  rut_titular              text,
  nombre_titular           text,
  email_titular            text,
  khipu_link               text,
  mercadopago_public_key   text,
  mercadopago_access_token text,
  cuota_mensual            numeric,
  updated_at               timestamptz default now()
);

alter table club_payment_settings enable row level security;

drop policy if exists "club admin manages payment settings" on club_payment_settings;
drop policy if exists "superadmin manages all payment settings" on club_payment_settings;

create policy "club admin manages payment settings" on club_payment_settings for all using (
  club_id = my_club_id() and exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
);
create policy "superadmin manages all payment settings" on club_payment_settings for all using (is_superadmin());

-- Vista pública (sin el access_token de Mercado Pago) para que los
-- jugadores vean dónde transferir. A propósito SIN security_invoker —
-- necesita correr como el owner para saltarse la política admin-only de
-- la tabla base; el filtro por club_id = my_club_id() adentro de la vista
-- es lo que la hace segura igual (cada uno solo ve su propio club).
create or replace view club_payment_info as
select club_id, banco, tipo_cuenta, numero_cuenta, rut_titular, nombre_titular,
       email_titular, khipu_link, mercadopago_public_key, cuota_mensual,
       (mercadopago_access_token is not null and mercadopago_access_token <> '') as mercadopago_enabled
from club_payment_settings
where club_id = my_club_id();

grant select on club_payment_info to authenticated;

-- Nuevo estado intermedio en payments: el jugador "declara" que transfirió,
-- pero queda pendiente de que el admin lo confirme manualmente.
comment on column payments.status is 'pending | declarado | paid | failed';

-- ══════════════════════════════════════════════════════════════
--  FINANZAS DEL CLUB (movimientos, sueldos, gastos fijos)
-- ══════════════════════════════════════════════════════════════

create table if not exists finanzas_movimientos (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  tipo        text not null, -- 'ingreso' | 'egreso'
  cat         text not null,
  descripcion text not null,
  monto       numeric not null,
  fecha       date not null,
  created_at  timestamptz default now()
);

create table if not exists finanzas_sueldos (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  nombre      text not null,
  cargo       text,
  monto       numeric not null,
  activo      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists finanzas_gastos_admin (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  cat         text not null,
  descripcion text not null,
  monto       numeric not null,
  activo      boolean default true,
  created_at  timestamptz default now()
);

alter table finanzas_movimientos  enable row level security;
alter table finanzas_sueldos      enable row level security;
alter table finanzas_gastos_admin enable row level security;

drop policy if exists "club finanzas movimientos" on finanzas_movimientos;
drop policy if exists "superadmin finanzas movimientos" on finanzas_movimientos;
drop policy if exists "club finanzas sueldos" on finanzas_sueldos;
drop policy if exists "superadmin finanzas sueldos" on finanzas_sueldos;
drop policy if exists "club finanzas gastos admin" on finanzas_gastos_admin;
drop policy if exists "superadmin finanzas gastos admin" on finanzas_gastos_admin;

create policy "club finanzas movimientos" on finanzas_movimientos for all using (club_id = my_club_id());
create policy "superadmin finanzas movimientos" on finanzas_movimientos for all using (is_superadmin());
create policy "club finanzas sueldos" on finanzas_sueldos for all using (club_id = my_club_id());
create policy "superadmin finanzas sueldos" on finanzas_sueldos for all using (is_superadmin());
create policy "club finanzas gastos admin" on finanzas_gastos_admin for all using (club_id = my_club_id());
create policy "superadmin finanzas gastos admin" on finanzas_gastos_admin for all using (is_superadmin());

-- ══════════════════════════════════════════════════════════════
--  PLAN DE GIMNASIO (microciclo del preparador físico)
-- ══════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════
--  DATOS DE PRUEBA (opcional — borra si no los necesitas)
-- ══════════════════════════════════════════════════════════════

-- insert into clubs (id, name, sport, country, plan) values
--   ('00000000-0000-0000-0000-000000000001', 'Toros RC', 'rugby', 'CL', 'pro');
