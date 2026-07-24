import { useState as useLocalState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import { GYM_PLAN } from "../data/gymPlan";
import { supabase } from "../lib/supabase";
import { getGymPlan, saveGymPlan, getWeekStart, formatWeekLabel } from "../lib/db";
import SectionTitle from "../components/SectionTitle";
import Stat from "../components/Stat";
import Badge from "../components/Badge";
import RankingView from "../components/RankingView";

// Estado médico real (players.med_status / hia_reason en Supabase — verde/amarillo/rojo)
const MED_COLOR = { verde:"#1FA04A", amarillo:"#C98408", rojo:"#C0392B" };
const MED_LABEL = { verde:"Apto", amarillo:"Alerta", rojo:"Lesionado" };
const MED_ICON  = { verde:"🟢", amarillo:"🟡", rojo:"🔴" };

function EstadoPlantelView({ sportColor, players }) {
  const [selected, setSelected]   = useLocalState(null);
  const [catFilter, setCatFilter] = useLocalState("Todas");

  const allCats = ["Todas", ...Array.from(new Set(players.map(p => p.category).filter(Boolean)))];
  const filtered = catFilter === "Todas" ? players : players.filter(p => p.category === catFilter);

  const rojos     = filtered.filter(p => p.med_status === "rojo");
  const amarillos = filtered.filter(p => p.med_status === "amarillo");
  const verdes    = filtered.filter(p => (p.med_status || "verde") === "verde");

  const PlayerCard = ({ p }) => {
    const status = p.med_status || "verde";
    return (
      <motion.div whileHover={{y:-2}} onClick={()=>setSelected(p===selected?null:p)} key={p.id}
        style={{...ss.card,padding:"14px 16px",cursor:"pointer",border:`1px solid ${MED_COLOR[status]}33`,background:`${MED_COLOR[status]}08`,marginBottom:"8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:"36px",height:"36px",borderRadius:"50%",background:`${MED_COLOR[status]}22`,border:`2px solid ${MED_COLOR[status]}55`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:"12px",color:MED_COLOR[status],flexShrink:0}}>{p.number}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:"13px"}}>{p.name}</div>
            <div style={{fontSize:"11px",color:"var(--text-3)"}}>{p.position} · {p.category}</div>
            {p.hia_reason && <div style={{fontSize:"10px",color:MED_COLOR[status],marginTop:"2px",fontWeight:600}}>🩹 {p.hia_reason}</div>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontWeight:800,fontSize:"13px",color:MED_COLOR[status]}}>{MED_ICON[status]} {MED_LABEL[status]}</div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div>
      {/* ── Resumen por categoría ── */}
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"16px"}}>
        {allCats.map(cat => {
          const catPlayers = cat === "Todas" ? players : players.filter(p => p.category === cat);
          const catAlerta  = catPlayers.filter(p => p.med_status === "rojo" || p.med_status === "amarillo").length;
          const semColor   = catAlerta > 0 ? "#C0392B" : "#1FA04A";
          const semIcon    = catAlerta > 0 ? "🔴" : "🟢";
          return (
            <motion.button key={cat} whileHover={{y:-1}} whileTap={{scale:0.97}}
              onClick={() => setCatFilter(cat)}
              style={{...ss.btn, padding:"7px 14px", fontSize:"12px",
                background: catFilter===cat ? `${semColor}18` : "var(--bg-elev-2)",
                border: `1px solid ${catFilter===cat ? semColor+"55" : "var(--border-soft)"}`,
                color: catFilter===cat ? semColor : "var(--text-2)",
                fontWeight: catFilter===cat ? 700 : 500,
                boxShadow: catFilter===cat ? `0 0 12px ${semColor}22` : "none",
                gap:"6px"}}>
              <span>{semIcon}</span> {cat}
              <span style={{fontSize:"10px",color:"var(--text-3)",fontWeight:400}}>({catPlayers.length})</span>
            </motion.button>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"24px"}}>
        <Stat label="Plantel"     value={filtered.length}  sub="Jugadores"      color={sportColor} icon="👥" delay={0}/>
        <Stat label="Lesionados"  value={rojos.length}     sub="No entrenan"    color="#C0392B" icon="🚑" delay={0.05}/>
        <Stat label="En alerta"   value={amarillos.length} sub="Monitorear"     color="#C98408" icon="⚠️" delay={0.1}/>
        <Stat label="Aptos"       value={verdes.length}    sub="Pueden entrenar" color="#1FA04A" icon="✅" delay={0.15}/>
      </div>

      {(rojos.length > 0 || amarillos.length > 0) && (
        <div style={{marginBottom:"24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <span>🚨</span>
            <div style={{fontWeight:700,fontSize:"13px",color:"#C0392B"}}>Requieren atención</div>
            <div style={{flex:1,height:"1px",background:"rgba(192,57,43,0.2)"}}/>
          </div>
          {[...rojos,...amarillos].map(p=><PlayerCard key={p.id} p={p}/>)}
        </div>
      )}
      {verdes.length > 0 && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <span>✅</span>
            <div style={{fontWeight:700,fontSize:"13px",color:"#1FA04A"}}>Aptos ({verdes.length})</div>
            <div style={{flex:1,height:"1px",background:"rgba(31,160,74,0.2)"}}/>
          </div>
          {verdes.map(p=><PlayerCard key={p.id} p={p}/>)}
        </div>
      )}
    </div>
  );
}

export default function PreparadorView({module, sp, showToast, sportColor, publishedPlan, setPublishedPlan, newExForm, setNewExForm, newEx, setNewEx, gymPlanExercises, setGymPlanExercises, rankTab, setRankTab, expandedDay, setExpandedDay, userCats=[], isDemo=true, players=[], clubId=null, currentUser=null}) {
  const days = ["lunes","miercoles","viernes"];
  const dayLabels = {lunes:"Lunes",miercoles:"Miércoles",viernes:"Viernes"};
  const planSessions = gymPlanExercises || GYM_PLAN.sessions;

  // ── Plan real (Supabase) ──────────────────────────────────────────────
  const [planLoading, setPlanLoading] = useLocalState(!!clubId);
  const [saving, setSaving]           = useLocalState(false);
  const [kpis, setKpis] = useLocalState({ cumplimiento:0, activos:0, volumen:0 });
  const weekStart = getWeekStart();
  const weekLabel = clubId ? formatWeekLabel(weekStart) : GYM_PLAN.week;
  const coachName = clubId ? (currentUser?.nombre || "Preparador Físico") : GYM_PLAN.coach;

  useEffect(() => {
    if (!clubId) { setPlanLoading(false); return; }
    setPlanLoading(true);
    getGymPlan(clubId).then(p => {
      setGymPlanExercises(p?.sessions && Object.keys(p.sessions).length ? p.sessions : GYM_PLAN.sessions);
      setPublishedPlan(!!p?.published);
      setPlanLoading(false);
    }).catch(() => setPlanLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (!clubId || players.length === 0) { setKpis({ cumplimiento:0, activos:0, volumen:0 }); return; }
    supabase.from("gym_logs").select("player_id, exercise, weight_kg, reps, volume_kg")
      .in("player_id", players.map(p=>p.id)).eq("week_start", weekStart)
      .then(({ data }) => {
        const logs = data || [];
        const done = logs.filter(l => l.weight_kg && l.reps);
        const totalEjercicios = Object.values(planSessions).reduce((s,d)=>s+d.exercises.length,0);
        const totalPosible = players.length * (totalEjercicios || 1);
        const combos = new Set(done.map(l => `${l.player_id}_${l.exercise}`));
        const activos = new Set(logs.map(l => l.player_id)).size;
        const volumen = logs.reduce((s,l)=>s+(Number(l.volume_kg)||0),0);
        setKpis({ cumplimiento: Math.round(100*combos.size/totalPosible), activos, volumen: Math.round(volumen) });
      });
  }, [clubId, players, weekStart, planSessions]);

  const publicarPlan = async () => {
    if (!clubId) { setPublishedPlan(true); showToast("Plan marcado como publicado ✅","success"); return; }
    setSaving(true);
    try {
      await saveGymPlan({ clubId, weekLabel, coachName, sessions: planSessions, published: true });
      setPublishedPlan(true);
      showToast("Plan publicado ✅","success");
    } catch (e) {
      showToast("Error al publicar el plan: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const addExercise = () => {
    if(!newEx.name){showToast("Escribe el nombre del ejercicio","warning");return;}
    const day = expandedDay;
    setGymPlanExercises(prev=>{const base=prev||GYM_PLAN.sessions;return {...base,[day]:{...base[day],exercises:[...base[day].exercises,{...newEx}]}};});
    setNewEx({name:"",sets:3,reps:8,pct:70,rest:120,notes:"",muscles:""});
    setNewExForm(false);
    showToast(`${newEx.name} agregado al ${dayLabels[day]}`,"success");
  };

  const CatsBanner = () => !isDemo && userCats.length > 0 ? (
    <motion.div {...fadeUp} style={{...ss.card, marginBottom:"14px", padding:"10px 14px", background:"linear-gradient(135deg,rgba(239,68,68,0.08),transparent)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap"}}>
      <span style={{fontSize:"11px",color:"var(--text-2)"}}>💪 Tus categorías:</span>
      {userCats.map(c=><span key={c} style={{fontSize:"11px",padding:"2px 10px",borderRadius:"99px",background:"rgba(239,68,68,0.12)",color:"#F87171",border:"1px solid rgba(239,68,68,0.25)",fontWeight:600}}>{c}</span>)}
    </motion.div>
  ) : null;
  const statusIcon = (s)=>s==="ok"?"✅":s==="parcial"?"⚠️":"⏳";

  if(module==="microciclo") return (
    <div>
      <CatsBanner/>
      <SectionTitle title={`Microciclo — Semana ${weekLabel}`} sub={`${coachName} · ${sp.name}`}
        action={<motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} disabled={saving} onClick={publicarPlan} style={{...ss.btn,background:publishedPlan?"rgba(34,197,94,0.15)":"linear-gradient(135deg,#22C55E,#16A34A)",color:publishedPlan?"#22C55E":"#fff",border:`1px solid ${publishedPlan?"#22C55E55":"transparent"}`,fontSize:"12px",boxShadow:publishedPlan?"none":"0 4px 12px rgba(34,197,94,0.35)",opacity:saving?0.6:1}}>{saving?"Publicando...":publishedPlan?"✅ Plan publicado":"📢 Publicar plan"}</motion.button>}
      />
      {planLoading ? (
        <div style={{...ss.muted,padding:"20px",textAlign:"center"}}>Cargando plan...</div>
      ) : (
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"20px"}}>
        <Stat label="Plan activo" value={weekLabel} sub={clubId ? (publishedPlan?"Publicado":"Sin publicar") : "Pretemporada 2025"} color={sportColor} icon="📅" delay={0.05}/>
        <Stat label="Cumplimiento" value={clubId?`${kpis.cumplimiento}%`:"78%"} sub="Ejercicios completados" color="#22C55E" icon="✅" delay={0.1}/>
        <Stat label="Jugadores activos" value={clubId?kpis.activos:4} sub="Entrenaron esta semana" color="#F59E0B" icon="🏋️" delay={0.15}/>
        <Stat label="Volumen total" value={clubId?`${kpis.volumen.toLocaleString()} kg`:"184.300 kg"} sub="Todo el plantel" color="#A855F7" icon="💪" delay={0.2}/>
      </div>
      )}
      {!planLoading && <>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        {days.map(d=>(
          <motion.button key={d} whileHover={{y:-2}} whileTap={{scale:0.97}} onClick={()=>setExpandedDay(d)} style={{...ss.btn,background:expandedDay===d?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)",color:expandedDay===d?sportColor:"var(--text-2)",border:`1px solid ${expandedDay===d?sportColor+"55":"var(--border-soft)"}`,fontSize:"12px",padding:"10px 16px",textAlign:"left",boxShadow:expandedDay===d?`0 0 16px ${sportColor}33`:"none",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontWeight:700}}>{dayLabels[d]}</span>
            <span style={{fontSize:"10px",opacity:0.7}}>{planSessions[d].label}</span>
          </motion.button>
        ))}
      </div>
      <motion.div {...fadeUp} key={expandedDay} style={ss.card}>
        <div style={{fontWeight:600,marginBottom:"14px",fontSize:"14px",color:sportColor,display:"flex",alignItems:"center",gap:"8px"}}>🏋️ {dayLabels[expandedDay]} — {planSessions[expandedDay].label}</div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 2fr",gap:"10px",marginBottom:"10px",padding:"0 4px"}}>
          {["Ejercicio","Series × Reps","% 1RM","Descanso","Músculos"].map(h=><div key={h} style={{...ss.label,fontSize:"9px",marginBottom:0}}>{h}</div>)}
        </div>
        {planSessions[expandedDay].exercises.map((ex,i)=>(
          <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.3,delay:i*0.06}} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 2fr",gap:"10px",padding:"12px 4px",borderTop:"1px solid var(--border-soft)",alignItems:"center"}}>
            <div style={{fontWeight:600,fontSize:"13px"}}>{ex.name}</div>
            <div><Badge color={sportColor} size="md">{ex.sets}×{ex.reps}</Badge></div>
            <div style={{fontSize:"12px",color:ex.pct?"var(--text-1)":"var(--text-3)"}}>{ex.pct?ex.pct+"%":"—"}</div>
            <div style={{...ss.muted,fontSize:"11px"}}>{ex.rest}s</div>
            <div style={{...ss.muted,fontSize:"11px"}}>{ex.muscles||"—"}</div>
          </motion.div>
        ))}
        <div style={{marginTop:"16px",borderTop:"1px solid var(--border-soft)",paddingTop:"14px"}}>
          {!newExForm
            ? <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>setNewExForm(true)} style={{...ss.btn,background:"transparent",color:"#3B82F6",border:"1px dashed rgba(59,130,246,0.4)",fontSize:"12px",padding:"10px 16px"}}>+ Nuevo ejercicio</motion.button>
            : <motion.div {...scaleIn} style={{background:"linear-gradient(135deg,rgba(59,130,246,0.08),rgba(59,130,246,0.02))",borderRadius:"var(--r-md)",padding:"16px",border:"1px solid rgba(59,130,246,0.25)"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"10px"}}>
                  <div><div style={ss.label}>Ejercicio</div><input value={newEx.name} onChange={e=>setNewEx(p=>({...p,name:e.target.value}))} placeholder="Ej: Sentadilla" style={ss.input}/></div>
                  <div><div style={ss.label}>Series</div><input type="number" value={newEx.sets} onChange={e=>setNewEx(p=>({...p,sets:Number(e.target.value)}))} style={ss.input}/></div>
                  <div><div style={ss.label}>Reps</div><input type="number" value={newEx.reps} onChange={e=>setNewEx(p=>({...p,reps:Number(e.target.value)}))} style={ss.input}/></div>
                  <div><div style={ss.label}>% 1RM</div><input type="number" value={newEx.pct} onChange={e=>setNewEx(p=>({...p,pct:Number(e.target.value)}))} style={ss.input}/></div>
                  <div><div style={ss.label}>Descanso (s)</div><input type="number" value={newEx.rest} onChange={e=>setNewEx(p=>({...p,rest:Number(e.target.value)}))} style={ss.input}/></div>
                  <div><div style={ss.label}>Músculos</div><input value={newEx.muscles} onChange={e=>setNewEx(p=>({...p,muscles:e.target.value}))} placeholder="Cuádriceps" style={ss.input}/></div>
                </div>
                <input value={newEx.notes} onChange={e=>setNewEx(p=>({...p,notes:e.target.value}))} placeholder="Notas técnicas..." style={{...ss.input,marginBottom:"12px"}}/>
                <div style={{display:"flex",gap:"8px"}}>
                  <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={addExercise} style={{...ss.btn,background:"linear-gradient(135deg,#3B82F6,#2563EB)",color:"#fff",fontSize:"12px",boxShadow:"0 4px 12px rgba(59,130,246,0.35)"}}>Agregar</motion.button>
                  <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setNewExForm(false)} style={{...ss.btn,background:"transparent",color:"var(--text-2)",border:"1px solid var(--border-soft)",fontSize:"12px"}}>Cancelar</motion.button>
                </div>
              </motion.div>
          }
        </div>
      </motion.div>
      </>}
    </div>
  );

  if(module==="estadoplantel") return (
    <div>
      <CatsBanner/>
      <EstadoPlantelView sportColor={sportColor} players={players}/>
    </div>
  );

  if(module==="rankingfuerza") return <RankingView tab={rankTab} setTab={setRankTab} sportColor={sportColor} players={players} clubId={clubId}/>;

  return null;
}
