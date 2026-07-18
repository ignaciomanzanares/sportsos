-- ══════════════════════════════════════════════════════════════
--  URGENTE — Reactivar RLS en tablas expuestas públicamente
--  Ejecuta esto YA en: Supabase → SQL Editor → New query → Run
--
--  Confirmado 2026-07-17: clubs, players, matches, attendance y
--  payments respondían datos reales a peticiones anónimas (solo
--  con la anon key, sin sesión). Esto vuelve a activar las
--  políticas que ya existen en schema.sql pero que en producción
--  quedaron con RLS desactivado.
-- ══════════════════════════════════════════════════════════════

alter table clubs      enable row level security;
alter table profiles   enable row level security;
alter table players    enable row level security;
alter table teams      enable row level security;
alter table matches    enable row level security;
alter table attendance enable row level security;
alter table gym_logs   enable row level security;
alter table payments   enable row level security;
alter table posts      enable row level security;
alter table post_likes enable row level security;
alter table lineups    enable row level security;

-- Verificación rápida: después de correr esto, todas deben decir
-- rowsecurity = true.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relname in ('clubs','profiles','players','teams','matches',
                   'attendance','gym_logs','payments','posts',
                   'post_likes','lineups')
order by relname;
