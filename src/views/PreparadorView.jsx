import { useState as useLocalState, useEffect } from "react";
import { m as motion } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import { GYM_PLAN, PLAN_VACIO } from "../data/gymPlan";
import { parseGymPlan, ORDEN_DIAS, ETIQUETA_DIA } from "../lib/gymImport";
import { nombrePuesto } from "../data/sports";
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
            <div style={{fontSize:"11px",color:"var(--text-3)"}}>{nombrePuesto(p.position) || "Sin puesto"} · {p.category}</div>
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

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"10px",marginBottom:"24px"}}>
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
  // Un club real arranca en blanco; la vitrina de demo sigue con su plan.
  const planSessions = gymPlanExercises || (clubId ? PLAN_VACIO : GYM_PLAN.sessions);
  // Los días salen del plan, no de una lista fija: estaban clavados en lunes,
  // miércoles y viernes, y este club entrena lunes, martes y jueves. Un plan
  // importado con otros días quedaba invisible.
  const dayLabels = ETIQUETA_DIA;
  const days = Object.keys(planSessions)
    .sort((a,b) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b));
  // El día abierto vive en App y arranca en "lunes"; si el plan importado no
  // tiene lunes, se abre el primero que sí exista en vez de romperse.
  const diaActivo = days.includes(expandedDay) ? expandedDay : days[0];
  // Un plan sin ejercicios no está publicado, diga lo que diga la base: el
  // botón se apretó alguna vez sobre un plan vacío y desde entonces la
  // pantalla decía "Plan publicado" al lado de tres días en blanco. Publicado
  // es algo que un jugador puede abrir y entrenar.
  const totalEjercicios = Object.values(planSessions)
    .reduce((n, d) => n + (d?.exercises?.length || 0), 0);
  const publicado = publishedPlan && totalEjercicios > 0;
  // ── Plan real (Supabase) ──────────────────────────────────────────────
  const [planLoading, setPlanLoading] = useLocalState(!!clubId);
  const [saving, setSaving]           = useLocalState(false);
  const [importando, setImportando]   = useLocalState(false);
  const [grupoFiltro, setGrupoFiltro] = useLocalState("TODOS");
  // Estas tres derivadas estaban escritas arriba, antes de declarar
  // grupoFiltro: leer un const antes de su declaración es un ReferenceError, y
  // el preparador veía todas sus pantallas en negro.
  const todosDelDia   = planSessions[diaActivo]?.exercises || [];
  const gruposDelDia  = [...new Set(todosDelDia.map(e => e.grupo).filter(Boolean))];
  const ejerciciosDelDia = grupoFiltro === "TODOS" || !gruposDelDia.includes(grupoFiltro)
    ? todosDelDia
    : todosDelDia.filter(e => e.grupo === grupoFiltro);
  const [kpis, setKpis] = useLocalState({ cumplimiento:0, activos:0, volumen:0 });
  const weekStart = getWeekStart();
  const weekLabel = clubId ? formatWeekLabel(weekStart) : GYM_PLAN.week;
  const coachName = clubId ? (currentUser?.nombre || "Preparador Físico") : GYM_PLAN.coach;

  useEffect(() => {
    if (!clubId) { setPlanLoading(false); return; }
    setPlanLoading(true);
    getGymPlan(clubId).then(p => {
      setGymPlanExercises(p?.sessions && Object.keys(p.sessions).length ? p.sessions : PLAN_VACIO);
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
    if (totalEjercicios === 0) {
      showToast("El plan no tiene ejercicios todavía: sube el Excel o agrégalos a mano","warning");
      return;
    }
    // Vuelto a apretar, despublica: antes no hacía nada y no había forma de
    // sacar de circulación un plan que se publicó por error.
    const nuevo = !publicado;
    if (!clubId) { setPublishedPlan(nuevo); showToast(nuevo ? "Plan marcado como publicado ✅" : "Plan despublicado","success"); return; }
    setSaving(true);
    try {
      await saveGymPlan({ clubId, weekLabel, coachName, sessions: planSessions, published: nuevo });
      setPublishedPlan(nuevo);
      showToast(nuevo ? "Plan publicado ✅" : "Plan despublicado — los jugadores dejan de verlo","success");
    } catch (e) {
      showToast("Error al publicar el plan: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const addExercise = () => {
    if(!newEx.name){showToast("Escribe el nombre del ejercicio","warning");return;}
    const day = diaActivo;
    setGymPlanExercises(prev=>{const base=prev||(clubId?PLAN_VACIO:GYM_PLAN.sessions);return {...base,[day]:{...base[day],exercises:[...base[day].exercises,{...newEx}]}};});
    setNewEx({name:"",sets:3,reps:8,pct:70,rest:120,notes:"",muscles:""});
    setNewExForm(false);
    showToast(`${newEx.name} agregado al ${dayLabels[day]}`,"success");
  };

  const catsBanner = !isDemo && userCats.length > 0 ? (
    <motion.div {...fadeUp} style={{...ss.card, marginBottom:"14px", padding:"10px 14px", background:"linear-gradient(135deg,rgba(239,68,68,0.08),transparent)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap"}}>
      <span style={{fontSize:"11px",color:"var(--text-2)"}}>💪 Tus categorías:</span>
      {userCats.map(c=><span key={c} style={{fontSize:"11px",padding:"2px 10px",borderRadius:"99px",background:"rgba(239,68,68,0.12)",color:"#F87171",border:"1px solid rgba(239,68,68,0.25)",fontWeight:600}}>{c}</span>)}
    </motion.div>
  ) : null;

  if(module==="microciclo") return (
    <div>
      {catsBanner}
      <SectionTitle title={`Microciclo — Semana ${weekLabel}`} sub={`${coachName} · ${sp.name}`}
        action={<div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {/* El PF manda el microciclo en Excel; cargar tres días a mano son
              dieciocho formularios para copiar algo que ya está escrito. */}
          <label style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-2)",border:"1px solid var(--border-soft)",fontSize:"12px",cursor:importando?"wait":"pointer",opacity:importando?0.6:1}}>
            {importando ? "Leyendo…" : "📄 Subir Excel"}
            {/* Varios a la vez: el PF manda un archivo por grupo de puestos
                (medios/wings/fullbacks, primeras y segundas, terceras y
                centros) y son la misma semana. */}
            <input type="file" accept=".xlsx,.xls,.csv" multiple style={{display:"none"}} disabled={importando}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                if (files.length === 0) return;
                setImportando(true);
                try {
                  const { sessions, avisos, total, grupos } = await parseGymPlan(files);
                  setGymPlanExercises(sessions);
                  // Se guarda de inmediato, pero sin publicar: el PF revisa lo
                  // que quedó antes de que los jugadores lo vean.
                  if (clubId) await saveGymPlan({ clubId, weekLabel, coachName, sessions, published: false });
                  setPublishedPlan(false);
                  showToast(
                    `${total} ejercicios en ${Object.keys(sessions).length} días` +
                    (grupos.length > 1 ? ` · ${grupos.length} grupos de puestos` : ""), "success");
                  avisos.forEach(a => showToast(a, "warning"));
                } catch (err) {
                  showToast("No se pudo leer: " + err.message, "error");
                } finally { setImportando(false); }
              }}/>
          </label>
          <motion.button whileHover={totalEjercicios?{scale:1.05}:{}} whileTap={totalEjercicios?{scale:0.95}:{}}
            disabled={saving || totalEjercicios === 0} onClick={publicarPlan}
            title={totalEjercicios === 0 ? "Sube el plan de la semana para poder publicarlo" : publicado ? "Vuelve a apretar para despublicarlo" : ""}
            style={{...ss.btn,
              background: totalEjercicios === 0 ? "var(--bg-elev-2)" : publicado?"rgba(34,197,94,0.15)":"linear-gradient(135deg,#22C55E,#16A34A)",
              color: totalEjercicios === 0 ? "var(--text-4)" : publicado?"#22C55E":"#fff",
              border:`1px solid ${totalEjercicios === 0 ? "var(--border-soft)" : publicado?"#22C55E55":"transparent"}`,
              fontSize:"12px", cursor: totalEjercicios === 0 ? "not-allowed" : "pointer",
              boxShadow: (publicado || totalEjercicios===0) ? "none" : "0 4px 12px rgba(34,197,94,0.35)",
              opacity:saving?0.6:1}}>
            {saving ? "Guardando..." : totalEjercicios === 0 ? "Sin plan que publicar" : publicado ? "✅ Plan publicado" : "📢 Publicar plan"}
          </motion.button>
        </div>}
      />
      {planLoading ? (
        <div style={{...ss.muted,padding:"20px",textAlign:"center"}}>Cargando plan...</div>
      ) : (
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"12px",marginBottom:"20px"}}>
        <Stat label="Plan activo" value={weekLabel}
          sub={clubId ? (totalEjercicios === 0 ? "Sin ejercicios" : publicado ? `Publicado · ${totalEjercicios} ejercicios` : `Sin publicar · ${totalEjercicios} ejercicios`) : "Pretemporada 2025"}
          color={sportColor} icon="📅" delay={0.05}/>
        <Stat label="Cumplimiento" value={clubId?`${kpis.cumplimiento}%`:"78%"} sub="Ejercicios completados" color="#22C55E" icon="✅" delay={0.1}/>
        <Stat label="Jugadores activos" value={clubId?kpis.activos:4} sub="Entrenaron esta semana" color="#F59E0B" icon="🏋️" delay={0.15}/>
        <Stat label="Volumen total" value={clubId?`${kpis.volumen.toLocaleString()} kg`:"184.300 kg"} sub="Todo el plantel" color="#A855F7" icon="💪" delay={0.2}/>
      </div>
      )}
      {!planLoading && <>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        {days.map(d=>(
          <motion.button key={d} whileHover={{y:-2}} whileTap={{scale:0.97}} onClick={()=>setExpandedDay(d)} style={{...ss.btn,background:diaActivo===d?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)",color:diaActivo===d?sportColor:"var(--text-2)",border:`1px solid ${diaActivo===d?sportColor+"55":"var(--border-soft)"}`,fontSize:"12px",padding:"10px 16px",textAlign:"left",boxShadow:diaActivo===d?`0 0 16px ${sportColor}33`:"none",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:"2px"}}>
            <span style={{fontWeight:700}}>{dayLabels[d]}</span>
            <span style={{fontSize:"10px",opacity:0.7}}>{planSessions[d]?.label || "Sin definir"}</span>
          </motion.button>
        ))}
      </div>
      <motion.div {...fadeUp} key={diaActivo} style={ss.card}>
        <div style={{fontWeight:600,marginBottom:"14px",fontSize:"14px",color:sportColor,display:"flex",alignItems:"center",gap:"8px"}}>🏋️ {dayLabels[diaActivo]} — {planSessions[diaActivo]?.label || "Sin definir"}</div>
        {/* Los grupos de puestos: el lunes de un pilar y el de un wing no son
            el mismo entrenamiento, y vienen en archivos distintos. */}
        {gruposDelDia.length > 1 && (
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
            {["TODOS", ...gruposDelDia].map(g=>(
              <button key={g} onClick={()=>setGrupoFiltro(g)}
                style={{...ss.btn,fontSize:"11px",padding:"5px 10px",
                  background: grupoFiltro===g ? `${sportColor}22` : "var(--bg-elev-2)",
                  color: grupoFiltro===g ? sportColor : "var(--text-3)",
                  border:`1px solid ${grupoFiltro===g ? sportColor : "var(--border-soft)"}`}}>
                {g === "TODOS" ? "Todos" : g}
              </button>
            ))}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"2.4fr 0.9fr 1.2fr 1fr",gap:"10px",marginBottom:"10px",padding:"0 4px"}}>
          {["Ejercicio","Series × Reps","Carga","Descanso"].map(h=><div key={h} style={{...ss.label,fontSize:"9px",marginBottom:0}}>{h}</div>)}
        </div>
        {ejerciciosDelDia.length === 0 && (
          <div style={{...ss.muted,fontSize:"12px",padding:"14px 4px",borderTop:"1px solid var(--border-soft)"}}>
            Este día todavía no tiene ejercicios. Súbelos con el Excel o agrégalos abajo.
          </div>
        )}
        {ejerciciosDelDia.map((ex,i)=>{
          // El bloque se escribe una vez y no en cada fila: repetirlo doce
          // veces es ruido, y el PF lo usa como separador de la sesión.
          const nuevoBloque = ex.bloque && ex.bloque !== ejerciciosDelDia[i-1]?.bloque;
          return (
          <div key={i}>
            {nuevoBloque && (
              <div style={{fontSize:"11px",fontWeight:700,color:sportColor,textTransform:"uppercase",letterSpacing:"0.06em",padding:"14px 4px 6px"}}>
                {ex.bloque}
              </div>
            )}
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.25,delay:Math.min(i,15)*0.03}}
              style={{display:"grid",gridTemplateColumns:"2.4fr 0.9fr 1.2fr 1fr",gap:"10px",padding:"10px 4px",borderTop:"1px solid var(--border-soft)",alignItems:"center"}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:600,fontSize:"13px"}}>
                  {ex.name}
                  {ex.video && (
                    <a href={ex.video} target="_blank" rel="noreferrer" title="Ver video"
                      style={{marginLeft:"6px",fontSize:"11px",textDecoration:"none"}}>▶</a>
                  )}
                </div>
                {(grupoFiltro === "TODOS" && ex.grupo) && (
                  <div style={{...ss.muted,fontSize:"10px",marginTop:"1px"}}>{ex.grupo}</div>
                )}
                {ex.notes && <div style={{...ss.muted,fontSize:"10px",marginTop:"1px"}}>{ex.notes}</div>}
              </div>
              <div>{ex.sets || ex.reps
                ? <Badge color={sportColor} size="md">{[ex.sets, ex.reps].filter(Boolean).join("×")}</Badge>
                : <span style={{...ss.muted,fontSize:"11px"}}>—</span>}</div>
              <div style={{fontSize:"11.5px",color:ex.carga?"var(--text-1)":"var(--text-3)"}}>{ex.carga || (ex.pct ? ex.pct+"%" : "—")}</div>
              <div style={{...ss.muted,fontSize:"11px"}}>{ex.rest ? (typeof ex.rest === "number" ? ex.rest+"s" : ex.rest) : "—"}</div>
            </motion.div>
          </div>
          );
        })}
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
      {catsBanner}
      <EstadoPlantelView sportColor={sportColor} players={players}/>
    </div>
  );

  if(module==="rankingfuerza") return <RankingView tab={rankTab} setTab={setRankTab} sportColor={sportColor} players={players} clubId={clubId}/>;

  return null;
}
