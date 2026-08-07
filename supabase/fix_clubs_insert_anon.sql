-- Cierra la creación de clubes a usuarios autenticados.
--
-- La política actual, "anyone can create a club", es INSERT con
-- with_check = true y sin roles asignados. Sin roles, Postgres la aplica a
-- PUBLIC: eso incluye a `anon`, el rol de la clave pública que va en el
-- navegador. Cualquiera con esa clave (está en el bundle, no es secreta)
-- puede insertar clubes en producción con un curl, sin cuenta.
--
-- El flujo real nunca necesitó eso: crear un club siempre termina con
-- claim_new_club_admin(), que requiere auth.uid(). Si no hay sesión, el club
-- queda huérfano igual. Restringirlo a `authenticated` no le quita nada al
-- producto y saca la puerta abierta.
--
-- Correr con: node scripts/run-sql.mjs supabase/fix_clubs_insert_anon.sql
-- (o pegar en el SQL Editor de Supabase — es corto, no tiene cuerpos $$).

begin;

drop policy if exists "anyone can create a club" on clubs;

create policy "authenticated users can create a club"
  on clubs for insert
  to authenticated
  with check (true);

commit;

-- Verificación: la fila debe salir con roles = {authenticated}
select p.polname as politica, p.polcmd as operacion,
       array(select rolname from pg_roles where oid = any(p.polroles)) as roles
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname = 'clubs' and p.polcmd = 'a';
