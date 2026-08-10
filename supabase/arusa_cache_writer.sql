-- ─────────────────────────────────────────────────────────────────
-- Puente para que rugby-chile llene el caché de arusa de SportOS
-- ─────────────────────────────────────────────────────────────────
-- arusa.cl cierra la conexión desde Vercel y además castiga por IP con 429
-- (su Retry-After llega a días), así que SportOS no rasca: lee de este caché.
-- Quien lo llena es el proceso de rugby-chile, que ya rasca arusa con ritmo,
-- cooldown y robots — y que al escribir acá no agrega ni una petición más.
--
-- La alternativa fácil era darle la clave service_role a Render. No se hace:
-- esa clave salta TODAS las políticas de seguridad y quedaría copiada en otro
-- servicio. En vez de eso, una función SECURITY DEFINER que solo sabe hacer
-- una cosa — escribir en arusa_cache — y que exige un secreto propio,
-- revocable sin tocar nada más.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.

create table if not exists arusa_cache (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lectura pública: son datos públicos del torneo, los mismos de arusa.cl.
alter table arusa_cache enable row level security;
drop policy if exists "cualquiera lee el cache de arusa" on arusa_cache;
create policy "cualquiera lee el cache de arusa" on arusa_cache for select using (true);
-- Nadie escribe directo: solo la función de abajo, que corre como su dueño.
grant select on arusa_cache to anon, authenticated;

-- ── El secreto ───────────────────────────────────────────────────
-- Tabla sin políticas y sin permisos: ni anon ni authenticated la ven, ni
-- siquiera para contar filas. Solo la alcanza la función SECURITY DEFINER.
create table if not exists integraciones_secretos (
  nombre  text primary key,
  secreto text not null,
  creado  timestamptz not null default now()
);
alter table integraciones_secretos enable row level security;
revoke all on integraciones_secretos from anon, authenticated;

-- Genera el secreto la primera vez. Si ya existe no lo pisa: cambiarlo sin
-- querer dejaría al proceso de rugby-chile sin poder escribir.
insert into integraciones_secretos (nombre, secreto)
values ('arusa_writer', encode(gen_random_bytes(32), 'hex'))
on conflict (nombre) do nothing;

-- ── La función ───────────────────────────────────────────────────
create or replace function guardar_arusa_cache(p_clave text, p_datos jsonb, p_secreto text)
returns timestamptz
language plpgsql security definer
set search_path = public as $function$
declare
  autorizado boolean;
  cuando timestamptz;
begin
  select exists (
    select 1 from integraciones_secretos
     where nombre = 'arusa_writer' and secreto = p_secreto
  ) into autorizado;

  if not autorizado then
    raise exception 'secreto_invalido';
  end if;

  -- Las claves están acotadas a propósito: esta función no puede convertirse
  -- en un lugar donde escribir cualquier cosa si el secreto se filtra.
  if p_clave !~ '^(standings|players):(PRIMERA|INTERMEDIA|PRE_INTERMEDIA)$' then
    raise exception 'clave_no_permitida';
  end if;

  insert into arusa_cache (key, data, updated_at)
  values (p_clave, p_datos, now())
  on conflict (key) do update set data = excluded.data, updated_at = now()
  returning updated_at into cuando;

  return cuando;
end;
$function$;

grant execute on function guardar_arusa_cache(text, jsonb, text) to anon;

-- Para copiar el secreto y ponerlo en Render (córrelo aparte):
--   select secreto from integraciones_secretos where nombre = 'arusa_writer';
