-- ══════════════════════════════════════════════════════════════
--  SportOS — Setup COMPLETO para el proyecto Supabase de la demo
--  Pegar y ejecutar TODO este archivo de una vez en:
--  Supabase → SQL Editor → New query → Run
--
--  Después de correr esto, hay que crear los 4 usuarios de Auth
--  a mano (ver DEMO_SETUP_INSTRUCCIONES.md) y correr el UPDATE
--  final que está al fondo de este archivo (PARTE F).
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
--  PARTE A — Schema base (igual a supabase/schema.sql del repo)
-- ══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

create table if not exists clubs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  sport       text not null,
  country     text not null default 'CL',
  plan        text not null default 'starter',
  colors      jsonb default '{"primary":"#1B4332","secondary":"#FFD700"}',
  created_at  timestamptz default now()
);

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null,
  club_id     uuid references clubs(id),
  avatar_url  text,
  created_at  timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, nombre, rol, club_id)
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

create table if not exists players (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  number      int,
  position    text,
  category    text,
  age         int,
  med_status  text default 'verde',
  hia_reason  text,
  cuota_status text default 'ok',
  profile_id  uuid references profiles(id),
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table players add column if not exists avatar_url text;

create table if not exists teams (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  category    text,
  created_at  timestamptz default now()
);

create table if not exists matches (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  team_id     uuid references teams(id),
  rival       text not null,
  match_date  date not null,
  location    text,
  result      text,
  score_home  int,
  score_away  int,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists attendance (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  date        date not null,
  present     boolean default false,
  notes       text,
  unique (player_id, date)
);

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

create table if not exists payments (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  amount      numeric(12,2) not null,
  currency    text default 'CLP',
  method      text,
  status      text default 'pending',
  due_date    date,
  paid_at     timestamptz,
  created_at  timestamptz default now()
);

create table if not exists posts (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  author_id   uuid references profiles(id),
  text        text not null,
  type        text default 'general',
  created_at  timestamptz default now()
);

create table if not exists post_likes (
  post_id     uuid references posts(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists lineups (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  team_id     uuid references teams(id),
  formation   text not null,
  slots       jsonb not null default '[]',
  bench       jsonb not null default '[]',
  updated_at  timestamptz default now()
);


-- ══════════════════════════════════════════════════════════════
--  PARTE B — Columnas extra que usa el frontend (src/lib/db.js,
--  LoginScreen.jsx) y que no estaban en el schema.sql del repo —
--  las agregamos acá.
-- ══════════════════════════════════════════════════════════════

alter table profiles add column if not exists plan text default 'free';

-- db.js (saveMatch/matchToPartido) espera estas columnas en matches:
alter table matches add column if not exists hora text;
alter table matches add column if not exists estado text default 'programado';
alter table matches add column if not exists equipo text default 'A';
alter table matches add column if not exists cat text;
alter table matches add column if not exists destacados jsonb default '[]';
alter table matches add column if not exists autor text;

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  type        text default 'general',
  title       text not null,
  body        text default '',
  data        jsonb default '{}',
  created_at  timestamptz default now()
);
-- RLS de notifications se habilita más abajo, en la PARTE C, junto con
-- el resto de las tablas (necesita my_club_id(), que se crea recién ahí).


-- ══════════════════════════════════════════════════════════════
--  PARTE C — Tablas de Finanzas (usadas por FinanzasView.jsx,
--  tampoco estaban en schema.sql — columnas sacadas directo del
--  código del componente)
-- ══════════════════════════════════════════════════════════════

create table if not exists finanzas_movimientos (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  tipo        text not null,          -- ingreso | egreso
  cat         text not null,
  descripcion text not null,
  monto       numeric(12,2) not null,
  fecha       date not null,
  created_at  timestamptz default now()
);

create table if not exists finanzas_sueldos (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  nombre      text not null,
  cargo       text,
  monto       numeric(12,2) not null,
  activo      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists finanzas_gastos_admin (
  id          uuid primary key default uuid_generate_v4(),
  club_id     uuid not null references clubs(id) on delete cascade,
  cat         text not null,
  descripcion text not null,
  monto       numeric(12,2) not null,
  activo      boolean default true,
  created_at  timestamptz default now()
);


-- ══════════════════════════════════════════════════════════════
--  RLS — Row Level Security (igual criterio que schema.sql:
--  cada usuario solo ve datos de su propio club)
-- ══════════════════════════════════════════════════════════════

alter table clubs      enable row level security;
alter table profiles   enable row level security;
alter table players    enable row level security;
alter table teams      enable row level security;
alter table matches    enable row level security;
alter table attendance enable row level security;
alter table gym_logs   enable row level security;
alter table payments   enable row level security;
alter table posts      enable row level security;
alter table post_likes enable row level security;
alter table lineups    enable row level security;
alter table finanzas_movimientos  enable row level security;
alter table finanzas_sueldos      enable row level security;
alter table finanzas_gastos_admin enable row level security;
alter table notifications         enable row level security;

create or replace function my_club_id()
returns uuid language sql stable as $$
  select club_id from profiles where id = auth.uid()
$$;

drop policy if exists "club members see their club"   on clubs;
drop policy if exists "own profile"                   on profiles;
drop policy if exists "club players"                  on players;
drop policy if exists "club teams"                    on teams;
drop policy if exists "club matches"                  on matches;
drop policy if exists "club attendance"               on attendance;
drop policy if exists "own gym logs"                  on gym_logs;
drop policy if exists "club payments"                 on payments;
drop policy if exists "club posts"                    on posts;
drop policy if exists "club post likes"               on post_likes;
drop policy if exists "club lineups"                  on lineups;
drop policy if exists "club finanzas movimientos"     on finanzas_movimientos;
drop policy if exists "club finanzas sueldos"         on finanzas_sueldos;
drop policy if exists "club finanzas gastos admin"    on finanzas_gastos_admin;
drop policy if exists "club notifications"            on notifications;

create policy "club members see their club"   on clubs      for select using (id = my_club_id());
create policy "own profile"                   on profiles   for all    using (id = auth.uid());
create policy "club players"                  on players    for all    using (club_id = my_club_id());
create policy "club teams"                    on teams      for all    using (club_id = my_club_id());
create policy "club matches"                  on matches    for all    using (club_id = my_club_id());
create policy "club attendance"               on attendance for all    using (club_id = my_club_id());
create policy "own gym logs"                  on gym_logs   for all    using (player_id in (select id from players where club_id = my_club_id()));
create policy "club payments"                 on payments   for all    using (club_id = my_club_id());
create policy "club posts"                    on posts      for all    using (club_id = my_club_id());
create policy "club post likes"               on post_likes for all    using (post_id in (select id from posts where club_id = my_club_id()));
create policy "club lineups"                  on lineups    for all    using (club_id = my_club_id());
create policy "club finanzas movimientos"     on finanzas_movimientos  for all using (club_id = my_club_id());
create policy "club finanzas sueldos"         on finanzas_sueldos      for all using (club_id = my_club_id());
create policy "club finanzas gastos admin"    on finanzas_gastos_admin for all using (club_id = my_club_id());
create policy "club notifications"            on notifications         for all using (club_id = my_club_id());


-- ══════════════════════════════════════════════════════════════
--  PARTE D — Club demo (UUID fijo para poder referenciarlo
--  después al crear los usuarios de Auth)
-- ══════════════════════════════════════════════════════════════

insert into clubs (id, name, sport, country, plan, colors) values
  ('00000000-0000-4000-8000-000000000001', 'Cerro Alto RC', 'rugby', 'CL', 'elite',
   '{"primary":"#0B3D2E","secondary":"#F2B705"}')
on conflict (id) do nothing;


-- ══════════════════════════════════════════════════════════════
--  PARTE E — Plantel real (22 jugadores: 16 Superior + 6 M18)
-- ══════════════════════════════════════════════════════════════

insert into players (id, club_id, name, number, position, category, age, med_status, hia_reason, cuota_status) values
  ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','Ignacio Bravo',1,'Prop Cerrado','Superior',27,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000001','Matías Concha',2,'Hooker','Superior',25,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','Benjamín Soto',3,'Prop Abierto','Superior',28,'amarillo','Molestia en el hombro, en observación','ok'),
  ('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000001','Vicente Palma',4,'Lock','Superior',24,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000001','Agustín Reyes',5,'Lock','Superior',26,'verde',null,'vencida'),
  ('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000001','Joaquín Farías',6,'Flanker','Superior',23,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000107','00000000-0000-4000-8000-000000000001','Sebastián Rojas',7,'Flanker Ala','Superior',29,'rojo','Esguince de tobillo — fuera 2 semanas','ok'),
  ('00000000-0000-4000-8000-000000000108','00000000-0000-4000-8000-000000000001','Maximiliano Toro',8,'Número 8','Superior',27,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000109','00000000-0000-4000-8000-000000000001','Tomás Herrera',9,'Scrum Half','Superior',22,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000110','00000000-0000-4000-8000-000000000001','Cristóbal Muñoz',10,'Apertura','Superior',24,'verde',null,'vencida'),
  ('00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000001','Nicolás Aravena',11,'Ala Izq.','Superior',21,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000001','Felipe Contreras',12,'Centro','Superior',25,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000113','00000000-0000-4000-8000-000000000001','Diego Vergara',13,'Centro','Superior',26,'amarillo','Molestia muscular leve en isquiotibial','ok'),
  ('00000000-0000-4000-8000-000000000114','00000000-0000-4000-8000-000000000001','Martín Sepúlveda',14,'Ala Der.','Superior',23,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000115','00000000-0000-4000-8000-000000000001','Gabriel Castro',15,'Fullback','Superior',28,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000116','00000000-0000-4000-8000-000000000001','Emilio Salas',16,'Hooker','Superior',22,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000117','00000000-0000-4000-8000-000000000001','Franco Espejo',17,'Lock','Superior',24,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000118','00000000-0000-4000-8000-000000000001','Bastián Leiva',18,'Scrum Half','Superior',21,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000001','Renato Vidal',21,'Apertura','M18',17,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000001','Álvaro Miranda',22,'Centro','M18',18,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000001','Simón Bustos',23,'Flanker','M18',17,'verde',null,'ok'),
  ('00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000001','Cristian Order',24,'Lock','M18',18,'verde',null,'ok')
on conflict (id) do nothing;


-- ══════════════════════════════════════════════════════════════
--  PARTE F.1 — Partidos (2 jugados + 2 por jugar)
-- ══════════════════════════════════════════════════════════════

insert into matches (club_id, rival, match_date, location, result, score_home, score_away, notes, hora, estado, equipo, cat, autor, destacados) values
  ('00000000-0000-4000-8000-000000000001','Universitario RC', current_date - 14, 'Local',  'victoria', 24, 17, 'Buen partido, defensa sólida en el segundo tiempo.', '15:30', 'jugado', 'A', 'Superior', 'Carlos Vidal', '["Tomás Herrera","Gabriel Castro"]'),
  ('00000000-0000-4000-8000-000000000001','Santiago RC',       current_date - 7,  'Visita', 'derrota',  14, 21, 'Rival intenso en los rucks, mejorar disciplina.',    '13:00', 'jugado', 'A', 'Superior', 'Carlos Vidal', '["Maximiliano Toro"]'),
  ('00000000-0000-4000-8000-000000000001','Toros RC',          current_date + 6,  'Local',  null,       null, null, null,                                              '15:30', 'programado', 'A', 'Superior', null, '[]'),
  ('00000000-0000-4000-8000-000000000001','Cóndores Norte',    current_date + 13, 'Visita', null,       null, null, null,                                              '11:00', 'programado', 'A', 'Superior', null, '[]');


-- ══════════════════════════════════════════════════════════════
--  PARTE F.2 — Asistencia (últimas 3 sesiones, plantel Superior)
-- ══════════════════════════════════════════════════════════════

insert into attendance (club_id, player_id, date, present)
select '00000000-0000-4000-8000-000000000001', p.id, d.date, (random() > 0.12)
from players p
cross join (values (current_date - 9), (current_date - 6), (current_date - 2)) as d(date)
where p.category = 'Superior'
on conflict (player_id, date) do nothing;


-- ══════════════════════════════════════════════════════════════
--  PARTE F.3 — Cuotas / pagos (mes actual, plantel Superior)
-- ══════════════════════════════════════════════════════════════

insert into payments (club_id, player_id, amount, currency, method, status, due_date, paid_at)
select
  '00000000-0000-4000-8000-000000000001',
  p.id,
  45000,
  'CLP',
  (array['khipu','webpay','transferencia'])[1 + floor(random()*3)::int],
  case when p.cuota_status = 'vencida' then 'pending' when random() > 0.25 then 'paid' else 'pending' end,
  date_trunc('month', current_date)::date + 4,
  case when p.cuota_status <> 'vencida' and random() > 0.25
       then (date_trunc('month', current_date)::date + 3)::timestamptz
       else null end
from players p
where p.category = 'Superior';


-- ══════════════════════════════════════════════════════════════
--  PARTE F.4 — Finanzas del club (movimientos, sueldos, gastos)
-- ══════════════════════════════════════════════════════════════

insert into finanzas_movimientos (club_id, tipo, cat, descripcion, monto, fecha) values
  ('00000000-0000-4000-8000-000000000001','ingreso','Sponsor','Auspicio Ferretería Cerro Alto', 350000, current_date - 20),
  ('00000000-0000-4000-8000-000000000001','ingreso','Venta de entradas','Entradas vs Universitario RC', 90000, current_date - 14),
  ('00000000-0000-4000-8000-000000000001','egreso','Cancha / Arriendo','Arriendo cancha mensual', 140000, current_date - 18),
  ('00000000-0000-4000-8000-000000000001','egreso','Árbitros','Árbitros partido local', 50000, current_date - 14),
  ('00000000-0000-4000-8000-000000000001','egreso','Implementos','Pelotas y conos nuevos', 70000, current_date - 10),
  ('00000000-0000-4000-8000-000000000001','egreso','Viajes','Bus partido visitante vs Santiago RC', 110000, current_date - 7);

insert into finanzas_sueldos (club_id, nombre, cargo, monto, activo) values
  ('00000000-0000-4000-8000-000000000001','Carlos Vidal','Entrenador Principal', 850000, true),
  ('00000000-0000-4000-8000-000000000001','Andrea Molina','Preparadora Física', 620000, true);

insert into finanzas_gastos_admin (club_id, cat, descripcion, monto, activo) values
  ('00000000-0000-4000-8000-000000000001','Luz / Agua','Cuenta mensual sede', 48000, true),
  ('00000000-0000-4000-8000-000000000001','Internet','Fibra óptica sede', 30000, true),
  ('00000000-0000-4000-8000-000000000001','Contabilidad','Honorario contador', 130000, true);


-- ══════════════════════════════════════════════════════════════
--  PARTE G — Correr DESPUÉS de crear los 4 usuarios de Auth
--  (ver DEMO_SETUP_INSTRUCCIONES.md). Pone plan "elite" a todos
--  los perfiles del club para que se vean todos los módulos.
-- ══════════════════════════════════════════════════════════════

-- update profiles set plan = 'elite' where club_id = '00000000-0000-4000-8000-000000000001';

-- Vincular la cuenta del jugador demo a un jugador real del plantel
-- (reemplazar <UUID_DEL_USUARIO_JUGADOR> por el id del usuario que
-- se ve en Authentication → Users después de crearlo):
-- update players set profile_id = '<UUID_DEL_USUARIO_JUGADOR>'
--   where id = '00000000-0000-4000-8000-000000000109'; -- Tomás Herrera
