-- ══════════════════════════════════════════════════════════════
--  002 — Proteger `rol` y `plan` de escrituras desde el navegador
--
--  PROBLEMA QUE ARREGLA:
--  La política "own profile ... for all using (id = auth.uid())"
--  deja que cualquier usuario escriba SU PROPIA fila de profiles.
--  Como el plan (free/pro/elite) y el rol viven ahí, un jugador
--  podía abrir la consola del navegador y hacer:
--      supabase.from("profiles").update({ plan:"elite", rol:"admin" })
--  y la base de datos lo aceptaba.
--
--  CÓMO LO ARREGLA:
--  Postgres permite dar permiso de escritura por COLUMNA. Le
--  quitamos a los usuarios logueados el permiso de escribir
--  profiles entero, y se lo devolvemos solo sobre las columnas
--  inofensivas (nombre, teléfono, altura, foto...).
--  Las operaciones legítimas que esto rompe se devuelven abajo
--  como funciones que corren DENTRO de la base de datos, donde
--  el usuario no puede mentir sobre quién es.
--
--  Es idempotente: puedes correrlo varias veces sin problema.
--  Para deshacerlo: 002_revertir.sql
-- ══════════════════════════════════════════════════════════════

begin;

-- ─── 0. Asegurar columnas que el código ya usa ────────────────
-- (no estaban en schema.sql; si ya existen, esto no hace nada)
alter table public.profiles add column if not exists plan            text    not null default 'free';
alter table public.profiles add column if not exists onboarding_done boolean not null default false;


-- ─── 1. FASE A: cerrar la escritura de columnas sensibles ─────
--
-- Estas son las columnas que el usuario NO puede tocar nunca:
--   rol      → si no, se asciende a admin/superadmin
--   plan     → si no, se regala el plan Elite
--   club_id  → si no, se mete en el club de otro
--   id, created_at, invited_by → identidad, no se editan
--
-- El bloque recorre las columnas que REALMENTE existen en tu
-- base de datos y le devuelve permiso sobre todas menos esas.
-- Así funciona aunque tu tabla tenga columnas que no están en
-- schema.sql (telefono, altura_cm, etc.).

do $bloque_profiles$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'profiles'
    and column_name not in ('id','rol','plan','club_id','invited_by','created_at');

  if v_cols is null then
    raise exception 'No se encontraron columnas editables en profiles';
  end if;

  -- primero se quita todo (no se puede revocar una columna suelta
  -- si el permiso está dado sobre la tabla entera)
  execute 'revoke update on public.profiles from authenticated';
  execute 'revoke update on public.profiles from anon';

  -- y se devuelve solo lo inofensivo
  execute format('grant update (%s) on public.profiles to authenticated', v_cols);

  raise notice 'profiles: escritura permitida solo en → %', v_cols;
end $bloque_profiles$;


-- Mismo criterio para `clubs`: el admin puede editar el nombre y
-- los colores de su club, pero no su plan ni su estado de pago.
do $bloque_clubs$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'clubs'
    and column_name not in ('id','plan','plan_vence','plan_notas',
                            'plan_updated_at','suspended','created_at');

  if v_cols is null then
    raise exception 'No se encontraron columnas editables en clubs';
  end if;

  execute 'revoke update on public.clubs from authenticated';
  execute 'revoke update on public.clubs from anon';
  execute format('grant update (%s) on public.clubs to authenticated', v_cols);

  raise notice 'clubs: escritura permitida solo en → %', v_cols;
end $bloque_clubs$;


-- ─── 2. FASE B: devolver las operaciones legítimas ────────────
--
-- `security definer` = la función corre con los permisos del
-- dueño de la base, no con los del usuario. Por eso puede
-- escribir `rol` y `plan` aunque el usuario no pueda.
-- `auth.uid()` dentro de la función devuelve el usuario real,
-- y eso NO se puede falsificar desde el navegador.


