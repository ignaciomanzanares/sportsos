-- ══════════════════════════════════════════════════════════════
--  DESHACER 002 — vuelve todo a como estaba
--
--  Úsalo SOLO si algo se rompió y necesitas volver atrás rápido.
--  Ojo: al correr esto, el agujero de seguridad vuelve a abrirse
--  (cualquier usuario puede darse plan Elite). Es un parche
--  temporal para no dejar la app caída, no una solución.
--
--  IMPORTANTE: si reviertes el SQL, revierte también el código
--  con:  git revert <commit>   (o git checkout de los archivos)
--  porque el frontend nuevo llama a funciones que aquí se borran.
-- ══════════════════════════════════════════════════════════════

begin;

-- Devolver el permiso de escritura sobre la tabla entera
grant update on public.profiles to authenticated;
grant update on public.clubs    to authenticated;

-- Borrar las funciones creadas
drop function if exists public.crear_club(text,text,text,text);
drop function if exists public.cambiar_plan(uuid,text,date,text);
drop function if exists public.suspender_club(uuid,boolean);

commit;

-- Nota: las columnas `plan` y `onboarding_done` que agregó el 002
-- NO se borran a propósito — el código las usa y borrarlas
-- perdería datos. Si de verdad las quieres fuera:
--   alter table public.profiles drop column plan;
--   alter table public.profiles drop column onboarding_done;
