-- ─────────────────────────────────────────────────────────────────
-- Canjear una invitación exige haber iniciado sesión
-- ─────────────────────────────────────────────────────────────────
-- Encontrado el 2026-08-13 probando el flujo contra producción con la
-- llave anónima: accept_invitation() respondía. En Postgres, toda
-- función nace con EXECUTE para PUBLIC, así que el "grant ... to
-- authenticated" del schema no restringía nada — solo repetía un
-- permiso que ya estaba.
--
-- Con un token válido y sin sesión, la función corría igual con
-- auth.uid() = null: no le asignaba el club a nadie (no hay a quién),
-- pero SÍ marcaba la invitación como usada y dejaba una ficha
-- "Sin nombre" en el plantel. O sea, quien tuviera el link —o lo
-- reenviara sin querer— podía dejar afuera al invitado de verdad.
--
-- La app nunca provoca esto: InvitationScreen.jsx ya no canjea si el
-- signUp no devolvió sesión. Esto cierra la puerta directa a la API.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente.

revoke execute on function public.accept_invitation(text) from public;
revoke execute on function public.accept_invitation(text) from anon;
grant  execute on function public.accept_invitation(text) to authenticated;
