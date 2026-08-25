/**
 * Informe completo de caps: caps-old-reds.md y caps-old-reds.csv.
 *
 * Tabla por jugador, desglose año por año con titular/banca, cobertura de
 * nóminas por temporada y la lista de partidos que arusa nunca cargó.
 *
 * No toca la red: lee el scrape ya bajado.
 * Uso: node scripts/caps-reporte.mjs
 */
import { readFileSync, writeFileSync } from "fs";
const CRUDO = JSON.parse(readFileSync("scripts/caps-arusa.json","utf8"));
const PART  = JSON.parse(readFileSync("scripts/partidos.json","utf8"));
const A=[2021,2022,2023,2024,2025,2026];
const limpio = n => String(n||"").replace(/\s*\((c|cc)\)\s*$/i,"").trim();
const clave = n => limpio(n).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()
  .split(/[^a-z]+/).filter(x=>x.length>1&&!["de","del","la","los"].includes(x)).sort().join(" ");

const J=new Map();
const faltan=[];
for (const [mid,p] of Object.entries(CRUDO)) {
  if (!p.jugaron?.length) { faltan.push({...p, match:mid}); continue; }
  for (const x of p.jugaron) {
    const k=clave(x.n); if(!k) continue;
    const v=J.get(k)||{n:limpio(x.n),y:{}};
    v.y[p.anio]=v.y[p.anio]||{t:0,b:0};
    v.y[p.anio][x.t==="titular"?"t":"b"]++;
    if(limpio(x.n).length>v.n.length) v.n=limpio(x.n);
    J.set(k,v);
  }
}
// partidos que ni siquiera se bajaron
const bajados=new Set(Object.keys(CRUDO));
const nuncaBajados=PART.filter(p=>!bajados.has(p.match));

const lista=[...J.values()].map(v=>({
  ...v, total:A.reduce((s,a)=>s+((v.y[a]?.t||0)+(v.y[a]?.b||0)),0),
  tit:A.reduce((s,a)=>s+(v.y[a]?.t||0),0), ban:A.reduce((s,a)=>s+(v.y[a]?.b||0),0),
})).sort((a,b)=>b.total-a.total||a.n.localeCompare(b.n));

// ── Markdown ──
let md=`# Caps del primer equipo — Old Reds\n\n`;
md+=`Un cap es un partido jugado por el equipo de Titulares: arrancó de titular (T) o entró desde la banca (B).\n`;
md+=`Intermedia y Pre-Intermedia no cuentan. 2024 el club jugó Segunda División, y cuenta igual porque el criterio es el equipo.\n\n`;
md+=`Fuente: nóminas y sustituciones de arusa.cl, partido por partido.\n\n`;
md+=`## Totales\n\n| # | Jugador | Caps | Titular | Banca |\n|---:|---|---:|---:|---:|\n`;
lista.forEach((v,i)=>{ md+=`| ${i+1} | ${v.n} | **${v.total}** | ${v.tit} | ${v.ban} |\n`; });

md+=`\n## Por año (T = titular · B = banca)\n\n| Jugador | ${A.map(a=>`${a}`).join(" | ")} | Caps |\n|---|${A.map(()=>"---:").join("|")}|---:|\n`;
for(const v of lista){
  const cs=A.map(a=>{const y=v.y[a]; return y?`${y.t}T${y.b?`+${y.b}B`:""}`:"—";});
  md+=`| ${v.n} | ${cs.join(" | ")} | **${v.total}** |\n`;
}

md+=`\n## Cobertura\n\n| Año | Partidos | Con nómina | Faltan |\n|---|---:|---:|---:|\n`;
const cob={};
for(const p of Object.values(CRUDO)){ cob[p.anio]=cob[p.anio]||{t:0,c:0}; cob[p.anio].t++; if(p.jugaron?.length) cob[p.anio].c++; }
for(const p of nuncaBajados){ cob[p.anio]=cob[p.anio]||{t:0,c:0}; cob[p.anio].t++; }
for(const a of A){ const c=cob[a]; if(!c) continue; md+=`| ${a} | ${c.t} | ${c.c} | ${c.t-c.c} |\n`; }

md+=`\n## Partidos sin nómina en arusa\n\nLa página del partido existe pero no tiene cargados los jugadores. Son caps que ocurrieron y no hay forma de recuperar.\n\n`;
md+=`| Año | Fecha | Partido |\n|---|---|---|\n`;
for(const f of [...faltan,...nuncaBajados.map(p=>({anio:p.anio,fecha:p.fecha,match:p.match}))].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))))
  md+=`| ${f.anio} | ${String(f.fecha||"").slice(0,10)} | [${f.match}](https://arusa.cl/es/tournament/${PART.find(p=>p.match===f.match)?.torneo}/match/${f.match}/stats) |\n`;

writeFileSync("caps-old-reds.md", md);

// ── CSV ──
let csv="jugador,"+A.flatMap(a=>[`${a}_titular`,`${a}_banca`]).join(",")+",caps_total,titular_total,banca_total\n";
for(const v of lista)
  csv+=`"${v.n}",`+A.flatMap(a=>[v.y[a]?.t||0, v.y[a]?.b||0]).join(",")+`,${v.total},${v.tit},${v.ban}\n`;
writeFileSync("caps-old-reds.csv", csv);

console.log(`jugadores: ${lista.length}`);
console.log(`partidos sin nómina: ${faltan.length} bajados vacíos + ${nuncaBajados.length} no bajados`);
for(const f of faltan) console.log(`  ${f.anio} ${String(f.fecha).slice(0,10)} ${f.match}`);
for(const f of nuncaBajados) console.log(`  ${f.anio} ${String(f.fecha).slice(0,10)} ${f.match} (no se bajó)`);
