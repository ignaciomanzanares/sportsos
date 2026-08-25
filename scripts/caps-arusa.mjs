/**
 * Caps reales de Old Reds: titulares MÁS los que entraron desde la banca.
 *
 * La tabla de estadísticas de arusa cuenta solo al que arrancó — se comprobó
 * dividiendo las presencias de cada temporada por los partidos: daba el XV
 * exacto. Los que entran de cambio no figuran en ningún total.
 *
 * Pero sí están, partido por partido, en dos páginas:
 *   /match/<id>/stats         → la nómina: Regular 1-15 y Reserve 16-23
 *   /match/<id>/live-scoring  → cada Substitution, con quién sale ↓ y entra ↑
 *
 * Se navega con un navegador de verdad porque arusa pone un desafío de
 * JavaScript ("Checking your browser") que devuelve 429 a cualquier cliente
 * que no lo ejecute — ni curl ni el proxy de Cloudflare lo pasan.
 *
 * Uso:  node scripts/caps-arusa.mjs
 * Sale: scripts/caps-arusa.json  (se guarda a cada partido, así que se puede
 *       cortar y retomar sin perder lo bajado)
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "fs";

const PARTIDOS = JSON.parse(readFileSync(process.argv[2] || "/tmp/claude-1000/-home-ignaciomanzanares/145c833d-1c70-452b-961b-50643a430db8/scratchpad/partidos.json", "utf8"));
const SALIDA = "scripts/caps-arusa.json";
const CLUB = /old\s*reds/i;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const hecho = existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, "utf8")) : {};

// El navegador se abre acá y se puede volver a abrir: en una corrida larga la
// red se corta, Chromium muere y todo lo que viene después falla en cadena.
// Con esto se levanta solo y sigue donde iba.
let b, ctx, p;
async function abrirNavegador() {
  try { await b?.close(); } catch { /* ya estaba muerto */ }
  b = await chromium.launch();
  ctx = await b.newContext({ userAgent: UA });
  p = await ctx.newPage();
  // El desafío de JavaScript se resuelve una vez por sesión.
  await p.goto("https://arusa.cl/en/tournament/1328550/match/144047894/live-scoring",
    { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(7000);
}
await abrirNavegador();

let n = 0;
for (const m of PARTIDOS) {
  n++;
  if (hecho[m.match]) continue;
  const base = `https://arusa.cl/en/tournament/${m.torneo}/match/${m.match}`;
  let intento = 0;
  while (intento < 3 && !hecho[m.match]) {
  intento++;
  try {
    await p.goto(`${base}/stats`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(1200);
    const nomina = await p.evaluate((CLUBs) => {
      const re = new RegExp(CLUBs, "i");
      for (const tabla of document.querySelectorAll("table")) {
        const filas = [...tabla.querySelectorAll("tr")].filter(tr => /Regular|Reserve/.test(tr.textContent));
        if (!filas.length) continue;
        let nodo = tabla, equipo = null;
        while (nodo && !equipo) {
          nodo = nodo.previousElementSibling || nodo.parentElement;
          const t = nodo?.textContent?.trim().split("\n")[0].trim();
          if (t && t.length < 30 && /^[A-Za-zÁÉÍÓÚÑ][\w\s.'-]{2,28}$/.test(t)) equipo = t;
        }
        if (!re.test(equipo || "")) continue;
        return filas.map(tr => {
          const c = [...tr.querySelectorAll("td")].map(td => td.textContent.replace(/\s+/g, " ").trim());
          const a = tr.querySelector('a[href*="/players/"]');
          return { tipo: /Regular/.test(c[1]) ? "titular" : "banca", num: +c[2],
                   nombre: c[3], id: a?.href.match(/\/players\/(\d+)/)?.[1] || null };
        }).filter(x => x.id);
      }
      return [];
    }, CLUB.source);

    await p.goto(`${base}/live-scoring`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForTimeout(1000);
    // Números que ENTRARON (flecha arriba) en los bloques del club.
    const entraron = await p.evaluate((CLUBs) => {
      const re = new RegExp(CLUBs, "i");
      const nums = [];
      for (const div of document.querySelectorAll("div")) {
        if (div.textContent.trim() !== "Substitution") continue;
        const caja = div.parentElement;
        if (!re.test(caja?.textContent || "")) continue;
        for (const linea of caja.querySelectorAll(".strong")) {
          if (!linea.querySelector(".fa-long-arrow-up")) continue;
          const num = linea.querySelector("span")?.textContent.trim();
          if (num) nums.push(+num);
        }
      }
      return [...new Set(nums)];
    }, CLUB.source);

    // Algunos partidos viejos no tienen la nómina cargada en arusa: la página
    // trae el encabezado de la tabla y ninguna fila. Se anotan como sin datos
    // en vez de contarlos como "nadie jugó", que sería un cero falso.
    const jugaron = nomina.filter(j => j.tipo === "titular" || entraron.includes(j.num));
    // Se guarda la nómina ENTERA, no solo los que jugaron. arusa registra a
    // mano los cambios y se le pasan como un tercio, así que hace falta saber
    // quién quedó en la banca sin ingreso anotado: sin eso no se puede
    // distinguir "no entró" de "entró y nadie lo escribió".
    hecho[m.match] = { anio: m.anio, fecha: m.fecha,
                       titulares: nomina.filter(j => j.tipo === "titular").length,
                       entraron: entraron.length,
                       nomina: nomina.map(j => ({ id: j.id, n: j.nombre, num: j.num,
                                                  t: j.tipo,
                                                  jugo: j.tipo === "titular" || entraron.includes(j.num) })),
                       jugaron: jugaron.map(j => ({ id: j.id, n: j.nombre, t: j.tipo })) };
    writeFileSync(SALIDA, JSON.stringify(hecho, null, 1));
    const h = hecho[m.match];
    console.log(nomina.length === 0
      ? `[${n}/${PARTIDOS.length}] ${m.anio} ${m.match}: SIN NÓMINA en arusa`
      : `[${n}/${PARTIDOS.length}] ${m.anio} ${m.match}: ${h.titulares} tit + ${entraron.length} banca = ${jugaron.length}`);
  } catch (e) {
    const msg = String(e.message);
    const fatal = /browser has been closed|Target page/.test(msg);
    console.log(`[${n}/${PARTIDOS.length}] ${m.anio} ${m.match}: intento ${intento} — ${msg.slice(0, 60)}`);
    // Corte de red o Chromium caído: se espera, se reabre y se reintenta el
    // mismo partido en vez de arrastrar el fallo al resto de la lista.
    await new Promise(r => setTimeout(r, 4000 * intento));
    if (fatal || intento === 2) { try { await abrirNavegador(); } catch { /* reintenta al toque */ } }
  }
  }
  await new Promise(r => setTimeout(r, 500));
}
await b.close();
console.log(`\npartidos bajados: ${Object.keys(hecho).length}/${PARTIDOS.length}`);