-- 2.1 — Crear un club y quedar como su admin
--       (reemplaza ClubOnboarding.jsx:73 y :91)
create or replace function public.crear_club(
  p_nombre    text,
  p_sport     text,
  p_country   text default 'CL',
  p_join_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn_crear_club$
declare
  v_uid         uuid := auth.uid();
  v_club_actual uuid;
  v_club_id     uuid;
begin
  if v_uid is null then
    raise exception 'Tienes que iniciar sesión para crear un club';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El club necesita un nombre';
  end if;

  -- Candado: solo puedes hacerte admin si todavía no estás en
  -- ningún club. Si no, cualquiera podría crear un club de
  -- mentira una y otra vez para ascenderse.
  select club_id into v_club_actual from profiles where id = v_uid;
  if v_club_actual is not null then
    raise exception 'Ya perteneces a un club. Pídele a un admin que te cambie.';
  end if;

  insert into clubs (name, sport, country, join_code)
  values (trim(p_nombre), p_sport, coalesce(p_country,'CL'),
          coalesce(p_join_code, 'CLUB-' || upper(substr(md5(random()::text), 1, 4))))
  returning id into v_club_id;

  -- El plan SIEMPRE arranca en 'free'. Nunca se toma del navegador.
  update profiles
     set rol     = 'admin',
         club_id = v_club_id,
         plan    = 'free'
   where id = v_uid;

  return v_club_id;
end $fn_crear_club$;


-- 2.2 — El superadmin cambia el plan de un club
--       (reemplaza SuperAdminView.jsx:95-113)
create or replace function public.cambiar_plan(
  p_club_id uuid,
  p_plan    text,
  p_vence   date default null,
  p_notas   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn_cambiar_plan$
declare
  v_uid   uuid := auth.uid();
  v_rol   text;
  v_antes text;
begin
  select rol into v_rol from profiles where id = v_uid;

  -- Aquí está la diferencia clave: el rol se lee de la BASE DE
  -- DATOS, no de lo que el navegador diga que es.
  if v_rol is distinct from 'superadmin' then
    raise exception 'Solo el superadmin puede cambiar planes';
  end if;

  if p_plan not in ('free','pro','elite') then
    raise exception 'Plan inválido: %', p_plan;
  end if;

  select plan into v_antes from clubs where id = p_club_id;
  if v_antes is null then
    raise exception 'No existe ese club';
  end if;

  update clubs
     set plan            = p_plan,
         plan_vence      = p_vence,
         plan_notas      = p_notas,
         plan_updated_at = now()
   where id = p_club_id;

  -- Los miembros del club heredan el plan
  update profiles
     set plan = p_plan
   where club_id = p_club_id
     and rol <> 'superadmin';

  insert into plan_history (club_id, plan_antes, plan_nuevo, notas, cambiado_por)
  values (p_club_id, coalesce(v_antes,'free'), p_plan, p_notas, v_uid);
end $fn_cambiar_plan$;


-- 2.3 — El superadmin suspende o reactiva un club
--       (reemplaza SuperAdminView.jsx:115-129)
create or replace function public.suspender_club(
  p_club_id  uuid,
  p_suspender boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn_suspender_club$
declare
  v_uid  uuid := auth.uid();
  v_rol  text;
  v_plan text;
begin
  select rol into v_rol from profiles where id = v_uid;
  if v_rol is distinct from 'superadmin' then
    raise exception 'Solo el superadmin puede suspender clubes';
  end if;

  select plan into v_plan from clubs where id = p_club_id;
  if v_plan is null then
    raise exception 'No existe ese club';
  end if;

  update clubs
     set suspended       = p_suspender,
         plan_updated_at = now()
   where id = p_club_id;

  insert into plan_history (club_id, plan_antes, plan_nuevo, notas, cambiado_por)
  values (
    p_club_id,
    coalesce(v_plan,'free'),
    case when p_suspender then 'suspended' else coalesce(v_plan,'free') end,
    case when p_suspender then 'Club suspendido por superadmin'
                          else 'Club reactivado por superadmin' end,
    v_uid
  );
end $fn_suspender_club$;


-- ─── 3. Quién puede llamar a cada función ─────────────────────
-- Por defecto Postgres deja que las llame cualquiera. Lo cerramos
-- y se lo damos solo a usuarios con sesión iniciada.

revoke all on function public.crear_club(text,text,text,text)     from public, anon;
revoke all on function public.cambiar_plan(uuid,text,date,text)   from public, anon;
revoke all on function public.suspender_club(uuid,boolean)        from public, anon;

grant execute on function public.crear_club(text,text,text,text)   to authenticated;
grant execute on function public.cambiar_plan(uuid,text,date,text) to authenticated;
grant execute on function public.suspender_club(uuid,boolean)      to authenticated;

commit;

-- ══════════════════════════════════════════════════════════════
--  CÓMO COMPROBAR QUE FUNCIONÓ
--  Entra a la app como jugador, abre la consola del navegador (F12)
--  y pega esto. Tiene que fallar:
--
--    const { data:{ user } } = await supabase.auth.getUser();
--    await supabase.from("profiles")
--      .update({ plan:"elite" }).eq("id", user.id);
--
--  Antes: devolvía éxito y te dabas Elite gratis.
--  Ahora: error 42501 "permission denied for table profiles".
-- ══════════════════════════════════════════════════════════════
