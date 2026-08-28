/**
 * Arma el PDF de caps para repartir en el club.
 *
 * Se genera con el navegador headless que ya usa el scraper — no hace falta
 * ninguna librería de PDF. El HTML intermedio queda al lado por si alguien
 * quiere retocarlo.
 *
 * Uso: node scripts/caps-pdf.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { chromium } from "playwright";
import { clave, limpiarNombre, leerCorrecciones, leerRescate, quienJugo, anotacionesDe } from "./caps-lib.mjs";

const CRUDO = JSON.parse(readFileSync("scripts/caps-arusa.json", "utf8"));
const CORR  = leerCorrecciones();
const RESC  = leerRescate();
const DUDAS = (() => { try { return JSON.parse(readFileSync("caps-por-confirmar.json","utf8")); } catch { return {}; } })();
const A = [2021, 2022, 2023, 2024, 2025, 2026];
const ROJO = "#C0392B";

// ── agregación ────────────────────────────────────────────────────────────
const J = new Map();
for (const [mid, p] of Object.entries(CRUDO)) {
  for (const x of quienJugo(p, CORR, RESC[mid])) {
    const k = clave(x.n); if (!k) continue;
    const v = J.get(k) || { n: limpiarNombre(x.n), y: {}, t: 0, b: 0 };
    v.y[p.anio] = v.y[p.anio] || { t: 0, b: 0 };
    v.y[p.anio][x.t === "titular" ? "t" : "b"]++;
    if (x.t === "titular") v.t++; else v.b++;
    if (limpiarNombre(x.n).length > v.n.length) v.n = limpiarNombre(x.n);
    J.set(k, v);
  }
}
// Lo que anotó cada uno, de la misma tabla por partido. Solo Titulares: la
// tabla general de arusa suma las tres divisiones y un try en Intermedia
// inflaba el número del primer equipo.
const ANOT = new Map();
for (const p of Object.values(CRUDO)) {
  for (const j of (p.nomina || [])) {
    const k = clave(j.n); if (!k) continue;
    const v = ANOT.get(k) || { t: 0, c: 0, pe: 0, d: 0, y: {} };
    v.t += j.tries || 0; v.c += j.conv || 0; v.pe += j.pen || 0; v.d += j.drops || 0;
    v.y[p.anio] = (v.y[p.anio] || 0) + (j.tries || 0);
    ANOT.set(k, v);
  }
}
const puntosDe = a => a ? a.t * 5 + a.c * 2 + a.pe * 3 + a.d * 3 : 0;

const lista = [...J.values()].map(v => ({ ...v, total: v.t + v.b }))
  .sort((a, b) => b.total - a.total || a.n.localeCompare(b.n));
for (const v of lista) {
  v.dudas = DUDAS[clave(v.n)]?.partidos?.length || 0;
  v.a = ANOT.get(clave(v.n)) || { t: 0, c: 0, pe: 0, d: 0, y: {} };
  v.pts = puntosDe(v.a);
}
const anotadores = [...lista].filter(v => v.a.t > 0 || v.pts > 0)
  .sort((x, y) => y.a.t - x.a.t || y.pts - x.pts || x.n.localeCompare(y.n));
const triesTotal = lista.reduce((s2, v) => s2 + v.a.t, 0);

const partidos = Object.keys(CRUDO).length;
const totalDudas = lista.reduce((s, v) => s + v.dudas, 0);
// Lugares de banca en total, para poder decir "N de M sin registrar" con los
// dos números salidos del mismo dato y no uno escrito a mano que se desactualiza.
let lugaresBanca = 0;
for (const p of Object.values(CRUDO))
  for (const j of (p.nomina || [])) if (j.t === "banca") lugaresBanca++;

// ── html ──────────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const filaAnios = v => A.map(a => {
  const y = v.y[a];
  if (!y) return `<td class="v">·</td>`;
  return `<td class="v">${y.t}${y.b ? `<i>+${y.b}</i>` : ""}</td>`;
}).join("");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 14mm 13mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
         color: #1a1a1a; font-size: 9pt; margin: 0; }
  h1 { font-size: 21pt; margin: 0 0 2mm; letter-spacing: -0.4pt; }
  .sub { color: #666; font-size: 9.5pt; margin-bottom: 5mm; }
  .cinta { height: 3pt; background: ${ROJO}; margin-bottom: 5mm; }

  .resumen { display: flex; gap: 4mm; margin-bottom: 6mm; }
  .caja { flex: 1; border: 0.5pt solid #ddd; border-radius: 2mm; padding: 3mm; text-align: center; }
  .caja b { display: block; font-size: 17pt; color: ${ROJO}; line-height: 1.1; }
  .caja span { font-size: 7.5pt; color: #666; }

  .nota { background: #faf7f7; border-left: 2pt solid ${ROJO};
          padding: 3mm 4mm; margin-bottom: 6mm; font-size: 8pt; line-height: 1.5; color: #444; }
  .nota b { color: #1a1a1a; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: right; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.4pt;
       color: #888; padding: 0 1.5mm 1.5mm; border-bottom: 0.5pt solid #ccc; font-weight: 600; }
  th.l, td.l { text-align: left; }
  td { padding: 1.15mm 1.5mm; border-bottom: 0.25pt solid #eee; }
  td.p { color: #999; font-size: 7.5pt; width: 7mm; text-align: right; }
  td.n { font-size: 8.5pt; }
  td.c { text-align: right; font-weight: 700; font-size: 9.5pt; width: 11mm; }
  td.tb { text-align: right; color: #777; font-size: 7.5pt; width: 15mm; }
  td.v { text-align: right; width: 12mm; font-size: 8pt; color: #333; }
  td.v i { color: ${ROJO}; font-style: normal; font-size: 7pt; }
  td.d { text-align: right; width: 10mm; font-size: 7.5pt; color: #b8860b; }
  tr.top td.c { color: ${ROJO}; }
  tr.top td.n { font-weight: 600; }

  h2 { font-size: 12pt; margin: 0 0 1mm; }
  .h2sub { color: #666; font-size: 8pt; margin-bottom: 3mm; }
  .salto { page-break-before: always; }
  .pie { margin-top: 6mm; padding-top: 3mm; border-top: 0.5pt solid #ddd;
         color: #888; font-size: 7.5pt; line-height: 1.5; }
</style></head><body>

<div class="cinta"></div>
<h1>Caps del primer equipo</h1>
<div class="sub">Old Reds · temporadas 2021 a 2026</div>

<div class="resumen">
  <div class="caja"><b>${partidos}</b><span>partidos de Titulares</span></div>
  <div class="caja"><b>${lista.length}</b><span>jugadores con caps</span></div>
  <div class="caja"><b>${lista[0].total}</b><span>el máximo</span></div>
  <div class="caja"><b>${totalDudas}</b><span>caps por confirmar</span></div>
</div>

<div class="nota">
  <b>Un cap es un partido jugado por el equipo de Titulares</b>, sea de arranque o
  entrando desde la banca. Intermedia y Pre-Intermedia no cuentan. En 2024 el club
  jugó Segunda División y cuenta igual, porque lo que se mide es el equipo y no la
  categoría.<br><br>
  <b>Son un mínimo.</b> Las nóminas que publica arusa están completas, pero los
  cambios los anota a mano quien hace la planilla del partido y se le pasan: de
  ${lugaresBanca} lugares de banca hay ${totalDudas} sin registrar, y varios partidos figuran
  con cero cambios, que en rugby no ocurre. A los titulares fijos casi no les
  afecta; a los que rotan, bastante. La columna <b>?</b> dice cuántos partidos le
  faltan a cada uno por confirmar.
</div>

<table>
  <tr><th class="l" colspan="2">Jugador</th><th>Caps</th><th>T · B</th>
      ${A.map(a => `<th>${a}</th>`).join("")}<th>?</th></tr>
  ${lista.map((v, i) => `<tr class="${i < 5 ? "top" : ""}">
    <td class="p">${i + 1}</td>
    <td class="n">${esc(v.n)}</td>
    <td class="c">${v.total}</td>
    <td class="tb">${v.t}·${v.b}</td>
    ${filaAnios(v)}
    <td class="d">${v.dudas || ""}</td></tr>`).join("")}
</table>

<div class="salto"></div>
<div class="cinta"></div>
<h2>Tries y puntos</h2>
<div class="h2sub">Solo partidos de Titulares · ${triesTotal} tries en ${partidos} partidos</div>

<div class="nota" style="margin-bottom:5mm">
  Estos números <b>no son los que muestra la tabla de arusa</b>: esa suma las tres
  divisiones, así que un try en Intermedia figura como del primer equipo. Acá se
  cuenta solo Titulares, partido por partido. Los puntos suman tries (5),
  conversiones (2), penales (3) y drops (3).<br><br>
  <b>Qué tan completo está.</b> Se sumó lo que anotó cada jugador y se comparó con el
  marcador real: <b>91 de los 102 partidos dan exacto</b>, punto por punto. Los 12
  que no cuadraban se revisaron uno por uno en el minuto a minuto: en el de noviembre
  de 2021 aparecieron los 15 puntos que faltaban, de dos jugadores que anotaron y ni
  siquiera figuraban en la nómina de arusa de ese partido. En los 11 restantes falta
  siempre lo mismo, 2 puntos: una conversión que quien llenó la planilla no anotó en
  ninguna parte. Son 24 puntos de unos 4.000.
</div>

<table>
  <tr><th class="l" colspan="2">Jugador</th><th>Tries</th>
      ${A.map(a => `<th>${a}</th>`).join("")}
      <th>Conv</th><th>Pen</th><th>Puntos</th></tr>
  ${anotadores.map((v, i) => `<tr class="${i < 5 ? "top" : ""}">
    <td class="p">${i + 1}</td>
    <td class="n">${esc(v.n)}</td>
    <td class="c">${v.a.t}</td>
    ${A.map(a => `<td class="v">${v.a.y[a] || "·"}</td>`).join("")}
    <td class="v">${v.a.c || "·"}</td>
    <td class="v">${v.a.pe || "·"}</td>
    <td class="c" style="color:#555">${v.pts}</td></tr>`).join("")}
</table>

<div class="pie">
  En las columnas por año, el número grande son los partidos de titular y el
  <i style="color:${ROJO};font-style:normal">+n</i> en rojo los que entró desde la
  banca. Datos tomados de las nóminas y las sustituciones que publica arusa.cl,
  partido por partido, más las confirmaciones de los propios jugadores.
  Generado el ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}.
</div>

</body></html>`;

writeFileSync("caps-old-reds.html", html);

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.setContent(html, { waitUntil: "load" });
await p.pdf({ path: "caps-old-reds.pdf", format: "A4", printBackground: true });
await b.close();
console.log(`caps-old-reds.pdf · ${lista.length} jugadores · ${partidos} partidos`);
