-- ── Datos de pago del club (transferencia manual) + confirmación ──────────

-- Tabla con los datos de pago del club. Separada de "clubs" a propósito:
-- contiene datos sensibles (número de cuenta, y más adelante el access
-- token de Mercado Pago) que NO deben ser visibles para cualquier miembro
-- del club — solo el admin (y superadmin) puede leerla/editarla.
create table if not exists club_payment_settings (
  club_id                 uuid primary key references clubs(id) on delete cascade,
  banco                   text,
  tipo_cuenta             text,
  numero_cuenta           text,
  rut_titular             text,
  nombre_titular          text,
  email_titular           text,
  khipu_link              text,
  mercadopago_public_key  text,
  mercadopago_access_token text,
  updated_at              timestamptz default now()
);

alter table club_payment_settings enable row level security;

drop policy if exists "club admin manages payment settings" on club_payment_settings;
drop policy if exists "superadmin manages all payment settings" on club_payment_settings;

create policy "club admin manages payment settings" on club_payment_settings for all using (
  club_id = my_club_id() and exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
);
create policy "superadmin manages all payment settings" on club_payment_settings for all using (is_superadmin());

-- Vista pública (sin el access_token de Mercado Pago) para que los
-- jugadores vean dónde transferir. OJO: a propósito NO lleva
-- security_invoker — necesita correr como el owner para saltarse la
-- política admin-only de la tabla base; el filtro por club_id = my_club_id()
-- adentro de la vista es lo que la hace segura igual (cada uno solo ve su
-- propio club, sin importar su rol).
create or replace view club_payment_info as
select club_id, banco, tipo_cuenta, numero_cuenta, rut_titular, nombre_titular,
       email_titular, khipu_link, mercadopago_public_key
from club_payment_settings
where club_id = my_club_id();

grant select on club_payment_info to authenticated;

-- Nuevo estado intermedio en payments: el jugador "declara" que transfirió,
-- pero queda pendiente de que el admin lo confirme manualmente.
comment on column payments.status is 'pending | declarado | paid | failed';

-- Verificación
select table_name from information_schema.tables where table_name = 'club_payment_settings';
select table_name from information_schema.views where table_name = 'club_payment_info';
