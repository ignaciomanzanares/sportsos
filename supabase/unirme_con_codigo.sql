-- ═══════════════════════════════════════════════════════════════════════════
--  Autoservicio: entrar al club con el código, sin que el admin mande links
-- ═══════════════════════════════════════════════════════════════════════════
--
--  El problema que resuelve: hasta ahora, para que entrara una persona el
--  admin tenía que aprobar su solicitud, copiar un link y mandárselo por
--  WhatsApp. Con 109 jugadores son 109 mensajes uno por uno, y por eso el
--  club tiene 142 fichas y casi ninguna cuenta.
--
--  Ahora se manda UN link al grupo y cada uno entra solo.
--
--  Los límites de seguridad, que son lo que hace que esto sea aceptable:
--
--   · Solo crea JUGADORES. Nunca admin, entrenador ni preparador — esos
--     siguen necesitando invitación dirigida. Un código filtrado no puede
--     entregar el control del club.
--   · Exige sesión iniciada: sin auth.uid() no hace nada.
--   · No le saca el club a nadie que ya tenga uno. Si el que llama ya es
--     miembro de otro club, se rechaza en vez de mudarlo.
--   · Engancha con la ficha existente solo si hay UNA candidata por nombre.
--     Con dos Pérez no adivina: darle a alguien la ficha equivocada le
--     entrega la asistencia y los tries de otro.
--
--  Correr entero en el SQL Editor de Supabase.

-- La baja reversible de jugadores se agregó a mano en producción y nunca entró
-- al esquema base. Idempotente: si ya está, no hace nada.
alter table public.players add column if not exists activo boolean not null default true;

create or replace function public.unirme_con_codigo(p_codigo text)
returns table(club_id uuid, club_name text, sport text, player_id uuid)
language plpgsql security definer
set search_path = public as $function$
declare
  c            record;
  yo           record;
  v_player_id  uuid;
  v_clave      text[];
  v_candidatas uuid[];
begin
  if auth.uid() is null then
    raise exception 'sin_sesion';
  end if;

  select id, name, sport into c
    from public.clubs
   where upper(trim(join_code)) = upper(trim(p_codigo))
     and coalesce(suspended, false) = false;

  if c.id is null then
    raise exception 'codigo_invalido';
  end if;

  select p.rol, p.club_id, p.nombre into yo
    from public.profiles p where p.id = auth.uid();

  -- Ya es de otro club: no se lo mudamos por las buenas. Que lo saque su
  -- admin, o que use una invitación dirigida.
  if yo.club_id is not null and yo.club_id <> c.id then
    raise exception 'ya_perteneces_a_otro_club';
  end if;

  -- Si ya está en este club con un rol mayor, el código no lo degrada a
  -- jugador. Al entrenador que escanea el QR del camarín por curiosidad no
  -- se le puede caer el acceso a su propio panel.
  if yo.club_id = c.id and yo.rol in ('admin', 'entrenador', 'preparador') then
    return query select c.id, c.name, c.sport, null::uuid;
    return;
  end if;

  update public.profiles
     set club_id = c.id,
         rol     = 'jugador'
   where id = auth.uid();

  -- ¿Ya tenía ficha en este club? (volvió a entrar, segundo intento)
  select id into v_player_id
    from public.players
   where club_id = c.id and profile_id = auth.uid()
   limit 1;

  -- Si no, ¿hay una ficha sin dueño que sea suya? Lo normal: el plantel se
  -- cargó desde ARUSA mucho antes de que existieran las cuentas.
  if v_player_id is null then
    v_clave := public.clave_nombre(yo.nombre);

    if array_length(v_clave, 1) >= 2 then
      select array_agg(p.id) into v_candidatas
        from public.players p
       where p.club_id = c.id
         and p.profile_id is null
         and array_length(public.clave_nombre(p.name), 1) >= 2
         and (public.clave_nombre(p.name) <@ v_clave
              or v_clave <@ public.clave_nombre(p.name));

      if array_length(v_candidatas, 1) = 1 then
        v_player_id := v_candidatas[1];
        update public.players
           set profile_id = auth.uid(),
               activo     = true   -- si estaba dado de baja y volvió, vuelve
         where id = v_player_id;
      end if;
    end if;
  end if;

  -- Nadie calzó: ficha nueva. Es alguien que no está en los registros de
  -- ARUSA — un juvenil, un refuerzo, alguien que nunca jugó un partido.
  if v_player_id is null then
    insert into public.players (club_id, name, profile_id, activo)
    values (c.id, coalesce(nullif(trim(yo.nombre), ''), 'Sin nombre'), auth.uid(), true)
    returning id into v_player_id;
  end if;

  -- Rastro para el admin: quién entró solo y cuándo. No cuenta como
  -- "pendiente", así que no le enciende el contador de solicitudes.
  insert into public.join_requests (club_id, nombre, email, status)
  values (c.id, coalesce(yo.nombre, ''), coalesce(auth.jwt() ->> 'email', ''), 'autoservicio');

  return query select c.id, c.name, c.sport, v_player_id;
end;
$function$;

-- Postgres da EXECUTE a PUBLIC por defecto, así que un grant sin revoke no
-- restringe nada: sin esto, un anónimo podría llamarla.
revoke execute on function public.unirme_con_codigo(text) from public;
revoke execute on function public.unirme_con_codigo(text) from anon;
grant  execute on function public.unirme_con_codigo(text) to authenticated;

-- Comprobación: tiene que devolver la función y su dueño.
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc where proname = 'unirme_con_codigo';
