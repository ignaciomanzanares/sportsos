-- ══════════════════════════════════════════════════════════════
--  DIAGNÓSTICO — solo lectura, no cambia NADA
--  Córrelo en: Supabase → SQL Editor → New query → Run
--  Copia el resultado y pásaselo a Claude antes de aplicar 002.
-- ══════════════════════════════════════════════════════════════

-- 1) ¿Qué columnas tienen realmente profiles y clubs?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles','clubs')
order by table_name, ordinal_position;

-- 2) ¿Qué políticas RLS hay hoy, y sobre qué tablas?
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) ¿Qué tablas tienen RLS activado? (las que digan false están abiertas)
select relname as tabla, relrowsecurity as rls_activado
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;

-- 4) ¿Qué permisos de escritura tienen hoy los usuarios logueados?
select table_name, privilege_type, string_agg(coalesce(column_name,'TABLA ENTERA'), ', ')
from (
  select table_name, privilege_type, null::text as column_name
  from information_schema.table_privileges
  where grantee = 'authenticated' and table_schema = 'public'
    and privilege_type in ('UPDATE','INSERT','DELETE')
  union all
  select table_name, privilege_type, column_name
  from information_schema.column_privileges
  where grantee = 'authenticated' and table_schema = 'public'
    and privilege_type = 'UPDATE'
) t
group by table_name, privilege_type
order by table_name, privilege_type;

-- 5) ¿Existen las tablas que el código usa?
select t.nombre as tabla_que_usa_el_codigo,
       (to_regclass('public.' || t.nombre) is not null) as existe
from unnest(array[
  'notifications','join_requests','post_comments','plan_history',
  'finanzas_movimientos','finanzas_sueldos','finanzas_gastos_admin','invitations'
]) as t(nombre)
order by 1;
