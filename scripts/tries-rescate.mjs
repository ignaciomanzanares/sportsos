/**
 * Recupera las anotaciones que la tabla del partido no registró.
 *
 * En 12 de los 102 partidos, la suma de lo que anotó cada jugador no da el
 * marcador: faltan 39 puntos. El minuto a minuto sí los tiene, pero algunos
 * eventos vienen SIN número de camiseta —solo el nombre— y un parseo que
 * exigía el número los descartaba en silencio. Ahí estaban los 15 puntos del
 * partido contra COBS de noviembre de 2021.
 *
 * Se cruza por número cuando está y por nombre cuando no. Y si el que anotó no
 * figura en la nómina del partido —pasa: arusa se contradice a sí misma—, se
 * agrega igual: no se puede anotar un try sin haber jugado.
 *
 * Uso: node scripts/tries-rescate.mjs
 * Sale: scripts/tries-rescate.json — lo que el consolidador suma después.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { clave, limpiarNombre } from "./caps-lib.mjs";

const D = JSON.parse(readFileSync("scripts/caps-arusa.json", "utf8"));
const P = JSON.parse(readFileSync("scripts/partidos.json", "utf8"));
const H = { Accept: "application/vnd.api+json", "User-Agent": "Mozilla/5.0" };
const g = async p => (await fetch(`https://api.leverade.com${p}`, { headers: H })).json();

// marcador real, para saber qué partidos no cuadran y cuánto falta
const marcador = new Map();
for (const tid of [...new Set(P.map(x => x.torneo))]) {
  const d = await g(`/tournaments/${tid}?include=groups.rounds.matches.results,teams`);
  const inc = d.included || [];
  const eq = new Map(inc.filter(x => x.type === "team").map(x => [x.id, x.attributes.name]));
  const or = [...eq].find(([, n]) => /old\s*reds/i.test(n))?.[0];
  for (const r of inc.filter(x => x.type === "result")) {
    const m = r.relationships?.match?.data?.id, t = r.relationships?.team?.data?.id;
    if (t === or && m && r.attributes?.value != null) marcador.set(m, r.attributes.value);
  }
}
const pts = j => (j.tries||0)*5 + (j.triesPenal||0)*5 + (j.conv||0)*2 + (j.pen||0)*3 + (j.drops||0)*3;
const descuadres = Object.entries(D)
  .map(([mid, p]) => ({ mid, p, real: marcador.get(mid),
                        calc: (p.nomina||[]).reduce((s,j)=>s+pts(j),0) }))
  .filter(x => x.real != null && x.calc !== x.real);
console.log(`${descuadres.length} partidos sin cuadrar · faltan ${descuadres.reduce((s,x)=>s+(x.real-x.calc),0)} puntos\n`);

const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" });
const p = await ctx.newPage();
await p.goto("https://arusa.cl/en/tournament/1328550/match/144047894/live-scoring",
  { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(7000);

const rescate = {};
for (const c of descuadres) {
  const tor = P.find(x => x.match === c.mid)?.torneo;
  let ev = null;
  for (let i = 0; i < 3 && !ev; i++) {
    try {
      await p.goto(`https://arusa.cl/en/tournament/${tor}/match/${c.mid}/live-scoring`,
        { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(2200);
      ev = await p.evaluate(() => {
        const out = [];
        for (const inc of document.querySelectorAll(".incidence")) {
          if (!/old\s*reds/i.test(inc.textContent)) continue;
          const tipo = [...inc.querySelectorAll("div")].map(d => d.textContent.trim())
            .find(t => /^(Try|Conversion|Penalty|Drop)$/i.test(t));
          if (!tipo) continue;
          const txt = (inc.querySelector(".strong")?.textContent || "").replace(/\s+/g, " ").trim();
          const m = /^(\d{1,2})\s+(.+)$/.exec(txt);
          // Sin número también vale: el nombre alcanza para cruzar con la nómina.
          out.push({ tipo, num: m ? +m[1] : null, nombre: (m ? m[2] : txt).trim() });
        }
        return out;
      });
    } catch { await new Promise(r => setTimeout(r, 3000)); }
  }
  if (!ev) { console.log(`  ${String(c.p.fecha).slice(0,10)}  no se pudo leer`); continue; }

  const porNum  = new Map((c.p.nomina||[]).map(j => [j.num, j]));
  const porNom  = new Map((c.p.nomina||[]).map(j => [clave(j.n), j]));
  const vivo = new Map();
  for (const e of ev) {
    const j = (e.num != null && porNum.get(e.num)) || porNom.get(clave(e.nombre));
    // La clave es el nombre y no el número: el que no está en la nómina no
    // tiene número, y es justo al que hay que rescatar.
    const k = j ? clave(j.n) : clave(e.nombre);
    if (!k) continue;
    const v = vivo.get(k) ?? { T:0, C:0, P:0, D:0, ficha: j, nombre: e.nombre };
    if (/try/i.test(e.tipo)) v.T++; else if (/conv/i.test(e.tipo)) v.C++;
    else if (/penal/i.test(e.tipo)) v.P++; else if (/drop/i.test(e.tipo)) v.D++;
    vivo.set(k, v);
  }
  const extras = [];
  for (const [k, v] of vivo) {
    const j = v.ficha;
    const base = j || { tries:0, conv:0, pen:0, drops:0 };
    const d = { tries: v.T-(base.tries||0), conv: v.C-(base.conv||0),
                pen: v.P-(base.pen||0), drops: v.D-(base.drops||0) };
    for (const kk of Object.keys(d)) if (d[kk] < 0) d[kk] = 0;
    if (d.tries||d.conv||d.pen||d.drops)
      extras.push({ num: j?.num ?? null, n: limpiarNombre(j?.n || v.nombre),
                    enNomina: !!j, ...d });
  }
  const gana = extras.reduce((s,x) => s + x.tries*5 + x.conv*2 + x.pen*3 + x.drops*3, 0);
  if (extras.length) rescate[c.mid] = { fecha: String(c.p.fecha).slice(0,10), anio: c.p.anio, extras };
  console.log(`  ${String(c.p.fecha).slice(0,10)}  faltaban ${c.real-c.calc} · recuperados ${gana}` +
              (gana === c.real-c.calc ? "  ✓ cuadra" : ""));
  for (const e of extras)
    console.log(`      ${e.n} → ${[e.tries&&e.tries+"T",e.conv&&e.conv+"C",e.pen&&e.pen+"P",e.drops&&e.drops+"D"].filter(Boolean).join(" ")}` +
                (e.enNomina ? "" : "   ← NO figuraba en la nómina"));
  await new Promise(r => setTimeout(r, 800));
}
writeFileSync("scripts/tries-rescate.json", JSON.stringify(rescate, null, 1));
await b.close();
console.log(`\nguardado en scripts/tries-rescate.json (${Object.keys(rescate).length} partidos)`);
