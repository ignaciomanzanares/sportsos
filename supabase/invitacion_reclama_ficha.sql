-- ─────────────────────────────────────────────────────────────────
-- Un jugador que entra al club se queda con SU ficha, no crea otra
-- ─────────────────────────────────────────────────────────────────
-- Encontrado el 2026-08-11, antes de que pasara: el plantel de Old Reds
-- se llenó desde ARUSA, así que Tomás Infante ya tiene ficha —con su
-- asistencia, sus tries y su puesto— antes de haberse creado la cuenta.
--
-- Con el link genérico de jugador, accept_invitation insertaba SIEMPRE
-- una ficha nueva. O sea: el día que Tomás entre, el club pasa a tener
-- dos Tomás Infante, uno con toda la temporada y otro vacío que es el
-- que él ve. Es el mismo duplicado que acabamos de limpiar a mano, pero
-- generado por el flujo normal de la app y una vez por jugador.
--
-- Ahora, antes de crear nada, se busca una ficha de ese club que no
-- tenga dueño y cuyo nombre calce con el de quien acepta. Se compara el
-- CONJUNTO de palabras sin acentos ni mayúsculas, igual que el cruce con
-- ARUSA: "Infante Tomás" y "Tomás Infante Fantuzzi" son la misma
-- persona, y el orden de los apellidos no debería decidir nada.
--
-- Solo se reclama cuando hay UNA sola ficha candidata. Con dos —el club
-- tiene siete Pérez— se crea ficha nueva y que el admin las una: darle a
-- alguien la ficha equivocada le entrega la asistencia y las
-- estadísticas de otra persona, que es peor que un duplicado.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente, se puede correr las veces que sea.

-- ── Nombre → conjunto de palabras comparable ──────────────────────
create or replace function public.clave_nombre(p_nombre text)
returns text[]
language sql immutable
set search_path = public as $$
  select coalesce(array(
    select t
      from unnest(string_to_array(
             regexp_replace(
               lower(translate(coalesce(p_nombre, ''),
                 'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
                 'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc')),
               '[^a-z]+', ' ', 'g'),
             ' ')) as t
     where length(t) > 1
       and t not in ('de','del','la','las','los','y','da','do','van','von')
     order by t
  ), '{}'::text[]);
$$;

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
          update public.players
             set profile_id = auth.uid(),
                 category = coalesce(category, nullif(trim(coalesce(inv.cats, '')), ''))
           where id = v_player_id;
        end if;
      end if;
    end if;

    -- Nadie calzó: ficha nueva, como antes.
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
grant execute on function public.clave_nombre(text) to authenticated;
