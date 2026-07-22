-- URGENTE: estas 4 tablas tenían RLS desactivado — expuestas públicamente
-- a cualquiera con la anon key (datos financieros del club incluidos).

alter table finanzas_movimientos  enable row level security;
alter table finanzas_sueldos      enable row level security;
alter table finanzas_gastos_admin enable row level security;
alter table notifications         enable row level security;

drop policy if exists "club finanzas movimientos"  on finanzas_movimientos;
drop policy if exists "club finanzas sueldos"       on finanzas_sueldos;
drop policy if exists "club finanzas gastos admin"  on finanzas_gastos_admin;
drop policy if exists "club notifications"          on notifications;

create policy "club finanzas movimientos" on finanzas_movimientos  for all using (club_id = my_club_id());
create policy "club finanzas sueldos"     on finanzas_sueldos      for all using (club_id = my_club_id());
create policy "club finanzas gastos admin" on finanzas_gastos_admin for all using (club_id = my_club_id());
create policy "club notifications"        on notifications         for all using (club_id = my_club_id());

-- Superadmin también puede gestionarlas si hace falta soporte
drop policy if exists "superadmin finanzas movimientos" on finanzas_movimientos;
drop policy if exists "superadmin finanzas sueldos" on finanzas_sueldos;
drop policy if exists "superadmin finanzas gastos admin" on finanzas_gastos_admin;
drop policy if exists "superadmin notifications" on notifications;

create policy "superadmin finanzas movimientos"  on finanzas_movimientos  for all using (is_superadmin());
create policy "superadmin finanzas sueldos"      on finanzas_sueldos      for all using (is_superadmin());
create policy "superadmin finanzas gastos admin" on finanzas_gastos_admin for all using (is_superadmin());
create policy "superadmin notifications"         on notifications         for all using (is_superadmin());

-- Verificación
select relname, relrowsecurity from pg_class
where relname in ('finanzas_movimientos','finanzas_sueldos','finanzas_gastos_admin','notifications');
