-- Agrega un booleano "mercadopago_enabled" a la vista pública, sin exponer
-- el access_token en ningún momento — solo dice si el club lo configuró.
create or replace view club_payment_info as
select club_id, banco, tipo_cuenta, numero_cuenta, rut_titular, nombre_titular,
       email_titular, khipu_link, mercadopago_public_key,
       (mercadopago_access_token is not null and mercadopago_access_token <> '') as mercadopago_enabled
from club_payment_settings
where club_id = my_club_id();

select * from club_payment_info limit 0;
