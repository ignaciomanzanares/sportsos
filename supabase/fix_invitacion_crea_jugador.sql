-- ─────────────────────────────────────────────────────────────────
-- Invitar como "Jugador" no creaba la ficha en el plantel
-- ─────────────────────────────────────────────────────────────────
-- Encontrado el 2026-08-10: se invitó a alguien con el link genérico
-- (rol Jugador, plantel Superior), la persona entró bien al club — fila
-- en profiles con rol='jugador' y club_id correcto — pero el Plantel
-- seguía diciendo "0 jugadores".
--
-- La causa es que el plantel se lee de la tabla `players`, y esta
-- función solo la tocaba cuando la invitación traía un player_id (el
-- botón 🔗 sobre alguien que YA estaba en el plantel). El link genérico
-- no trae player_id, así que no se creaba ninguna ficha. Sin ficha no
-- hay asistencia, ni gym, ni convocatorias, ni cuota: la persona queda
-- dentro del club pero invisible para todo lo que importa.
--
-- Esta versión incluye además la protección anterior contra degradar de
-- rol (fix_invitacion_no_degrada.sql) — reemplaza a ese archivo.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente, se puede correr las veces que sea.

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
begin
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
    -- Link genérico de jugador: si esta persona todavía no tiene ficha en
    -- este club, se le crea una con la categoría que eligió el admin.
    select id into v_player_id
      from public.players
     where club_id = inv.club_id and profile_id = auth.uid()
     limit 1;

    if v_player_id is null then
      insert into public.players (club_id, name, category, profile_id)
      values (inv.club_id,
              coalesce(nullif(trim(yo.nombre), ''), 'Sin nombre'),
              nullif(trim(coalesce(inv.cats, '')), ''),
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

grant execute on function accept_invitation(text) to authenticated;
