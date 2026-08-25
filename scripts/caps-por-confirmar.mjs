/**
 * Arma, jugador por jugador, la lista de partidos donde estuvo en la banca y
 * arusa NO registró su ingreso.
 *
 * Existe porque los cambios los anota a mano quien hace la planilla y se le
 * pasan cerca de un tercio: hay partidos con cero cambios registrados, que en
 * rugby no ocurre. Así que "no entró" y "entró y nadie lo escribió" se ven
 * igual en los datos.
 *
 * Esto convierte el problema en una pregunta que cada jugador puede contestar
 * de memoria: "en estos partidos estuviste en la banca, ¿en cuáles entraste?".
 *
 * Uso:  node scripts/caps-por-confirmar.mjs "Ignacio Manzanares"
 *       node scripts/caps-por-confirmar.mjs            (todos, resumido)
 */
import { readFileSync, writeFileSync } from "fs";
import { clave, limpiarNombre, leerCorrecciones, quienJugo, sinNomina } from "./caps-lib.mjs";

const CRUDO = JSON.parse(readFileSync("scripts/caps-arusa.json", "utf8"));
const RIVALES = (() => {
  try { return JSON.parse(readFileSync("scripts/rivales.json", "utf8")); }
  catch { return {}; }
})();
const quien = process.argv[2];


const dudosos = new Map();
for (const [mid, p] of Object.entries(CRUDO)) {
  if (!p.nomina?.length) continue;
  for (const j of p.nomina) {
    if (j.t !== "banca" || j.jugo) continue;
    const k = clave(j.n);
    const v = dudosos.get(k) || { n: limpiarNombre(j.n), partidos: [] };
    v.partidos.push({ anio: p.anio, fecha: String(p.fecha).slice(0, 10), num: j.num,
                      rival: RIVALES[mid] || "", match: mid,
                      cambiosRegistrados: p.entraron });
    dudosos.set(k, v);
  }
}

if (quien) {
  const v = dudosos.get(clave(quien));
  if (!v) { console.log(`Sin partidos de banca sin registrar para "${quien}".`); process.exit(0); }
  console.log(`${v.n} — ${v.partidos.length} partidos en la banca sin ingreso registrado\n`);
  for (const x of v.partidos.sort((a, b) => a.fecha.localeCompare(b.fecha)))
    console.log(`  ${x.fecha}  #${String(x.num).padStart(2)}  vs ${(x.rival || "?").padEnd(20)} (arusa anotó ${x.cambiosRegistrados} cambios)`);
} else {
  const lista = [...dudosos.values()].sort((a, b) => b.partidos.length - a.partidos.length);
  console.log("Partidos en la banca SIN ingreso registrado — son los que hay que confirmar\n");
  for (const v of lista.slice(0, 30))
    console.log(`  ${String(v.partidos.length).padStart(3)}  ${v.n}`);
  console.log(`\ntotal de jugadores afectados: ${lista.length}`);
  console.log(`total de dudas: ${lista.reduce((s, v) => s + v.partidos.length, 0)}`);
  writeFileSync("caps-por-confirmar.json",
    JSON.stringify(Object.fromEntries([...dudosos].map(([k, v]) => [k, v])), null, 1));
  console.log("\ndetalle completo en caps-por-confirmar.json");
}
