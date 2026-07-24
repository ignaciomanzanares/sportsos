alter table club_payment_settings add column if not exists cuota_mensual numeric;

drop view if exists club_payment_info;

create view club_payment_info as
select club_id, banco, tipo_cuenta, numero_cuenta, rut_titular, nombre_titular,
       email_titular, khipu_link, mercadopago_public_key, cuota_mensual,
       (mercadopago_access_token is not null and mercadopago_access_token <> '') as mercadopago_enabled
from club_payment_settings
where club_id = my_club_id();

grant select on club_payment_info to authenticated;
