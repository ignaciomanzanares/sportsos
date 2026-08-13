-- ─────────────────────────────────────────────────────────────────
-- Las cuotas pasan a tener mes, y la invitación se lleva el puesto
-- ─────────────────────────────────────────────────────────────────
-- Dos huecos encontrados el 2026-08-13 revisando los flujos completos.
--
-- 1) Una cuota no pertenecía a ningún mes. El estado vivía en
--    players.cuota_status, una columna suelta que nadie volvía a bajar:
--    quien pagara una vez quedaba "al día" para siempre y el club no
--    tenía cómo saber quién debe el mes en curso.
--
-- 2) El jugador elige su puesto al pedir entrar al club, pero la ficha
--    la crea accept_invitation(), que nunca veía ese dato. Se pedía una
--    información para tirarla a la basura.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente, se puede correr las veces que sea.

-- ── 1. Período de la cuota ────────────────────────────────────────
alter table public.payments add column if not exists periodo text;

comment on column public.payments.periodo is
  'Mes al que corresponde la cuota, "YYYY-MM" en hora de Chile.';

-- Las filas que ya existen se etiquetan con el mes en que se pagaron
-- (o en que vencían). Sin esto quedarían fuera de todos los meses.
update public.payments
   set periodo = to_char(
         coalesce(paid_at at time zone 'America/Santiago', due_date::timestamp, created_at at time zone 'America/Santiago'),
         'YYYY-MM')
 where periodo is null;

-- Un jugador no puede tener dos cuotas CONFIRMADAS del mismo mes: eso es
-- cobrarle dos veces. Las declaradas y las rechazadas sí pueden repetirse
-- —si el admin rechaza una transferencia, el jugador vuelve a declarar.
create unique index if not exists payments_una_pagada_por_mes
  on public.payments (player_id, periodo)
  where status = 'paid';

-- ── 2. El puesto viaja en la invitación ───────────────────────────
alter table public.invitations add column if not exists posicion text;

create or replace function accept_invitation(p_token text)
returns table(rol text, club_id uuid, club_name text, sport text, cats text, player_id uuid)
language plpgsql security definer
set search_path = public as $function$
declare
  inv record;
  yo  record;
  rango_actual int;
  rango_nuevo  int;
  v_player_id  uuid;
  v_clave      text[];
  v_candidatas uuid[];
begin
  -- Sin sesión no hay a quién asignarle nada, y seguir adelante quemaba
  -- la invitación dejando afuera al invitado de verdad.
  if auth.uid() is null then raise exception 'sin_sesion'; end if;

  select * into inv from public.invitations where token = p_token for update;

  if inv.id is null              then raise exception 'invitacion_no_encontrada'; end if;
  if inv.used_at is not null     then raise exception 'invitacion_ya_usada';      end if;
  if inv.expires_at < now()      then raise exception 'invitacion_expirada';      end if;

  select p.rol, p.club_id, p.nombre into yo
    from public.profiles p where p.id = auth.uid();

  rango_actual := case yo.rol
                    when 'admin' then 3 when 'entrenador' then 2
                    when 'preparador' then 2 when 'jugador' then 1 else 0 end;
  rango_nuevo  := case inv.rol
                    when 'admin' then 3 when 'entrenador' then 2
                    when 'preparador' then 2 when 'jugador' then 1 else 0 end;

  -- Una invitación puede sumarte o subirte de rol, nunca bajarte dentro
  -- del mismo club. El raise revierte todo, así que el token no se quema.
  if yo.club_id = inv.club_id and rango_nuevo < rango_actual then
    raise exception 'invitacion_te_degrada';
  end if;

  update public.profiles
     set rol = inv.rol, club_id = inv.club_id, invited_by = inv.created_by
   where id = auth.uid();

  v_player_id := inv.player_id;

  if v_player_id is not null then
    -- Invitación dirigida a una ficha que ya existía: se vincula.
    update public.players set profile_id = auth.uid() where id = v_player_id;

  elsif inv.rol = 'jugador' then
    -- ¿Ya tiene ficha en este club? (reingreso, segundo link)
    select id into v_player_id
      from public.players
     where club_id = inv.club_id and profile_id = auth.uid()
     limit 1;

    -- Si no, ¿hay una ficha sin dueño que sea suya? El plantel se cargó
    -- antes que las cuentas, así que lo normal es que sí.
    if v_player_id is null then
      v_clave := public.clave_nombre(yo.nombre);

      if array_length(v_clave, 1) >= 2 then
        select array_agg(p.id) into v_candidatas
          from public.players p
         where p.club_id = inv.club_id
           and p.profile_id is null
           and array_length(public.clave_nombre(p.name), 1) >= 2
           -- Uno contenido en el otro, en cualquier dirección: cubre el
           -- nombre completo y el que viene con un apellido de menos.
           and (public.clave_nombre(p.name) <@ v_clave
                or v_clave <@ public.clave_nombre(p.name));

        -- Con más de una candidata no se elige: darle a alguien la ficha
        -- equivocada le entrega la asistencia y los tries de otro.
        if array_length(v_candidatas, 1) = 1 then
          v_player_id := v_candidatas[1];
          -- El puesto que declaró al pedir entrar solo rellena el hueco.
          -- Si la ficha ya trae puesto —los 514 sacados a mano de las
          -- nóminas de Instagram— ese manda: es dónde jugó de verdad,
          -- no dónde dice que juega.
          update public.players
             set profile_id = auth.uid(),
                 category = coalesce(category, nullif(trim(coalesce(inv.cats, '')), '')),
                 position = coalesce(position, nullif(trim(coalesce(inv.posicion, '')), ''))
           where id = v_player_id;
        end if;
      end if;
    end if;

    -- Nadie calzó: ficha nueva, como antes.
    if v_player_id is null then
      insert into public.players (club_id, name, category, position, profile_id)
      values (inv.club_id,
              coalesce(nullif(trim(yo.nombre), ''), 'Sin nombre'),
              nullif(trim(coalesce(inv.cats, '')), ''),
              nullif(trim(coalesce(inv.posicion, '')), ''),
              auth.uid())
      returning id into v_player_id;
    end if;
  end if;

  update public.invitations
     set used_at = now(), used_by = auth.uid()
   where id = inv.id;

  return query
    select inv.rol, inv.club_id, c.name, c.sport, inv.cats, v_player_id
    from public.clubs c where c.id = inv.club_id;
end;
$function$;

revoke execute on function public.accept_invitation(text) from public;
revoke execute on function public.accept_invitation(text) from anon;
grant  execute on function public.accept_invitation(text) to authenticated;
