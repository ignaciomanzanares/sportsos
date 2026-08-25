const H={Accept:"application/vnd.api+json","User-Agent":"Mozilla/5.0"};
const g=async p=>(await fetch(`https://api.leverade.com${p}`,{headers:H})).json();
// torneo → grupos de TITULARES que jugó Old Reds (del mapeo ya verificado)
const PLAN=[
 {anio:2021,torneo:"1103237",grupos:["2984417","3074606","3074952"]},
 {anio:2022,torneo:"1152634",grupos:["3130444","3233638"]},
 {anio:2023,torneo:"1203958",grupos:["3287131","3362741"]},
 {anio:2024,torneo:"1237419",grupos:["3403792","3403793"]},
 {anio:2025,torneo:"1284807",grupos:["3541281","3651526"]},
 {anio:2026,torneo:"1328550",grupos:["3667033"]},
];
const salida=[];
for(const t of PLAN){
  const d=await g(`/tournaments/${t.torneo}?include=groups.rounds.matches.results,teams`);
  const inc=d.included||[];
  const equipos=new Map(inc.filter(x=>x.type==="team").map(x=>[x.id,x.attributes.name]));
  const orId=[...equipos].find(([,n])=>/old\s*reds/i.test(n))?.[0];
  const rondaDeGrupo=new Map();
  for(const r of inc.filter(x=>x.type==="round")) rondaDeGrupo.set(r.id, r.relationships?.group?.data?.id);
  // El partido no trae equipos directo: vienen por sus filas de result.
  const equiposDeMatch=new Map();
  for(const r of inc.filter(x=>x.type==="result")){
    const mid=r.relationships?.match?.data?.id, tid=r.relationships?.team?.data?.id;
    if(!mid||!tid) continue;
    if(!equiposDeMatch.has(mid)) equiposDeMatch.set(mid,new Set());
    equiposDeMatch.get(mid).add(tid);
  }
  let n=0;
  for(const m of inc.filter(x=>x.type==="match")){
    const rid=m.relationships?.round?.data?.id;
    const gid=rondaDeGrupo.get(rid);
    if(!t.grupos.includes(gid)) continue;
    if(!equiposDeMatch.get(m.id)?.has(orId)) continue;
    if(!m.attributes?.finished) continue;
    salida.push({anio:t.anio,torneo:t.torneo,match:m.id,fecha:m.attributes.datetime});
    n++;
  }
  console.log(`${t.anio}: ${n} partidos de Old Reds en Titulares`);
}
console.log("TOTAL:", salida.length);
(await import("node:fs")).default.writeFileSync("/tmp/claude-1000/-home-ignaciomanzanares/145c833d-1c70-452b-961b-50643a430db8/scratchpad/partidos.json", JSON.stringify(salida,null,1));
