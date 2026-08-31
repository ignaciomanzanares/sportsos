-- ═══════════════════════════════════════════════════════════════════════════
--  Que un jugador no vea el RUT ni el teléfono de sus 142 compañeros
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Hoy la regla del plantel dice "lo ve el club", sin distinguir QUÉ del
--  plantel. Comprobado con una cuenta de jugador común: puede bajarse las 145
--  fichas enteras — 120 RUT, 119 fechas de nacimiento, 112 teléfonos, 84
--  isapres, más correos, pesos y estado médico. Con 7 cuentas eso era el
--  directorio del club entre conocidos; con 115, incluidos juveniles, es otra
--  cosa.
--
--  Para armar una nómina alcanza con nombre, puesto y estado médico. El RUT y
--  la isapre son del jugador y del cuerpo técnico, de nadie más.
--
--  RLS no puede filtrar columnas, solo filas. Así que se parte en dos:
--
--    · La tabla `players` queda para el cuerpo técnico y para la ficha
--      propia de cada uno.
--    · La vista `plantel_publico` expone las columnas del plantel —las que
--      dibujan la lista y la cancha— a cualquier miembro del club.
--
--  Correr entero en el SQL Editor de Supabase.

-- ─── 1. La vista con lo que sí puede ver todo el club ──────────────────────
--
-- security_invoker = false: la vista corre con los permisos de su dueño, así
-- que pasa por encima del RLS de `players`. Por eso filtra ella misma por
-- club — es lo único que separa un club de otro acá adentro.
drop view if exists public.plantel_publico;

create view public.plantel_publico
with (security_invoker = false) as
  select id, club_id, name, number, position, category, age,
         med_status, hia_reason, profile_id, avatar_url,
         arusa_player_id, activo, created_at
    from public.players
   where club_id = public.my_club_id();

-- Deliberadamente afuera: telefono, email, rut, fecha_nacimiento, isapre,
-- seguro, peso_kg, altura_m, contacto_emergencia_nombre,
-- contacto_emergencia_telefono y cuota_status. Los primeros son datos
-- personales; el último es quién le debe plata al club, que tampoco es
-- asunto del resto del plantel.

revoke all on public.plantel_publico from public, anon;
grant select on public.plantel_publico to authenticated;

-- ─── 2. La tabla, solo para el cuerpo técnico y para la ficha propia ───────
drop policy if exists "ver plantel del club" on public.players;

create policy "staff ve el plantel entero" on public.players
  for select using (club_id = my_club_id() and soy_staff());

-- El jugador sigue viendo su ficha completa: es la suya, y Mi Perfil la
-- necesita entera para poder editarla.
create policy "cada uno ve su propia ficha" on public.players
  for select using (profile_id = auth.uid());

-- "staff edita plantel" queda como estaba: escribir sigue siendo del cuerpo
-- técnico. Esto no cambia quién puede modificar nada, solo quién puede mirar.
