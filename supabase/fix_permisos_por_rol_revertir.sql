-- ══════════════════════════════════════════════════════════════
--  DESHACER fix_permisos_por_rol.sql
--
--  Vuelve a las políticas de "si eres del club, puedes todo".
--  Úsalo solo si algo se rompió y necesitas la app funcionando ya.
--  Ojo: al correr esto vuelven los cuatro problemas — incluida la
--  cuenta bancaria editable por cualquier miembro del club.
-- ══════════════════════════════════════════════════════════════

begin;

-- Políticas nuevas fuera
drop policy if exists "admin finanzas sueldos"      on finanzas_sueldos;
drop policy if exists "admin finanzas movimientos"  on finanzas_movimientos;
drop policy if exists "admin finanzas gastos admin" on finanzas_gastos_admin;
drop policy if exists "ver plantel del club"        on players;
drop policy if exists "staff edita plantel"         on players;
drop policy if exists "admin gestiona cuotas"       on payments;
drop policy if exists "jugador ve su cuota"         on payments;
drop policy if exists "jugador declara su pago"     on payments;
drop policy if exists "jugador marca declarado"     on payments;
drop policy if exists "ver gym"                     on gym_logs;
drop policy if exists "escribir gym"                on gym_logs;
drop policy if exists "ver partidos"                on matches;
drop policy if exists "staff partidos"              on matches;
drop policy if exists "ver nominas"                 on lineups;
drop policy if exists "staff nominas"               on lineups;
drop policy if exists "ver equipos"                 on teams;
drop policy if exists "staff equipos"               on teams;
drop policy if exists "ver asistencia"              on attendance;
drop policy if exists "staff asistencia"            on attendance;
drop policy if exists "ver muro"                    on posts;
drop policy if exists "publicar"                    on posts;
drop policy if exists "editar o borrar propio post" on posts;
drop policy if exists "borrar post"                 on posts;
drop policy if exists "ver comentarios"             on post_comments;
drop policy if exists "comentar"                    on post_comments;
drop policy if exists "borrar comentario"           on post_comments;

-- Políticas originales de vuelta
create policy "club finanzas sueldos"      on finanzas_sueldos      for all using (club_id = my_club_id());
create policy "club finanzas movimientos"  on finanzas_movimientos  for all using (club_id = my_club_id());
create policy "club finanzas gastos admin" on finanzas_gastos_admin for all using (club_id = my_club_id());
create policy "club players"               on players               for all using (club_id = my_club_id());
create policy "club payments"              on payments              for all using (club_id = my_club_id());
create policy "club matches"               on matches               for all using (club_id = my_club_id());
create policy "club lineups"               on lineups               for all using (club_id = my_club_id());
create policy "club teams"                 on teams                 for all using (club_id = my_club_id());
create policy "club attendance"            on attendance            for all using (club_id = my_club_id());
create policy "club posts"                 on posts                 for all using (club_id = my_club_id());
create policy "club post comments"         on post_comments         for all using (club_id = my_club_id());
create policy "own gym logs"               on gym_logs              for all
  using (player_id in (select id from players where club_id = my_club_id()));

commit;

-- El constraint de roles en invitations NO se borra a propósito:
-- es lo que impide crear una invitación de superadmin y no rompe
-- nada. Si de verdad lo quieres fuera:
--   alter table invitations drop constraint invitations_rol_permitido;

-- El revoke sobre club_payment_info tampoco se deshace: la app solo
-- lee esa vista, así que devolver la escritura no arregla nada y sí
-- reabre el camino a cambiar la cuenta bancaria. Si aun así lo
-- necesitas:
--   grant insert, update, delete on club_payment_info to authenticated;
