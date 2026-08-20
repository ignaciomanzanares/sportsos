import { useState, useEffect } from "react";
import { m as motion } from "framer-motion";
import { ss } from "../styles/tokens";
import ProgressBar from "./ProgressBar";
import MedalBadge from "./MedalBadge";
import EmptyState from "./EmptyState";
import { supabase } from "../lib/supabase";

// Antes esto ordenaba por players[].gym, un campo que nunca existió en
// ningún jugador real (ni siquiera en los datos demo) — el ranking salía
// vacío siempre. Ahora agrega datos reales de gym_logs (volume_kg y
// one_rm_kg ya vienen calculados por la base). "Cumplimiento" y
// "Progreso" se sacaron: no hay un plan/objetivo real contra qué
// compararlos todavía.
export default function RankingView({tab, setTab, sportColor, players, compact, clubId}) {
  const tabs = [{id:"volumen",label:"Volumen total"},{id:"1rm",label:"Fuerza 1RM"}];
  const activeTab = tabs.some(t=>t.id===tab) ? tab : "volumen";

  const [gymData, setGymData] = useState({});
  const [loading, setLoading] = useState(!!clubId);
  const playerIds = players.map(p=>p.id).join(",");

  useEffect(() => {
    if (!clubId || players.length === 0) { setLoading(false); return; }
    setLoading(true);
    supabase.from("gym_logs").select("player_id, volume_kg, one_rm_kg").in("player_id", players.map(p=>p.id))
      .then(({ data }) => {
        const agg = {};
        (data || []).forEach(row => {
          const cur = agg[row.player_id] || { vol: 0, oneRM: 0 };
          cur.vol += Number(row.volume_kg) || 0;
          cur.oneRM = Math.max(cur.oneRM, Number(row.one_rm_kg) || 0);
          agg[row.player_id] = cur;
        });
        setGymData(agg);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, playerIds]);

  const getVal = (p) => {
    const g = gymData[p.id];
    if (!g) return null;
    const v = activeTab === "volumen" ? g.vol : g.oneRM;
    return v > 0 ? v : null;
  };

  const sorted = players
    .map(p => ({ p, val: getVal(p) }))
    .filter(x => x.val != null)
    .sort((a, b) => b.val - a.val)
    .map(x => x.p);

  const top3 = sorted.slice(0, 3);
  const medalColors = ["#F59E0B","#94A3B8","#CD7F32"];
  const maxVal = Math.max(...sorted.map(getVal), 1);

  const barraTabs = (
    <div style={{display:"flex",gap:"4px",marginBottom:"16px",background:"var(--bg-elev-2)",borderRadius:"var(--r-md)",padding:"3px"}}>
      {tabs.map(t=>(
        <motion.button key={t.id} whileTap={{scale:0.97}} onClick={()=>setTab(t.id)} style={{...ss.btn,flex:1,background:activeTab===t.id?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"transparent",color:activeTab===t.id?sportColor:"var(--text-2)",border:"none",fontSize:"10px",padding:"7px 4px",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:700,boxShadow:activeTab===t.id?`0 0 12px ${sportColor}33`:"none"}}>{t.label}</motion.button>
      ))}
    </div>
  );

  if (loading) return (
    <div style={{...ss.card,marginTop:compact?"8px":"0"}}>
      <div style={{fontWeight:700,fontSize:"14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>🏋️ Ranking de Fuerza</div>
      <div style={{...ss.muted,fontSize:"12px"}}>Cargando...</div>
    </div>
  );

  if (sorted.length === 0) return (
    <div style={{...ss.card,marginTop:compact?"8px":"0"}}>
      <div style={{fontWeight:700,fontSize:"14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>🏋️ Ranking de Fuerza</div>
      {barraTabs}
      <EmptyState icon="🏋️" title="Sin datos de gym todavía" desc="El ranking aparece cuando los jugadores registran series en Mi Gym." color={sportColor}/>
    </div>
  );

  return (
    <div style={{...ss.card,marginTop:compact?"8px":"0"}}>
      <div style={{fontWeight:700,fontSize:"14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>🏋️ Ranking de Fuerza</div>
      {barraTabs}
      {!compact&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:"10px",marginBottom:"16px"}}>
          {top3.map((p,i)=>(
            <motion.div key={p.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4,delay:i*0.1}} whileHover={{y:-4}} style={{...ss.card,textAlign:"center",border:`1px solid ${medalColors[i]}55`,background:`linear-gradient(135deg,${medalColors[i]}11,transparent)`,boxShadow:`0 0 20px ${medalColors[i]}22`}}>
              <div style={{fontSize:"28px",marginBottom:"4px",filter:`drop-shadow(0 0 12px ${medalColors[i]}66)`}}>{["🥇","🥈","🥉"][i]}</div>
              <div style={{fontSize:"13px",fontWeight:700,letterSpacing:"-0.01em"}}>{p.name.split(" ")[0]}</div>
              <div style={{fontSize:"16px",fontWeight:800,color:medalColors[i],margin:"6px 0",letterSpacing:"-0.02em"}}>{Math.round(getVal(p)).toLocaleString()} kg</div>
            </motion.div>
          ))}
        </div>
      )}
      {sorted.slice(compact?0:3).map((p,i)=>{
        const rank = compact?i+1:i+4;
        const val = getVal(p);
        return (
          <motion.div key={p.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:i*0.04}} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
            <MedalBadge rank={rank}/>
            <span style={{fontSize:"12px",minWidth:"110px",fontWeight:500}}>{p.name}</span>
            <div style={{flex:1}}><ProgressBar value={val} max={maxVal} color={rank===1?sportColor:rank<=3?"#94A3B8":"#4A5568"}/></div>
            <span style={{fontSize:"12px",fontWeight:700,minWidth:"65px",textAlign:"right",color:rank===1?sportColor:"var(--text-1)"}}>{Math.round(val).toLocaleString()} kg</span>
          </motion.div>
        );
      })}
    </div>
  );
}
