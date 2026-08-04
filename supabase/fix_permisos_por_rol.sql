-- ══════════════════════════════════════════════════════════════
--  Permisos por rol — parche sobre el esquema actual
--  Escrito el 2026-08-04 contra el estado REAL de la base
--  (verificado con una consulta de diagnóstico, no a ciegas).
--
--  QUÉ ARREGLA — cuatro cosas:
--
--  1. La vista club_payment_info se puede ESCRIBIR. Corre como el
--     dueño (sin security_invoker), o sea que se salta el RLS de
--     club_payment_settings, y Postgres la hace actualizable por
--     ser una vista simple. Cualquier miembro del club podía
--     cambiar la cuenta bancaria donde los jugadores transfieren
--     su cuota. La app solo LEE esa vista (JugadorView.jsx:43),
--     así que revocar la escritura no rompe nada.
--
--  2. finanzas_sueldos / movimientos / gastos_admin tienen
--     política "club ... [ALL]": cualquier jugador puede leer y
--     editar los sueldos del cuerpo técnico.
--
--  3. players tiene política "club players [ALL]" y guarda rut,
--     fecha_nacimiento, isapre, seguro y contacto de emergencia.
--     Con categorías desde M6, eso es la ficha de un niño de seis
--     años editable por cualquiera del club.
--
--  4. invitations.rol no tiene restricción de valores. La política
--     de inserción revisa QUIÉN invita pero no A QUÉ ROL, y
--     accept_invitation() hace "set rol = inv.rol" sin mirar.
--     Ruta abierta: crear un club (quedas admin) → insertar una
--     invitación con rol='superadmin' → registrarte con otra
--     cuenta → superadmin de toda la plataforma.
--
--  Usa las funciones que YA existen: my_club_id(), is_superadmin().
--  No toca datos, solo permisos y políticas.
--  Para deshacerlo: fix_permisos_por_rol_revertir.sql
-- ══════════════════════════════════════════════════════════════

--  ⚠️  CÓMO CORRERLO EN EL EDITOR SQL DE SUPABASE
--  El editor parte el script por su cuenta y se pierde con los
--  cuerpos de las funciones (tienen ";" adentro). Da un
--  "syntax error at or near drop" que NO es culpa del SQL.
--  Córrelo en tres pegadas, en este orden:
--    1) la sección 3 (funciones ayudantes)
--    2) las secciones 1 y 2 (vista, invitaciones, accept_invitation)
--    3) las secciones 4 a 9 (las políticas)
--  Por eso las funciones usan la etiqueta $function$ en vez de $$.
--
--  Con `node scripts/run-sql.mjs` (o psql) va de una sola vez.
--
--  APLICADO EN PRODUCCIÓN EL 2026-08-04 — los tres bloques OK.

begin;

-- ─── 1. La vista de datos bancarios: solo lectura ─────────────
revoke insert, update, delete on club_payment_info from authenticated;
revoke insert, update, delete on club_payment_info from anon;
-- (el grant de select se mantiene: los jugadores necesitan ver
--  dónde transferir)


-- ─── 2. Invitaciones: cerrar la escalada a superadmin ─────────
-- Un solo constraint. No requiere ningún cambio en el código:
-- AdminView ya solo ofrece estos tres roles.
--
-- Va como `not valid` A PROPÓSITO: existe una fila histórica con
-- rol='admin' (Old Reds, creada y usada el 2026-08-03 con 2 minutos
-- de diferencia, insertada desde el editor SQL — sin created_by).
-- Todo indica que fue un ascenso manual hecho por el equipo, ya que
-- la interfaz no ofrece el rol admin. `not valid` deja esa fila
-- quieta como rastro histórico pero SÍ revisa todas las nuevas, que
-- es lo que importa.
alter table invitations drop constraint if exists invitations_rol_permitido;
alter table invitations add constraint invitations_rol_permitido
  check (rol in ('entrenador','preparador','jugador')) not valid;

-- Poder saber QUIÉN canjeó cada invitación. Hoy solo se guarda
-- `used_at` (cuándo), no quién — así que ante una invitación
-- sospechosa no hay forma de responder lo único que importa.
alter table invitations add column if not exists used_by uuid references profiles(id);

-- accept_invitation() con dos cambios mínimos sobre la versión que ya
-- existe (el resto es idéntico, a propósito):
--   1. guarda used_by = quién la canjeó
--   2. `for update` traba la fila mientras se revisa, para que dos
--      personas no puedan usar el mismo link al mismo tiempo
create or replace function accept_invitation(p_token text)
returns table(rol text, club_id uuid, club_name text, sport text, cats text, player_id uuid)
language plpgsql security definer
set search_path = public as $function$
declare
  inv record;
