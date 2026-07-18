-- Diagnóstico: ver qué políticas quedaron realmente creadas en join_requests
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename = 'join_requests';

-- Confirmar que RLS está activo
select relname, relrowsecurity
from pg_class
where relname = 'join_requests';
