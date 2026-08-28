/**
 * Convierte lo bajado por caps-arusa.mjs en el archivo que lee la app.
 *
 * Un cap = jugó el partido: arrancó de titular, o entró desde la banca. Los
 * partidos donde arusa no cargó la nómina se cuentan aparte y se reportan,
 * porque son caps que existieron y no vamos a poder contar nunca.
 *
 * Uso: node scripts/caps-consolidar.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { clave, limpiarNombre, leerCorrecciones, leerRescate, quienJugo, anotacionesDe, sinNomina } from "./caps-lib.mjs";

const CRUDO = JSON.parse(readFileSync("scripts/caps-arusa.json", "utf8"));
const CORR = leerCorrecciones();
const RESC = leerRescate();
const SALIDA = "src/data/capsHistoricos.json";



const porJugador = new Map();
const cobertura = {};

let corregidos = 0;
for (const [mid, partido] of Object.entries(CRUDO)) {
  const a = String(partido.anio);
  const fecha = String(partido.fecha).slice(0, 10);
  cobertura[a] = cobertura[a] || { partidos: 0, conNomina: 0 };
  cobertura[a].partidos++;
  if (!sinNomina(partido)) cobertura[a].conNomina++;

  const jugaron = quienJugo(partido, CORR, RESC[mid]);
  // Cuántas veces mandó la memoria del jugador por sobre lo que trae arusa:
  // los ingresos de banca que no estaban registrados, más los partidos sin
  // nómina que solo existen porque alguien los confirmó.
  for (const j of jugaron) {
    const dicho = CORR[clave(j.n)]?.[fecha];
    if (dicho === true || dicho === "titular" || dicho === "banca") corregidos++;
  }
  for (const j of (partido.nomina || [])) {
    if (j.t === "banca" && j.jugo && CORR[clave(j.n)]?.[fecha] === false) corregidos++;
  }

  for (const j of jugaron) {
    const k = clave(j.n);
    if (!k) continue;
    const v = porJugador.get(k) || { n: limpiarNombre(j.n), id: null, a: {}, titular: 0, banca: 0 };
    v.a[a] = (v.a[a] || 0) + 1;
    if (j.t === "titular") v.titular++; else v.banca++;
    // El id de ARUSA cambia de temporada; vale el más reciente, que es el que
    // la app tiene guardado en players.arusa_player_id.
    if (Number(a) >= 2025 && j.id) v.id = String(j.id);
    const limpio = limpiarNombre(j.n);
    if (limpio.length > v.n.length) v.n = limpio;
    porJugador.set(k, v);
  }
}

// Va TODO, incluida la temporada en curso.
//
// La tentación era dejar el año corriente fuera y sumarlo en vivo desde la
// tabla de estadísticas de ARUSA, que se actualiza sola. No se puede: esa
// tabla cuenta solo titularidades, así que el jugador vería su historia con
// una regla y su año con otra, y un cap de banca de esta temporada no
// aparecería. Un número que se actualiza solo pero mide otra cosa es peor que
// uno que hay que refrescar a mano.
//
// Para actualizar después de cada fecha:
//   node scripts/caps-arusa.mjs        (baja solo lo que falta)
//   node scripts/caps-consolidar.mjs
const salida = {};
for (const [k, v] of porJugador) {
  if (!Object.keys(v.a).length) continue;
  salida[k] = { n: v.n, a: v.a, ...(v.id ? { id: v.id } : {}) };
}

writeFileSync(SALIDA, JSON.stringify(salida, null, 0));

console.log(`correcciones aplicadas: ${corregidos}`);
console.log("\ncobertura de nóminas en arusa:");
for (const [a, c] of Object.entries(cobertura).sort())
  console.log(`  ${a}: ${c.conNomina}/${c.partidos} partidos${c.conNomina < c.partidos ? `  ⚠️ faltan ${c.partidos - c.conNomina}` : ""}`);

const tot = [...porJugador.values()]
  .map(v => ({ n: v.n, total: Object.values(v.a).reduce((s, x) => s + x, 0), tit: v.titular, ban: v.banca }))
  .sort((a, b) => b.total - a.total);
console.log(`\njugadores: ${tot.length}  ·  guardados: ${Object.keys(salida).length}`);
console.log("\n" + "jugador".padEnd(34) + "caps".padStart(6) + "tit".padStart(6) + "banca".padStart(7));
for (const j of tot.slice(0, 20))
  console.log(j.n.slice(0, 33).padEnd(34) + String(j.total).padStart(6) + String(j.tit).padStart(6) + String(j.ban).padStart(7));
