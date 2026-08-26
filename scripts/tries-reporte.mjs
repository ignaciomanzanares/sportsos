/**
 * Tries del primer equipo, temporada por temporada.
 *
 * Salen de la tabla de estadísticas de cada partido, la misma de la que salen
 * los caps, leyendo la columna por su clase (colstyle-tries) y no por su
 * posición: el orden de las columnas cambió entre temporadas.
 *
 * Solo cuenta Titulares. La tabla general de arusa suma las tres divisiones,
 * así que un try en Intermedia inflaba el número del primer equipo.
 *
 * Uso: node scripts/tries-reporte.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { clave, limpiarNombre } from "./caps-lib.mjs";

const CRUDO = JSON.parse(readFileSync("scripts/caps-arusa.json", "utf8"));
const A = [2021, 2022, 2023, 2024, 2025, 2026];

const J = new Map();
let sinDato = 0;
for (const p of Object.values(CRUDO)) {
  for (const j of (p.nomina || [])) {
    if (j.tries === undefined) { sinDato++; continue; }
    const k = clave(j.n); if (!k) continue;
    const v = J.get(k) || { n: limpiarNombre(j.n), y: {}, t: 0, c: 0, pe: 0, d: 0, ta: 0, tr: 0 };
    v.y[p.anio] = (v.y[p.anio] || 0) + j.tries;
    v.t  += j.tries;
    v.c  += j.conv || 0;
    v.pe += j.pen  || 0;
    v.d  += j.drops || 0;
    v.ta += j.ta || 0;
    v.tr += j.tr || 0;
    if (limpiarNombre(j.n).length > v.n.length) v.n = limpiarNombre(j.n);
    J.set(k, v);
  }
}
if (sinDato) console.log(`⚠️ ${sinDato} filas sin la columna de tries — hay que rebajar con el scraper nuevo\n`);

// Puntos por lo que anotó cada uno, con el valor del rugby a 15.
const puntos = v => v.t * 5 + v.c * 2 + v.pe * 3 + v.d * 3;
const lista = [...J.values()].map(v => ({ ...v, pts: puntos(v) }))
  .filter(v => v.t > 0 || v.pts > 0)
  .sort((a, b) => b.t - a.t || b.pts - a.pts || a.n.localeCompare(b.n));

console.log("═══ TRIES DEL PRIMER EQUIPO ═══\n");
console.log("jugador".padEnd(34) + A.map(a => String(a).padStart(6)).join("") + "   TOT   pts");
for (const v of lista.slice(0, 25))
  console.log(v.n.slice(0, 33).padEnd(34)
    + A.map(a => String(v.y[a] || "·").padStart(6)).join("")
    + String(v.t).padStart(6) + String(v.pts).padStart(6));

const totT = lista.reduce((s, v) => s + v.t, 0);
console.log(`\njugadores que anotaron: ${lista.length} · tries en total: ${totT}`);

let md = `# Tries del primer equipo — Old Reds\n\n`;
md += `Solo partidos de Titulares, 2021 a 2026. Intermedia y Pre-Intermedia no cuentan.\n\n`;
md += `Los puntos suman tries (5), conversiones (2), penales (3) y drops (3).\n\n`;
md += `| # | Jugador | ${A.join(" | ")} | Tries | Conv | Pen | Drop | Puntos |\n`;
md += `|---:|---|${A.map(() => "---:").join("|")}|---:|---:|---:|---:|---:|\n`;
lista.forEach((v, i) => {
  md += `| ${i + 1} | ${v.n} | ${A.map(a => v.y[a] || "·").join(" | ")} | **${v.t}** | ${v.c} | ${v.pe} | ${v.d} | ${v.pts} |\n`;
});
writeFileSync("tries-old-reds.md", md);
console.log("\n→ tries-old-reds.md");