begin
  select * into inv from public.invitations where token = p_token for update;

  if inv.id is null              then raise exception 'invitacion_no_encontrada'; end if;
  if inv.used_at is not null     then raise exception 'invitacion_ya_usada';      end if;
  if inv.expires_at < now()      then raise exception 'invitacion_expirada';      end if;

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


-- ─── 3. Ayudantes de rol ──────────────────────────────────────
-- Van junto a is_superadmin() y my_club_id(), que ya existían.
create or replace function my_rol()
returns text language sql stable security definer
set search_path = public as $function$
  select rol from profiles where id = auth.uid()
$function$;

-- Cuerpo técnico: admin, entrenador o preparador
create or replace function soy_staff()
returns boolean language sql stable security definer
set search_path = public as $function$
  select coalesce(my_rol() in ('admin','entrenador','preparador'), false) or is_superadmin()
$function$;

create or replace function soy_admin()
returns boolean language sql stable security definer
set search_path = public as $function$
  select coalesce(my_rol() = 'admin', false) or is_superadmin()
$function$;

-- ¿Este player_id es mío?
create or replace function es_mi_ficha(p_player_id uuid)
returns boolean language sql stable security definer
set search_path = public as $function$
  select exists (select 1 from players where id = p_player_id and profile_id = auth.uid())
$function$;

grant execute on function my_rol()          to authenticated;
grant execute on function soy_staff()       to authenticated;
grant execute on function soy_admin()       to authenticated;
grant execute on function es_mi_ficha(uuid) to authenticated;


-- ─── 4. FINANZAS: solo el admin ───────────────────────────────
-- Las políticas "superadmin finanzas ..." que ya existen se dejan
-- intactas; solo se reemplaza la de club.
drop policy if exists "club finanzas sueldos"      on finanzas_sueldos;
drop policy if exists "club finanzas movimientos"  on finanzas_movimientos;
drop policy if exists "club finanzas gastos admin" on finanzas_gastos_admin;

create policy "admin finanzas sueldos" on finanzas_sueldos
  for all using (club_id = my_club_id() and soy_admin())
      with check (club_id = my_club_id() and soy_admin());

create policy "admin finanzas movimientos" on finanzas_movimientos
  for all using (club_id = my_club_id() and soy_admin())
      with check (club_id = my_club_id() and soy_admin());

create policy "admin finanzas gastos admin" on finanzas_gastos_admin
  for all using (club_id = my_club_id() and soy_admin())
      with check (club_id = my_club_id() and soy_admin());


-- ─── 5. PLANTEL: lo ve el club, lo edita el cuerpo técnico ────
drop policy if exists "club players" on players;

create policy "ver plantel del club" on players
  for select using (club_id = my_club_id());

create policy "staff edita plantel" on players
  for all using (club_id = my_club_id() and soy_staff())
      with check (club_id = my_club_id() and soy_staff());


-- ─── 6. CUOTAS ────────────────────────────────────────────────
-- El admin ve y gestiona todas. El jugador ve solo la suya y puede
-- DECLARAR que transfirió (usePayments.js:51), pero NO puede
-- marcarse a sí mismo como pagado: eso lo confirma el admin.
drop policy if exists "club payments" on payments;

create policy "admin gestiona cuotas" on payments
  for all using (club_id = my_club_id() and soy_admin())
      with check (club_id = my_club_id() and soy_admin());

create policy "jugador ve su cuota" on payments
  for select using (es_mi_ficha(player_id));

create policy "jugador declara su pago" on payments
  for insert with check (
    club_id = my_club_id()
    and es_mi_ficha(player_id)
    and status in ('pending','declarado')
  );

create policy "jugador marca declarado" on payments
  for update using (es_mi_ficha(player_id) and status in ('pending','declarado'))
          with check (es_mi_ficha(player_id) and status = 'declarado');


-- ─── 7. GIMNASIO ──────────────────────────────────────────────
-- Cada jugador lo suyo; el preparador y el entrenador ven el club
-- entero (lo necesita el ranking de fuerza).
drop policy if exists "own gym logs" on gym_logs;

create policy "ver gym" on gym_logs
  for select using (
    player_id in (select id from players where club_id = my_club_id())
    and (soy_staff() or es_mi_ficha(player_id))
  );

