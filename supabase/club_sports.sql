-- ─────────────────────────────────────────────────────────────────
-- Los deportes activos del club no se guardaban en ninguna parte
-- ─────────────────────────────────────────────────────────────────
-- El topbar mostraba Rugby, Fútbol y Basketball para todos los clubes: salía
-- de un valor fijo en App.jsx que no tenía relación con el club. Y los
-- interruptores de "Deportes activos" en Mi Club solo cambiaban ese estado en
-- memoria — se veían como una configuración, pero al recargar volvían.
--
-- clubs.sport (singular) sigue siendo el deporte principal, el que define
-- categorías y posiciones. Esta columna nueva es la lista de deportes que el
-- club realmente practica.
--
-- Cómo correrlo: pegar entero en el SQL Editor de Supabase y Run.
-- Es idempotente.

alter table clubs add column if not exists sports text[];

-- Los clubes que ya existen quedan con el deporte que eligieron al crearse,
-- que es lo que de verdad practican.
update clubs set sports = array[sport] where sports is null or cardinality(sports) = 0;

alter table clubs alter column sports set default '{}';
