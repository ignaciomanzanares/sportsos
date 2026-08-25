// Nombre del rival de cada partido, para que la lista a confirmar diga
// "vs Lagartos" y no un id que no le dice nada a nadie.
import { readFileSync, writeFileSync } from "fs";
const H={Accept:"application/vnd.api+json","User-Agent":"Mozilla/5.0"};
const g=async p=>(await fetch(`https://api.leverade.com${p}`,{headers:H})).json();
const P=JSON.parse(readFileSync("scripts/partidos.json","utf8"));
const torneos=[...new Set(P.map(p=>p.torneo))];
const out={};
for(const tid of torneos){
  const t=await g(`/tournaments/${tid}?include=groups.rounds.matches.results,teams`);
  const inc=t.included||[];
  const eq=new Map(inc.filter(x=>x.type==="team").map(x=>[x.id,x.attributes.name]));
  const or=[...eq].find(([,n])=>/old\s*reds/i.test(n))?.[0];
  const pm=new Map();
  for(const r of inc.filter(x=>x.type==="result")){
    const m=r.relationships?.match?.data?.id, tt=r.relationships?.team?.data?.id;
    if(!m||!tt) continue; if(!pm.has(m)) pm.set(m,[]); pm.get(m).push(tt);
  }
  for(const p of P.filter(x=>x.torneo===tid)){
    const riv=(pm.get(p.match)||[]).filter(x=>x!==or).map(x=>eq.get(x)).filter(Boolean);
    if(riv.length) out[p.match]=riv[0];
  }
}
writeFileSync("scripts/rivales.json", JSON.stringify(out,null,1));
console.log(`rivales resueltos: ${Object.keys(out).length}/${P.length}`);
