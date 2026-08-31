-- ═══════════════════════════════════════════════════════════════════════════
--  ARREGLO: "column reference sport is ambiguous" al entrar con el código
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Qué pasaba: la función no funcionaba NUNCA. Cualquiera que abriera el link
--  del club veía el error crudo de Postgres y se quedaba con una cuenta creada
--  y sin club.
--
--  Por qué: `returns table(club_id uuid, club_name text, sport text, ...)`
--  declara club_id y sport como variables de salida. Dentro del cuerpo, un
--  `select id, name, sport from clubs` deja a Postgres sin saber si `sport` es
--  la columna de la tabla o la variable, y aborta.
--
--  El arreglo es ponerle apodo a cada tabla y nombrar las columnas con él, así
--  no queda ninguna suelta que se pueda confundir con una variable. No cambian
--  los nombres de salida, porque la app los lee tal cual.
--
--  Correr entero en el SQL Editor de Supabase.

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

  -- `cl.` en cada columna: sin el apodo, `sport` chocaba con la variable de
  -- salida del mismo nombre y era el error que rompía todo.
  select cl.id, cl.name, cl.sport into c
    from public.clubs cl
   where upper(trim(cl.join_code)) = upper(trim(p_codigo))
     and coalesce(cl.suspended, false) = false;

  if c.id is null then
    raise exception 'codigo_invalido';
  end if;

  select pr.rol, pr.club_id, pr.nombre into yo
    from public.profiles pr where pr.id = auth.uid();

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

  update public.profiles pr
     set club_id = c.id,
         rol     = 'jugador'
   where pr.id = auth.uid();

  -- ¿Ya tenía ficha en este club? (volvió a entrar, segundo intento)
  -- Acá `club_id` sin apodo era el siguiente choque, escondido detrás del
  -- primero: se habría caído igual apenas se arreglara `sport`.
  select pl.id into v_player_id
    from public.players pl
   where pl.club_id = c.id and pl.profile_id = auth.uid()
   limit 1;

  -- Si no, ¿hay una ficha sin dueño que sea suya? Lo normal: el plantel se
  -- cargó desde ARUSA mucho antes de que existieran las cuentas.
  if v_player_id is null then
    v_clave := public.clave_nombre(yo.nombre);

    if array_length(v_clave, 1) >= 2 then
      select array_agg(pl.id) into v_candidatas
        from public.players pl
       where pl.club_id = c.id
         and pl.profile_id is null
         and array_length(public.clave_nombre(pl.name), 1) >= 2
         and (public.clave_nombre(pl.name) <@ v_clave
              or v_clave <@ public.clave_nombre(pl.name));

      if array_length(v_candidatas, 1) = 1 then
        v_player_id := v_candidatas[1];
        update public.players pl
           set profile_id = auth.uid(),
               activo     = true   -- si estaba dado de baja y volvió, vuelve
         where pl.id = v_player_id;
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
-- restringe nada. Se repiten porque `create or replace` los conserva, pero si
-- alguna vez se recrea la función desde cero tienen que estar acá.
revoke execute on function public.unirme_con_codigo(text) from public;
revoke execute on function public.unirme_con_codigo(text) from anon;
grant  execute on function public.unirme_con_codigo(text) to authenticated;
