-- Diagnóstico: por qué "Crear mi club gratis" deja perfiles sin club_id.
-- Todo acá es de solo lectura: no crea, no borra, no modifica nada.
-- Pegar en el SQL Editor de Supabase y correr bloque por bloque.

-- ── 1. ¿Se está creando la cuenta, y llega confirmada? ────────────────────
-- Si aparecen cuentas con email SIN CONFIRMAR, es la confirmación por correo:
-- signUp no deja sesión, claim_new_club_admin() corre sin auth.uid() y el
-- perfil queda sin club.
select u.email                                           as correo,
       u.created_at                                      as cuenta_creada,
       case when u.email_confirmed_at is null
            then 'SIN CONFIRMAR' else 'confirmada' end   as estado_email,
       coalesce(p.nombre, '❌ SIN PERFIL')                as perfil,
       coalesce(p.rol, '-')                              as rol,
       coalesce(p.club_id::text, 'sin club')             as club
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at desc
limit 15;

-- ── 2. Clubes huérfanos: creados pero sin ningún admin asignado ───────────
-- Son el rastro de los intentos que se cortaron a la mitad.
select c.id, c.name, c.sport, c.join_code, c.created_at,
       count(p.id) as perfiles_asociados
from clubs c
left join profiles p on p.club_id = c.id
group by c.id, c.name, c.sport, c.join_code, c.created_at
having count(p.id) = 0
order by c.created_at desc;

-- ── 3. Perfiles sin club, por rol ─────────────────────────────────────────
-- Los que aparezcan acá son los que hoy caen en la pantalla "sin club".
select rol, count(*) as cuantos
from profiles
where club_id is null
group by rol
order by cuantos desc;

-- ── 4. ¿Puede un anónimo insertar en clubs? ───────────────────────────────
-- Si 'anon' aparece con permiso de insert, cualquiera puede crear clubes
-- sin cuenta — es lo que permitió que quedaran los huérfanos del punto 2.
select p.polname as politica, p.polcmd as operacion,
       pg_get_expr(p.polwithcheck, p.polrelid) as with_check,
       array(select rolname from pg_roles where oid = any(p.polroles)) as roles
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname = 'clubs';
