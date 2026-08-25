/**
 * Ranking de caps en texto plano para mandar al grupo del club.
 *
 * Líneas cortas para que no se corten en el teléfono, nombres completos
 * (acortarlos obliga a adivinar cuál palabra es el apellido y le cambia el
 * nombre a la gente) y una nota final aclarando que son un mínimo.
 *
 * Uso: node scripts/caps-whatsapp.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { clave, limpiarNombre, leerCorrecciones, quienJugo, sinNomina } from "./caps-lib.mjs";
const CRUDO=JSON.parse(readFileSync("scripts/caps-arusa.json","utf8"));
const CORR = leerCorrecciones();
const A=[2021,2022,2023,2024,2025,2026];

const J=new Map();
for(const p of Object.values(CRUDO)){
  for(const x of quienJugo(p, CORR)){
    const k=clave(x.n); if(!k) continue;
    const v=J.get(k)||{n:limpiarNombre(x.n),y:{},t:0,b:0};
    v.y[p.anio]=v.y[p.anio]||{t:0,b:0};
    v.y[p.anio][x.t==="titular"?"t":"b"]++;
    if(x.t==="titular") v.t++; else v.b++;
    if(limpiarNombre(x.n).length>v.n.length) v.n=limpiarNombre(x.n);
    J.set(k,v);
  }
}
// Los nombres van completos. Acortarlos a "nombre + apellido" obliga a
// adivinar cuál palabra es el apellido: "Diego Arturo Espinoza Merino" son dos
// nombres y dos apellidos, "Jose Miguel Sánchez" son dos nombres y uno, y
// "Santiago Prat Papic" uno y dos. No hay regla que acierte las tres, y un
// ranking que le cambia el nombre a la gente no sirve para mandar al grupo.
const lista=[...J.values()].map(v=>({...v,total:v.t+v.b}))
  .sort((a,b)=>b.total-a.total||a.n.localeCompare(b.n));

let t="";
t+="🎖 CAPS DEL PRIMER EQUIPO\n";
t+="Old Reds · 2021 a 2026\n";
t+="────────────────────────\n";
t+="Un cap = jugó el partido de\nTitulares, de arranque o\nentrando desde la banca.\n";
t+="Intermedia y Pre no cuentan.\n\n";
t+="(T = titular · B = banca)\n\n";
for(const [i,v] of lista.entries()){
  t+=`${String(i+1).padStart(2)}. ${v.n}\n`;
  t+=`    ${v.total} caps · ${v.t}T · ${v.b}B\n`;
}
t+="\n────────────────────────\n";
t+="AÑO POR AÑO (top 15)\n\n";
for(const v of lista.slice(0,15)){
  t+=`${v.n} — ${v.total} caps\n`;
  const ls=A.filter(a=>v.y[a]).map(a=>{const y=v.y[a];return `  ${a}: ${y.t}T${y.b?` + ${y.b}B`:""}`;});
  t+=ls.join("\n")+"\n\n";
}
t+="────────────────────────\n";
t+="Salen de las nóminas y los\ncambios de arusa, partido a\npartido (104 partidos).\n\n";
t+="⚠️ Son un MÍNIMO. Arusa anota\nlos cambios a mano y se le\npasa un tercio, así que a\nvarios les faltan partidos de\nbanca. A los titulares fijos\ncasi no les afecta; a los que\nrotan, bastante.\n\n";
t+="Si sabés que entraste en algún\npartido que no te figura,\navisá y se suma.\n\n";
t+="También faltan 6 partidos que\narusa nunca cargó (4 de 2021,\n2 de 2024).\n";
writeFileSync("caps-old-reds-whatsapp.txt", t);
console.log(t.split("\n").slice(0,26).join("\n"));
console.log(`...\n\n[${lista.length} jugadores · ${t.length} caracteres · línea más larga: ${Math.max(...t.split("\n").map(l=>l.length))}]`);