create policy "escribir gym" on gym_logs
  for all using (
    es_mi_ficha(player_id)
    or (soy_staff() and player_id in (select id from players where club_id = my_club_id()))
  )
  with check (
    es_mi_ficha(player_id)
    or (soy_staff() and player_id in (select id from players where club_id = my_club_id()))
  );


-- ─── 8. PARTIDOS, NÓMINAS, EQUIPOS, ASISTENCIA ────────────────
-- Los ve todo el club; los arma el cuerpo técnico.
drop policy if exists "club matches"    on matches;
drop policy if exists "club lineups"    on lineups;
drop policy if exists "club teams"      on teams;
drop policy if exists "club attendance" on attendance;

create policy "ver partidos" on matches for select using (club_id = my_club_id());
create policy "staff partidos" on matches for all
  using (club_id = my_club_id() and soy_staff()) with check (club_id = my_club_id() and soy_staff());

create policy "ver nominas" on lineups for select using (club_id = my_club_id());
create policy "staff nominas" on lineups for all
  using (club_id = my_club_id() and soy_staff()) with check (club_id = my_club_id() and soy_staff());

create policy "ver equipos" on teams for select using (club_id = my_club_id());
create policy "staff equipos" on teams for all
  using (club_id = my_club_id() and soy_staff()) with check (club_id = my_club_id() and soy_staff());

create policy "ver asistencia" on attendance for select using (club_id = my_club_id());
create policy "staff asistencia" on attendance for all
  using (club_id = my_club_id() and soy_staff()) with check (club_id = my_club_id() and soy_staff());


-- ─── 9. EL MURO ───────────────────────────────────────────────
-- Publica cualquiera del club; borra el autor o el cuerpo técnico.
drop policy if exists "club posts"         on posts;
drop policy if exists "club post comments" on post_comments;

create policy "ver muro" on posts for select using (club_id = my_club_id());
create policy "publicar" on posts for insert
  with check (club_id = my_club_id() and author_id = auth.uid());
create policy "editar o borrar propio post" on posts for update
  using (club_id = my_club_id() and (author_id = auth.uid() or soy_staff()))
  with check (club_id = my_club_id());
create policy "borrar post" on posts for delete
  using (club_id = my_club_id() and (author_id = auth.uid() or soy_staff()));

create policy "ver comentarios" on post_comments for select using (club_id = my_club_id());
create policy "comentar" on post_comments for insert
  with check (club_id = my_club_id() and author_id = auth.uid());
create policy "borrar comentario" on post_comments for delete
  using (club_id = my_club_id() and (author_id = auth.uid() or soy_staff()));

commit;

-- ══════════════════════════════════════════════════════════════
--  CÓMO COMPROBAR QUE FUNCIONÓ
--
--  Entra como JUGADOR, abre la consola del navegador (F12) y pega:
--
--    // 1. cambiar la cuenta bancaria del club → debe fallar
--    await supabase.from('club_payment_info')
--      .update({ numero_cuenta: 'PRUEBA' });
--
--    // 2. ver los sueldos → debe devolver vacío
--    await supabase.from('finanzas_sueldos').select('*');
--
--    // 3. borrar un jugador → debe fallar
--    await supabase.from('players').delete().eq('id', '<un id>');
--
--    // 4. ver el plantel → esto SÍ debe funcionar
--    await supabase.from('players').select('name');
--
--  Y como ADMIN, que sigan funcionando: cargar jugadores, confirmar
--  pagos, ver finanzas y generar un link de invitación.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  LO QUE ESTE PARCHE NO RESUELVE
--
--  La ficha médica de menores. `players` guarda rut, isapre,
--  seguro, fecha_nacimiento y contacto de emergencia, y con la
--  política de arriba TODO el club los sigue viendo (RLS filtra
--  filas, no columnas). Para categorías M6 a M18 eso son datos
--  de niños.
--
--  Propuesta: mover esas columnas a una tabla `fichas_medicas`
--  visible solo para el propio jugador, el preparador, el
--  entrenador y el admin. Requiere mover datos y tocar AdminView,
--  así que va en un paso aparte y con decisión de Noni.
--
--  Tampoco cambia el token de las invitaciones, que se sigue
--  generando con Math.random() en el navegador (AdminView.jsx:180).
--  Con el constraint de arriba ya no sirve para escalar privilegios,
--  pero conviene pasarlo a gen_random_bytes() en el servidor.
-- ══════════════════════════════════════════════════════════════
