// Genera el SQL para cargar las nóminas ya jugadas, desde lo que bajó
// caps-arusa.mjs.
//
// Las nóminas empezaron a guardarse recién cuando se ataron al partido, así
// que el historial de convocatorias arrancaba vacío. Pero los datos existen:
// son las mismas nóminas partido por partido con las que se contaron los caps.
//
//   node scripts/nominas-historicas.mjs > nominas-historicas.sql
//
// El SQL no trae ni un id adentro. Los partidos los busca por fecha y los
// jugadores por nombre, usando clave_nombre() —la misma función que usa el
// ingreso por código—, así que no hay que confiar en ningún id que se haya
// copiado a mano de un lado a otro.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const leer = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

const CLUB = "a02429dc-7409-45d1-8c1e-552bf955849d";
// Solo la temporada en curso: la tabla `matches` tiene el fixture de este año.
// Sin partido al que atarse, una nómina de 2023 no tiene dónde ir.
const DESDE = Number(process.argv[2] || 2026);
const TITULARES = 15; // la formación "XV" que dibuja la cancha

const partidos = leer("caps-arusa.json");
const esc = s => String(s).replace(/'/g, "''");
const nom = s => (s == null ? "null" : `'${esc(s)}'`);

const filas = [];
let usados = 0, sinNomina = 0, convocados = 0;

for (const p of Object.values(partidos)) {
  if (p.anio < DESDE) continue;
  const nomina = p.nomina || [];
  if (nomina.length === 0) { sinNomina++; continue; }
  const fecha = String(p.fecha).slice(0, 10);

  // La cancha es posicional: el lugar 1 es el pilar, el 15 el fullback. Por eso
  // el titular va al casillero de su número, y los casilleros que nadie ocupó
  // quedan vacíos en vez de correr a todos los demás una posición.
  const cancha = Array(TITULARES).fill(null);
  const sobrantes = [];
  for (const j of nomina.filter(x => x.t === "titular")) {
    const i = j.num - 1;
    if (i >= 0 && i < TITULARES && !cancha[i]) cancha[i] = j.n;
    else sobrantes.push(j.n); // ARUSA a veces le pone un 19 a un titular
  }
  for (const n of sobrantes) {
    const libre = cancha.indexOf(null);
    if (libre !== -1) cancha[libre] = n;
  }
  cancha.forEach((n, i) => filas.push(`  ('${fecha}'::date, ${i}, ${nom(n)}, 'titular')`));

  // El banco no tiene posiciones: es una lista, ordenada por número.
  nomina.filter(x => x.t === "banca").sort((a, b) => a.num - b.num)
    .forEach((j, i) => filas.push(`  ('${fecha}'::date, ${i}, '${esc(j.n)}', 'banca')`));

  convocados += nomina.length;
  usados++;
}

console.log(`-- ═══════════════════════════════════════════════════════════════
--  Nóminas ya jugadas, cargadas desde lo que publica ARUSA
-- ═══════════════════════════════════════════════════════════════
--
--  ${usados} partidos de Primera desde ${DESDE}, ${convocados} convocatorias.
--  ${sinNomina ? `${sinNomina} partidos quedaron fuera: ARUSA nunca cargó su nómina.` : ""}
--
--  Los partidos se buscan por fecha y los jugadores por nombre con
--  clave_nombre(), que ignora acentos, orden y palabras como "de" o "del" —
--  la misma función con la que la app engancha una ficha cuando alguien entra
--  con el código del club.
--
--  Se puede correr más de una vez: si la nómina de ese partido ya existe, la
--  reemplaza en vez de duplicarla.
--
--  Antes hay que haber corrido supabase/nominas_por_partido.sql, que es el que
--  le agrega match_id a las nóminas.
--
--  Correr entero en el SQL Editor de Supabase.

with datos(fecha, lugar, nombre, tipo) as (values
${filas.join(",\n")}
),
resuelto as (
  select d.fecha, d.lugar, d.tipo,
         (select p.id from public.players p
           where p.club_id = '${CLUB}'
             and public.clave_nombre(p.name) = public.clave_nombre(d.nombre)
           limit 1) as player_id
    from datos d
   where d.nombre is not null
      or d.tipo = 'titular'   -- los casilleros vacíos de la cancha se conservan
),
armada as (
  select fecha,
         jsonb_agg(to_jsonb(player_id) order by lugar) filter (where tipo = 'titular') as slots,
         jsonb_agg(to_jsonb(player_id) order by lugar) filter (where tipo = 'banca')   as bench
    from resuelto
   group by fecha
)
insert into public.lineups (club_id, match_id, team_id, formation, slots, bench, updated_at)
select m.club_id, m.id, coalesce(m.equipo, 'A'), 'XV',
       coalesce(a.slots, '[]'::jsonb), coalesce(a.bench, '[]'::jsonb), now()
  from armada a
  join public.matches m
    on m.club_id = '${CLUB}'
   and m.match_date = a.fecha
   and m.cat = 'Primera'
on conflict (club_id, match_id) where match_id is not null
do update set slots = excluded.slots, bench = excluded.bench, updated_at = now();

-- ── Qué quedó ──────────────────────────────────────────────────────────────
-- Nóminas cargadas y, de cada una, cuántos nombres NO calzaron con una ficha
-- del plantel. En los titulares un hueco puede ser también un puesto que ARUSA
-- dejó en blanco; en el banco, siempre es un nombre que no encontró ficha.
select m.match_date, m.rival,
       (select count(*) from jsonb_array_elements(l.slots) e where e <> 'null'::jsonb) as titulares,
       (select count(*) from jsonb_array_elements(l.bench) e where e <> 'null'::jsonb) as banca,
       (select count(*) from jsonb_array_elements(l.slots || l.bench) e
         where e = 'null'::jsonb) as huecos
  from public.lineups l
  join public.matches m on m.id = l.match_id
 where l.club_id = '${CLUB}'
 order by m.match_date desc;`);
