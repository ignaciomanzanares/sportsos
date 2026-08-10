-- ─────────────────────────────────────────────────────────────────
-- accept_invitation() degradaba a quien ya tenía un rol superior
-- ─────────────────────────────────────────────────────────────────
-- Encontrado probando invitaciones el 2026-08-10: el admin de un club
-- abrió el link de invitación que él mismo había generado y quedó
-- convertido en jugador de su propio club.
--
-- La causa es que la función hacía `set rol = inv.rol` sin mirar qué rol
-- tenía la persona. Si ese admin era el único del club, el club quedaba
-- sin ningún administrador y sin manera de recuperarlo desde la app:
-- nadie podía volver a repartir invitaciones ni tocar la configuración.
--
-- Regla nueva: una invitación puede sumarte a un club o subirte de rol,
-- nunca bajarte. Si te bajaría, la función falla y — como el `raise`
-- revierte toda la transacción — el token NO se quema: sigue sirviendo
-- para la persona a la que estaba destinado.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente (create or replace), se puede correr las veces que sea.

create or replace function accept_invitation(p_token text)
returns table(rol text, club_id uuid, club_name text, sport text, cats text, player_id uuid)
language plpgsql security definer
set search_path = public as $function$
declare
  inv record;
  yo  record;
  -- Jerarquía: mayor número, más permisos. Un canje solo puede mantener
  -- o subir este número.
  rango_actual int;
  rango_nuevo  int;
begin
  select * into inv from public.invitations where token = p_token for update;

  if inv.id is null              then raise exception 'invitacion_no_encontrada'; end if;
  if inv.used_at is not null     then raise exception 'invitacion_ya_usada';      end if;
  if inv.expires_at < now()      then raise exception 'invitacion_expirada';      end if;

  select p.rol, p.club_id into yo from public.profiles p where p.id = auth.uid();

  rango_actual := case yo.rol
                    when 'admin'      then 3
                    when 'entrenador' then 2
                    when 'preparador' then 2
                    when 'jugador'    then 1
                    else 0
                  end;
  rango_nuevo  := case inv.rol
                    when 'admin'      then 3
                    when 'entrenador' then 2
                    when 'preparador' then 2
                    when 'jugador'    then 1
                    else 0
                  end;

  -- Solo protege dentro del mismo club: cambiarse de club es legítimo y
  -- ahí sí puede bajar de rango (ser admin en uno y jugador en otro).
  if yo.club_id = inv.club_id and rango_nuevo < rango_actual then
    raise exception 'invitacion_te_degrada';
  end if;

  update public.profiles
     set rol = inv.rol, club_id = inv.club_id, invited_by = inv.created_by
   where id = auth.uid();

  if inv.player_id is not null then
    update public.players set profile_id = auth.uid() where id = inv.player_id;
  end if;

  update public.invitations
     set used_at = now(), used_by = auth.uid()
   where id = inv.id;

  return query
    select inv.rol, inv.club_id, c.name, c.sport, inv.cats, inv.player_id
    from public.clubs c where c.id = inv.club_id;
end;
$function$;

grant execute on function accept_invitation(text) to authenticated;
