-- ─────────────────────────────────────────────────────────────────
-- 1. El admin no podía ver a los miembros de su club
-- 2. Todo jugador nuevo nacía marcado como "al día"
-- ─────────────────────────────────────────────────────────────────
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente.

-- ── 1. Ver a los miembros del propio club ────────────────────────
-- La única policy de lectura sobre profiles era "id = auth.uid()": cada
-- persona solo se veía a sí misma. "Miembros del club" mostraba siempre 1,
-- daba igual cuánta gente hubiera, y el admin no tenía forma de saber quién
-- estaba en su club. En la vista alguien tapó el síntoma mostrando
-- players.length cuando la lista venía vacía, pero el dato seguía sin llegar.
--
-- my_club_id() tiene que pasar a SECURITY DEFINER antes de usarla acá: como
-- lee de profiles, evaluarla dentro de una policy de profiles volvería a
-- disparar la misma policy y Postgres cortaría con "infinite recursion
-- detected in policy for relation profiles". Siendo definer, esa lectura
-- interna no pasa por RLS y el ciclo se corta.
create or replace function my_club_id()
returns uuid language sql stable security definer
set search_path = public as $function$
  select club_id from public.profiles where id = auth.uid()
$function$;

drop policy if exists "club members see each other" on profiles;
create policy "club members see each other" on profiles
  for select using (club_id is not null and club_id = my_club_id());

-- ── 2. La cuota deja de mentir ───────────────────────────────────
-- players.cuota_status tenía default 'ok', o sea que alguien recién agregado
-- aparecía como "AL DÍA" sin haber pagado nunca. Al mismo tiempo el Inicio
-- cuenta los pagos de verdad, así que la misma persona salía "al día" en el
-- plantel y "0% al día" en el panel: dos pantallas contradiciéndose.
--
-- Ahora nace sin dato (null = "—"). Pasa a 'ok' cuando se confirma un pago
-- (lo hace confirmPayment en src/lib/usePayments.js) y a 'vencida' cuando el
-- admin lo marca.
alter table players alter column cuota_status drop default;

-- Las filas ya existentes que nunca tuvieron un pago confirmado también
-- estaban mintiendo: se limpian.
update players p
   set cuota_status = null
 where p.cuota_status = 'ok'
   and not exists (
     -- En la tabla la columna es status con valor 'paid'; el "estado/pagado"
     -- que se ve en el código es la traducción que hace src/lib/usePayments.js.
     select 1 from payments pa
      where pa.player_id = p.id and pa.status = 'paid'
   );
