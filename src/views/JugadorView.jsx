import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import { FORMATIONS, TEAMS } from "../data/sports";
import { GYM_PLAN } from "../data/gymPlan";
import { usePosts } from "../lib/usePosts";
import { getNotifications, getLineups, getGymPlan, saveGymSet, getGymHistory, getWeekStart, formatWeekLabel } from "../lib/db";
import { supabase } from "../lib/supabase";
import SectionTitle from "../components/SectionTitle";
import Badge from "../components/Badge";
import Semaforo from "../components/Semaforo";
import EmptyState from "../components/EmptyState";
import Cancha from "../components/Cancha";
import ProgressBar from "../components/ProgressBar";
import RankingView from "../components/RankingView";

/* ── MiCuota ────────────────────────────────────────────────── */
function MiCuota({player, club, countryData, sportColor, showToast, payments, setPayments, addPayment, declarePayment, clubId, isDemo=false}) {
  const [selectedMethod, setSelectedMethod] = useState("Transferencia");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(player.cuota_status ? player.cuota_status === "ok" : player.cuota === "ok");
  const [bankInfo, setBankInfo] = useState(null);
  const [copiedField, setCopiedField] = useState("");

  // En demo (sin club real) mostramos el monto de vitrina; con club real,
  // el único monto válido es el que el admin configuró en Mi Club.
  const cuota = isDemo ? club.cuota : bankInfo?.cuota_mensual;
  const cuotaConfigurada = !!cuota;

  const myPayments = payments.filter(p => p.playerId === player.id);
  const declarado = myPayments.some(p => p.estado === "declarado");

  // Métodos realmente implementados hoy — el resto es "Próximamente".
  // Mercado Pago todavía no se verificó de punta a punta con credenciales
  // reales, así que se muestra como no disponible aunque el club ya haya
  // cargado sus credenciales en Mi Club.
  const METODOS_LISTOS = ["Transferencia"];

  useEffect(() => {
    if (!clubId) return;
    supabase.from("club_payment_info").select("*").eq("club_id", clubId).single()
      .then(({ data }) => setBankInfo(data || null));
  }, [clubId]);

  const copy = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  };

  const handleMercadoPago = async () => {
    setPaying(true);
    try {
      const resp = await fetch("/api/mercadopago-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ club_id: clubId, player_id: player.id }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.init_point) throw new Error(data.error || "No se pudo iniciar el pago");
      window.location.href = data.init_point;
    } catch (e) {
      showToast("Error al iniciar el pago: " + e.message, "error");
      setPaying(false);
    }
  };

  const handleDeclarar = async () => {
    if (selectedMethod === "Mercado Pago") return handleMercadoPago();
    setPaying(true);
    try {
      if (declarePayment) {
        await declarePayment({ playerId: player.id, amount: cuota, method: selectedMethod });
        showToast("Le avisamos al admin — confirma cuando reciba tu transferencia ✅", "success");
      } else {
        const newPayment = { id: payments.length + 1, playerId: player.id, playerName: player.name, amount: cuota, method: selectedMethod, date: new Date().toISOString().split("T")[0], estado: "declarado" };
        setPayments(prev => [newPayment, ...prev]);
        showToast("Le avisamos al admin — confirma cuando reciba tu transferencia ✅", "success");
      }
    } catch (e) {
      showToast("Error al notificar el pago", "error");
    } finally {
      setPaying(false);
    }
  };

  const methodIcons = { Khipu:"💚", Transbank:"💳", Transferencia:"🏦", "Mercado Pago":"🔵", Pix:"🟢" };

  return (
    <div>
      <SectionTitle title="Mi Cuota" sub={`${club.name} · ${countryData.flag} ${countryData.currency}`}/>

      {/* Estado actual */}
      <motion.div {...fadeUp} style={{...ss.card, marginBottom:"16px", border:`2px solid ${paid?"#22C55E55":"#EF444455"}`, background:paid?"linear-gradient(135deg,rgba(34,197,94,0.08),transparent)":"linear-gradient(135deg,rgba(239,68,68,0.08),transparent)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
            <div style={{width:"52px",height:"52px",borderRadius:"50%",background:paid?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",border:`2px solid ${paid?"#22C55E55":"#EF444455"}`}}>
              {paid ? "✅" : "⚠️"}
            </div>
            <div>
              <div style={{fontSize:"15px",fontWeight:700}}>{paid ? "Cuota al día" : "Cuota pendiente"}</div>
              <div style={{...ss.muted, marginTop:"4px"}}>Mes en curso · vence el 30</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"28px",fontWeight:800,color:paid?"#22C55E":"#EF4444",letterSpacing:"-0.02em"}}>{cuotaConfigurada ? `${countryData.symbol}${cuota.toLocaleString()}` : "—"}</div>
            <div style={ss.muted}>{countryData.currency}</div>
          </div>
        </div>
      </motion.div>

      {/* Esperando confirmación del admin */}
      {!paid && declarado && (
        <motion.div {...fadeUp} style={{...ss.card, marginBottom:"16px", border:"2px solid rgba(245,158,11,0.4)", background:"linear-gradient(135deg,rgba(245,158,11,0.08),transparent)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"24px"}}>⏳</span>
            <div>
              <div style={{fontWeight:700,fontSize:"14px",color:"#F59E0B"}}>Esperando confirmación</div>
              <div style={{fontSize:"12px",color:"var(--text-3)",marginTop:"3px"}}>Le avisamos al admin que transferiste. Confirmará tu pago cuando lo reciba.</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Formulario de pago */}
      {!paid && !declarado && (
        <motion.div {...fadeUp} transition={{delay:0.1}} style={{...ss.card, marginBottom:"16px"}}>
          <div style={{fontWeight:600,fontSize:"14px",marginBottom:"14px"}}>💳 Pagar cuota mensual</div>

          <div style={ss.label}>Selecciona tu método de pago</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"20px"}}>
            {countryData.payments.map(m => {
              const listo = METODOS_LISTOS.includes(m);
              return (
                <motion.button key={m} whileHover={listo?{scale:1.03}:{}} whileTap={listo?{scale:0.97}:{}}
                  onClick={()=>listo && setSelectedMethod(m)} disabled={!listo}
                  style={{...ss.btn, background:selectedMethod===m?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)", color:selectedMethod===m?sportColor:listo?"var(--text-2)":"var(--text-4)", border:`1px solid ${selectedMethod===m?sportColor+"55":"var(--border-soft)"}`, padding:"10px 18px", fontSize:"13px", boxShadow:selectedMethod===m?`0 0 16px ${sportColor}33`:"none", opacity:listo?1:0.55, cursor:listo?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:"6px"}}>
                  {methodIcons[m]||"💳"} {m}
                  {!listo && <span style={{fontSize:"9px",padding:"2px 6px",borderRadius:"99px",background:"var(--bg-elev-3)",color:"var(--text-4)",fontWeight:700}}>Próximamente</span>}
                </motion.button>
              );
            })}
          </div>

          {!cuotaConfigurada && (
            <div style={{...ss.card, background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)", marginBottom:"16px", padding:"14px", fontSize:"12px", color:"var(--text-3)"}}>
              ⚠️ Tu club todavía no configuró el monto de la cuota. Pídele al admin que lo complete en Mi Club.
            </div>
          )}

          {selectedMethod === "Transferencia" && (
            bankInfo ? (
              <div style={{...ss.card, background:"var(--bg-elev-1)", marginBottom:"16px", padding:"14px"}}>
                <div style={{fontWeight:700,fontSize:"12px",marginBottom:"10px",color:"var(--text-2)"}}>🏦 Datos para transferir</div>
                {[
                  ["Banco", bankInfo.banco],
                  ["Tipo de cuenta", bankInfo.tipo_cuenta],
                  ["Número de cuenta", bankInfo.numero_cuenta],
                  ["RUT titular", bankInfo.rut_titular],
                  ["Nombre titular", bankInfo.nombre_titular],
                  ["Email titular", bankInfo.email_titular],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--border-soft)",fontSize:"12px"}}>
                    <div>
                      <div style={{color:"var(--text-3)",fontSize:"10px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
                      <div style={{fontWeight:600,marginTop:"2px"}}>{value}</div>
                    </div>
                    <button onClick={()=>copy(value,label)} style={{background:"none",border:"1px solid var(--border-soft)",borderRadius:"var(--r-sm)",padding:"4px 10px",fontSize:"11px",color:copiedField===label?"#22C55E":"var(--text-2)",cursor:"pointer"}}>
                      {copiedField===label ? "✅ Copiado" : "📋 Copiar"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{...ss.card, background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)", marginBottom:"16px", padding:"14px", fontSize:"12px", color:"var(--text-3)"}}>
                ⚠️ Tu club todavía no cargó sus datos de transferencia. Pídele al admin que los complete en Mi Club.
              </div>
            )
          )}

          <div style={{...ss.card, background:"var(--bg-elev-1)", marginBottom:"16px", padding:"14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px",fontSize:"13px"}}>
              <span style={{color:"var(--text-2)"}}>Cuota mensual</span>
              <span>{cuotaConfigurada ? `${countryData.symbol}${cuota.toLocaleString()}` : "—"}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px",fontSize:"13px"}}>
              <span style={{color:"var(--text-2)"}}>Comisión plataforma</span>
              <span style={{color:"var(--text-3)"}}>$0</span>
            </div>
            <div style={{borderTop:"1px solid var(--border-soft)",paddingTop:"8px",display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:"15px"}}>
              <span>Total</span>
              <span style={{color:sportColor}}>{cuotaConfigurada ? `${countryData.symbol}${cuota.toLocaleString()} ${countryData.currency}` : "—"}</span>
            </div>
          </div>

          <motion.button whileHover={!paying?{scale:1.02,y:-2}:{}} whileTap={!paying?{scale:0.98}:{}} onClick={handleDeclarar} disabled={paying || !cuotaConfigurada || (selectedMethod==="Transferencia" && !bankInfo)}
            style={{...ss.btn, background:paying?"rgba(255,255,255,0.06)":`linear-gradient(135deg,${sportColor},${sportColor}cc)`, color:paying?"var(--text-3)":"#fff", width:"100%", padding:"14px", fontSize:"14px", fontWeight:700, boxShadow:paying?"none":`0 8px 24px ${sportColor}44`, cursor:paying?"not-allowed":"pointer", opacity:(!cuotaConfigurada || (selectedMethod==="Transferencia" && !bankInfo))?0.5:1}}>
            {paying
              ? (selectedMethod==="Mercado Pago" ? "⏳ Redirigiendo..." : "⏳ Enviando...")
              : (selectedMethod==="Mercado Pago" ? "💳 Pagar con Mercado Pago" : "✅ Ya transferí, notificar al admin")}
          </motion.button>
        </motion.div>
      )}

      {/* Confirmación post-pago */}
      {paid && myPayments.length > 0 && (
        <motion.div {...scaleIn} style={{...ss.card, marginBottom:"16px", border:"2px solid rgba(34,197,94,0.4)", background:"linear-gradient(135deg,rgba(34,197,94,0.08),transparent)"}}>
          <div style={{color:"#22C55E",fontWeight:700,fontSize:"14px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>🎉 ¡Pago registrado!</div>
          <div style={{fontSize:"13px",color:"var(--text-2)"}}>Método: <strong style={{color:"var(--text-1)"}}>{myPayments[0].method}</strong></div>
          <div style={{fontSize:"13px",color:"var(--text-2)",marginTop:"4px"}}>Fecha: <strong style={{color:"var(--text-1)"}}>{myPayments[0].date}</strong></div>
          <div style={{fontSize:"13px",color:"var(--text-2)",marginTop:"4px"}}>Monto: <strong style={{color:"#22C55E"}}>{countryData.symbol}{myPayments[0].amount.toLocaleString()}</strong></div>
        </motion.div>
      )}

      {/* Historial de pagos */}
      {myPayments.length > 0 && (
        <motion.div {...fadeUp} transition={{delay:0.2}} style={ss.card}>
          <div style={{fontWeight:600,fontSize:"14px",marginBottom:"14px"}}>📋 Historial de pagos</div>
          {myPayments.map((p,i) => (
            <motion.div key={p.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<myPayments.length-1?"1px solid var(--border-soft)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"34px",height:"34px",borderRadius:"50%",background:"rgba(34,197,94,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",border:"1px solid rgba(34,197,94,0.3)"}}>✅</div>
                <div>
                  <div style={{fontSize:"13px",fontWeight:500}}>{p.method}</div>
                  <div style={ss.muted}>{p.date}</div>
                </div>
              </div>
              <div style={{fontWeight:700,color:"#22C55E"}}>{countryData.symbol}{p.amount.toLocaleString()}</div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/* ── GymJugador — antes el plan era 100% fabricado (misma semana y sesión
   "Lunes — Fuerza inferior · Prof. Marcos Díaz" siempre) y las series que el
   jugador registraba nunca se guardaban en Supabase (solo vivían en un
   estado de React que se perdía al recargar) — por eso el Ranking de Fuerza
   aparecía siempre vacío para clubes reales. Ahora carga el plan real
   publicado por el preparador y persiste cada serie en gym_logs. ────────── */
function GymJugador({player, sportColor, showToast, rankTab, setRankTab, players, clubId}) {
  const dayLabels = {lunes:"Lunes",miercoles:"Miércoles",viernes:"Viernes"};
  const defaultDay = () => { const d = new Date().getDay(); return d<=1?"lunes":d<=3?"miercoles":"viernes"; };

  const [plan, setPlan]           = useState(null);
  const [planLoading, setPlanLoading] = useState(!!clubId);
  const [selectedDay, setSelectedDay] = useState(defaultDay());
  const [gymLog, setGymLog]       = useState({});
  const [prevBest, setPrevBest]   = useState({}); // 1RM máximo histórico por ejercicio (antes de esta semana)
  const [lastWeekVol, setLastWeekVol] = useState(0);
  const [expandedEx, setExpandedEx] = useState(null);
  const [completedSession, setCompletedSession] = useState(false);

  const weekStart = getWeekStart();
  const PREV_1RM_DEMO = {Sentadilla:140,"Hip Thrust":120,"Press Banca":110,"Pull-up":90,"Power Clean":95};

  useEffect(() => {
    if (!clubId) { setPlanLoading(false); return; }
    setPlanLoading(true);
    getGymPlan(clubId).then(setPlan).finally(()=>setPlanLoading(false));
  }, [clubId]);

  useEffect(() => {
    if (!clubId || !player?.id) return;
    getGymHistory(player.id).then(logs => {
      const prevWeekStart = getWeekStart(new Date(new Date(weekStart+"T12:00:00").getTime() - 7*24*3600*1000));
      const best = {};
      (logs||[]).filter(l => l.week_start !== weekStart).forEach(l => {
        const rm = Number(l.one_rm_kg)||0;
        if (rm > (best[l.exercise]||0)) best[l.exercise] = rm;
      });
      setPrevBest(best);
      setLastWeekVol((logs||[]).filter(l=>l.week_start===prevWeekStart).reduce((s,l)=>s+(Number(l.volume_kg)||0),0));
      const buffer = {};
      (logs||[]).filter(l => l.week_start === weekStart).forEach(l => {
        buffer[`${l.exercise}_${l.set_index}`] = { weight: l.weight_kg??"", reps: l.reps??"", rpe: l.rpe??"" };
      });
      setGymLog(buffer);
    }).catch(()=>{});
  }, [clubId, player?.id]);

  // Con club real, si el preparador no publicó plan no hay plan. Antes caía al
  // de demo aunque hubiera clubId (a diferencia de las dos líneas de abajo, que
  // sí lo preguntan): el jugador veía una semana de entrenamiento inventada,
  // con ejercicios y kilos que nadie le mandó.
  const planPropio = plan?.sessions && Object.keys(plan.sessions).length ? plan.sessions : null;
  const sessions  = planPropio || (clubId ? null : GYM_PLAN.sessions);
  const weekLabel = clubId ? (plan?.week_label || formatWeekLabel(weekStart)) : GYM_PLAN.week;
  const coachName = clubId ? (plan?.coach_name || "Preparador Físico") : GYM_PLAN.coach;
  const todayPlan = sessions ? (sessions[selectedDay] || sessions.lunes) : null;

  const logSet   = (exName,setIdx,field,val)=>setGymLog(prev=>{const key=`${exName}_${setIdx}`;return {...prev,[key]:{...(prev[key]||{}),[field]:val}};});
  const getLog   = (exName,setIdx,field)=>{const key=`${exName}_${setIdx}`;return gymLog[key]?gymLog[key][field]:"";};
  const calcVol  = (exName,sets)=>{let t=0;for(let i=0;i<sets;i++){const w=parseFloat(getLog(exName,i,"weight")||0);const r=parseFloat(getLog(exName,i,"reps")||0);t+=w*r;}return Math.round(t);};
  const calc1RM  = (w,r)=>r?Math.round(w*(1+r/30)):0;
  const exCompleted = (ex)=>{for(let i=0;i<ex.sets;i++){if(!getLog(ex.name,i,"weight")||!getLog(ex.name,i,"reps"))return false;}return true;};
  // todayPlan puede ser null si el plan está publicado pero sin sesiones. Estas
  // tres líneas corren antes del guard de más abajo, así que tienen que
  // aguantarlo sin reventar.
  const ejercicios = todayPlan?.exercises ?? [];
  const allDone  = ejercicios.length > 0 && ejercicios.every(ex=>exCompleted(ex));
  const totalVol = ejercicios.reduce((s,ex)=>s+calcVol(ex.name,ex.sets),0);
  const rpeColor = (v)=>v<=3?"#22C55E":v<=6?"#F59E0B":"#EF4444";

  const persistSet = async (exName, setIdx, overrides={}) => {
    if (!clubId) return;
    const key = `${exName}_${setIdx}`;
    const entry = { ...(gymLog[key]||{}), ...overrides };
    try {
      await saveGymSet({
        playerId: player.id, exercise: exName, setIndex: setIdx,
        weight: entry.weight ? Number(entry.weight) : null,
        reps: entry.reps ? Number(entry.reps) : null,
        rpe: entry.rpe ? Number(entry.rpe) : null,
        weekStart,
      });
    } catch (e) {
      showToast("Error al guardar la serie: " + e.message, "error");
    }
  };

  // Récords reales: 1RM estimado hoy supera el máximo histórico previo (solo si ya existía un máximo previo)
  const records = ejercicios.map(ex => {
    const maxWeight = Math.max(0,...Array.from({length:ex.sets},(_,i)=>parseFloat(getLog(ex.name,i,"weight")||0)));
    const maxReps   = Math.max(0,...Array.from({length:ex.sets},(_,i)=>parseFloat(getLog(ex.name,i,"reps")||0)));
    const est1RM = calc1RM(maxWeight,maxReps);
    const prev = clubId ? (prevBest[ex.name]||0) : (PREV_1RM_DEMO[ex.name]||0);
    return prev>0 && est1RM>prev ? {exercise:ex.name, value:est1RM} : null;
  }).filter(Boolean);

  if (planLoading) return <div style={{...ss.muted,padding:"20px",textAlign:"center"}}>Cargando plan...</div>;

  if (clubId && (!plan?.published || !sessions || !todayPlan)) return (
    <EmptyState icon="🏋️" title="Sin plan de gimnasio publicado" desc="Tu preparador físico todavía no publicó el plan de esta semana." color={sportColor}/>
  );

  return (
    <div>
      <div style={{display:"flex",gap:"8px",marginBottom:"14px",flexWrap:"wrap"}}>
        {Object.keys(sessions).map(d=>(
          <motion.button key={d} whileHover={{y:-2}} whileTap={{scale:0.97}} onClick={()=>setSelectedDay(d)}
            style={{...ss.btn,background:selectedDay===d?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)",color:selectedDay===d?sportColor:"var(--text-2)",border:`1px solid ${selectedDay===d?sportColor+"55":"var(--border-soft)"}`,fontSize:"12px",padding:"8px 14px"}}>
            {dayLabels[d]||d}
          </motion.button>
        ))}
      </div>
      {!completedSession&&(
        <motion.div {...fadeUp} style={{...ss.card,marginBottom:"16px",background:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.02))",border:"1px solid rgba(245,158,11,0.4)",display:"flex",alignItems:"center",gap:"12px",padding:"14px 16px"}}>
          <motion.span animate={{rotate:[0,10,-10,0]}} transition={{duration:2,repeat:Infinity}} style={{fontSize:"22px"}}>💪</motion.span>
          <div><div style={{fontSize:"13px",fontWeight:700,color:"#F59E0B"}}>Plan activo: {weekLabel}</div><div style={{...ss.muted,fontSize:"11px"}}>{dayLabels[selectedDay]||selectedDay} — {todayPlan.label} · {coachName}</div></div>
        </motion.div>
      )}
      {completedSession&&(
        <motion.div {...scaleIn} style={{...ss.card,marginBottom:"20px",background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.02))",border:"2px solid rgba(34,197,94,0.5)",boxShadow:"0 0 32px rgba(34,197,94,0.25)"}}>
          <div style={{color:"#22C55E",fontWeight:700,fontSize:"15px",marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>🎉 ¡Sesión completada! — {dayLabels[selectedDay]||selectedDay}</div>
          <div style={{display:"flex",gap:"20px",marginBottom:"12px"}}>
            <div><div style={{fontSize:"26px",fontWeight:800,letterSpacing:"-0.02em"}}>{totalVol.toLocaleString()} kg</div><div style={ss.muted}>Volumen total</div></div>
            {clubId && lastWeekVol>0 && (
              <div><div style={{fontSize:"18px",fontWeight:700,color:totalVol>=lastWeekVol?"#22C55E":"#EF4444"}}>{totalVol>=lastWeekVol?"↑":"↓"} {Math.abs(totalVol-lastWeekVol).toLocaleString()} kg</div><div style={ss.muted}>vs semana pasada</div></div>
            )}
          </div>
          {records.map(r=>(
            <motion.div key={r.exercise} initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} style={{display:"flex",alignItems:"center",gap:"8px",background:"linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05))",border:"1px solid rgba(245,158,11,0.5)",borderRadius:"var(--r-md)",padding:"10px 14px",marginBottom:"8px",boxShadow:"0 0 16px rgba(245,158,11,0.3)"}}>
              <span style={{fontSize:"22px"}}>🏆</span><span style={{color:"#F59E0B",fontWeight:700,fontSize:"13px"}}>NUEVO RÉCORD PERSONAL en {r.exercise} — {r.value} kg</span>
            </motion.div>
          ))}
        </motion.div>
      )}
      {todayPlan.exercises.map((ex,ei)=>{
        const prev1RM  = clubId ? (prevBest[ex.name]||0) : (PREV_1RM_DEMO[ex.name]||100);
        const suggested = ex.pct && prev1RM ?Math.round(prev1RM*(ex.pct/100)):null;
        const vol  = calcVol(ex.name,ex.sets);
        const done = exCompleted(ex);
        const maxWeight = Math.max(0,...Array.from({length:ex.sets},(_,i)=>parseFloat(getLog(ex.name,i,"weight")||0)));
        const maxReps   = Math.max(0,...Array.from({length:ex.sets},(_,i)=>parseFloat(getLog(ex.name,i,"reps")||0)));
        const est1RM = calc1RM(maxWeight,maxReps);
        const isRecord = prev1RM>0 && est1RM>prev1RM && maxWeight>0;
        return (
          <motion.div key={ei} {...fadeUp} transition={{duration:0.4,delay:ei*0.05}} style={{...ss.card,marginBottom:"14px",border:done?"2px solid #22C55E55":isRecord?"2px solid rgba(245,158,11,0.6)":"1px solid var(--border-soft)",boxShadow:isRecord?"0 0 20px rgba(245,158,11,0.25)":"none",transition:"all 0.3s",position:"relative"}}>
            {isRecord&&<motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300}} style={{position:"absolute",top:"-10px",right:"12px",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",fontSize:"11px",fontWeight:800,padding:"4px 12px",borderRadius:"99px",boxShadow:"0 4px 16px rgba(245,158,11,0.5)",zIndex:2}}>🏆 NUEVO RÉCORD</motion.div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px",cursor:"pointer"}} onClick={()=>setExpandedEx(expandedEx===ei?null:ei)}>
              <div><div style={{fontWeight:700,fontSize:"14px",display:"flex",alignItems:"center",gap:"8px",letterSpacing:"-0.01em"}}>{done&&<span style={{color:"#22C55E",fontSize:"16px"}}>✓</span>}{ex.name}</div>{suggested&&<div style={{fontSize:"12px",color:"#3B82F6",marginTop:"4px"}}>{ex.sets} × {ex.reps} × {ex.pct}% 1RM ≈ <strong>{suggested} kg</strong> sugerido</div>}</div>
              <motion.span animate={{rotate:expandedEx===ei?180:0}} transition={{duration:0.2}} style={{color:"var(--text-3)",fontSize:"12px"}}>▼</motion.span>
            </div>
            <AnimatePresence>
              {expandedEx===ei&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.3,ease:[0.16,1,0.3,1]}} style={{overflow:"hidden"}}>
                  <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                  <div style={{minWidth:"420px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"50px 70px 70px 60px 1fr",gap:"8px",marginBottom:"8px",paddingTop:"8px",borderTop:"1px solid var(--border-soft)"}}>
                    {["Serie","Sug.","Peso","Reps","RPE"].map(h=><div key={h} style={{...ss.label,fontSize:"10px",marginBottom:0}}>{h}</div>)}
                  </div>
                  {Array.from({length:ex.sets}).map((_,si)=>(
                    <div key={si} style={{display:"grid",gridTemplateColumns:"50px 70px 70px 60px 1fr",gap:"8px",marginBottom:"8px",alignItems:"center"}}>
                      <span style={{fontSize:"11px",fontWeight:700,color:sportColor}}>S{si+1}</span>
                      <span style={{...ss.muted,fontSize:"11px"}}>{suggested||"—"}</span>
                      <input type="number" placeholder={suggested||"kg"} value={getLog(ex.name,si,"weight")} onChange={e=>logSet(ex.name,si,"weight",e.target.value)} onBlur={()=>persistSet(ex.name,si)} style={{...ss.input,padding:"5px 8px",fontSize:"12px"}}/>
                      <input type="number" placeholder="reps" value={getLog(ex.name,si,"reps")} onChange={e=>logSet(ex.name,si,"reps",e.target.value)} onBlur={()=>persistSet(ex.name,si)} style={{...ss.input,padding:"5px 8px",fontSize:"12px"}}/>
                      <div style={{display:"flex",gap:"2px"}}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                          <motion.div key={n} whileHover={{scale:1.2}} whileTap={{scale:0.9}} onClick={()=>{logSet(ex.name,si,"rpe",n);persistSet(ex.name,si,{rpe:n});}} style={{width:"18px",height:"18px",borderRadius:"4px",background:parseInt(getLog(ex.name,si,"rpe"))===n?rpeColor(n):"var(--bg-elev-2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",fontWeight:700,color:parseInt(getLog(ex.name,si,"rpe"))===n?"#fff":"var(--text-3)",border:`1px solid ${parseInt(getLog(ex.name,si,"rpe"))===n?rpeColor(n):"var(--border-soft)"}`}}>{n}</motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                  </div>
                  {vol>0&&<motion.div initial={{opacity:0}} animate={{opacity:1}} style={{marginTop:"10px",padding:"10px 14px",background:"var(--bg-elev-2)",borderRadius:"var(--r-md)",fontSize:"12px",color:"var(--text-2)"}}>Volumen serie: <strong style={{color:"var(--text-1)"}}>{vol.toLocaleString()} kg</strong>{est1RM>0&&<> · 1RM estimado: <strong style={{color:isRecord?"#F59E0B":"#3B82F6"}}>{est1RM} kg</strong></>}</motion.div>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      {!completedSession&&allDone&&(
        <motion.button whileHover={{scale:1.02,y:-2}} whileTap={{scale:0.98}} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} onClick={()=>{setCompletedSession(true);showToast("🎉 Sesión completada! Ranking actualizado","success");}} style={{...ss.btn,background:"linear-gradient(135deg,#22C55E,#16A34A)",color:"#fff",width:"100%",padding:"14px",fontSize:"14px",fontWeight:700,boxShadow:"0 8px 32px rgba(34,197,94,0.4)",marginBottom:"16px"}}>✅ Registrar sesión completada</motion.button>
      )}
      <RankingView tab={rankTab} setTab={setRankTab} sportColor={sportColor} players={players} clubId={clubId} compact/>
    </div>
  );
}

/* ── NominasClub — muestra la nómina REAL publicada por el entrenador
   (antes fabricaba una alineación al azar rotando el array de jugadores,
   sin relación con lo que el entrenador realmente publicó) ──────────── */
function NominasClub({ teamsToShow, forms, sport, sportColor, clubId, players, player, sp, PlantelBanner }) {
  const [lineups, setLineups] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) { setLoading(false); return; }
    setLoading(true);
    Promise.all(teamsToShow.map(t => getLineups(clubId, t.id).then(l => [t.id, l]).catch(() => [t.id, null])))
      .then(entries => { setLineups(Object.fromEntries(entries)); setLoading(false); });
  }, [clubId, teamsToShow.map(t=>t.id).join(",")]);

  if (loading) return <div style={{...ss.muted,padding:"20px",textAlign:"center"}}>Cargando nóminas...</div>;

  return (
    <div>
      <PlantelBanner/>
      <SectionTitle title="Nóminas del Club" sub={`Alineaciones publicadas por el entrenador · ${sp.name}`}/>
      {teamsToShow.map((t,ti)=>{
        const saved = lineups[t.id];
        const formation = forms.find(f=>f.key===saved?.formation) || forms[ti%forms.length];
        const size = formation.positions.length;
        const byId = id => players.find(p=>p.id===id) || null;
        const lineup = saved ? Array.from({length:size},(_,i)=>byId(saved.slots?.[i])) : Array(size).fill(null);
        const myIdx = lineup.findIndex(p=>p&&p.id===player.id);
        return (
          <motion.div key={t.id} {...fadeUp} transition={{duration:0.4,delay:ti*0.1}} style={{marginBottom:"20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",flexWrap:"wrap",gap:"8px"}}>
              <div style={{fontWeight:700,fontSize:"14px"}}>{t.name}</div>
              {saved && <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                <Badge color={sportColor}>{formation.label}</Badge>
                {myIdx>=0?<Badge color="#F59E0B" glow>⭐ Titular #{myIdx+1}</Badge>:<Badge color="#6B7896">No convocado</Badge>}
              </div>}
            </div>
            {saved
              ? <Cancha type={sport} formation={formation} lineup={lineup} sportColor={sportColor} dragging={false} highlightId={player.id} onDrop={()=>{}} onSlotClick={()=>{}}/>
              : <EmptyState icon="📋" title="Sin nómina publicada" desc="El entrenador todavía no publicó la alineación de este equipo." color={sportColor}/>}
          </motion.div>
        );
      })}
      <div style={{...ss.card,padding:"10px 14px",fontSize:"11px",color:"var(--text-2)"}}>⭐ Tu posición aparece resaltada en dorado cuando estás convocado en la nómina de un equipo.</div>
    </div>
  );
}

/* ── MiConvocatoria — antes decía "estás convocado" a TODOS los jugadores
   sin importar si de verdad estaban en alguna nómina publicada. Ahora
   revisa las nóminas reales guardadas por el entrenador. ─────────────── */
function MiConvocatoria({ camiseta, club, sport, players, sportColor, convocado, setConvocado, setWhatsappModal, showToast, clubId, playerId, PlantelBanner }) {
  const [llamado, setLlamado] = useState(null); // null = cargando, true/false
  const [misNomina, setMisNomina] = useState(null); // { team, starters, bench } de la nómina real donde aparezco

  useEffect(() => {
    if (!clubId) { setLlamado(true); return; } // demo/preview: mantener comportamiento anterior
    Promise.all(TEAMS.map(t => getLineups(clubId, t.id).then(l => ({ team: t, lineup: l })).catch(() => null)))
      .then(results => {
        const match = results.find(r => (r?.lineup?.slots || []).includes(playerId));
        setLlamado(!!match);
        if (match) {
          const forms = FORMATIONS[sport] || [];
          const formacion = forms.find(f => f.key === match.lineup.formation) || forms[0];
          const nombreDe = id => players.find(p => p.id === id)?.name || "Jugador";
          const starters = (match.lineup.slots || []).map((id, i) => id ? { name: nombreDe(id), pos: formacion?.positions?.[i] || "" } : null).filter(Boolean);
          const bench = (match.lineup.bench || []).map(id => ({ name: nombreDe(id) }));
          setMisNomina({ team: match.team, starters, bench });
        }
      });
  }, [clubId, playerId, sport, players]);

  if (llamado === null) return <div style={{...ss.muted,padding:"20px",textAlign:"center"}}>Revisando convocatoria...</div>;

  if (!llamado) return (
    <div>
      <PlantelBanner/>
      <SectionTitle title="Mi Convocatoria"/>
      <EmptyState icon="📋" title="No estás convocado por ahora" desc="El entrenador todavía no te incluyó en ninguna nómina publicada. Te avisaremos apenas te convoque." color={sportColor}/>
    </div>
  );

  return (
    <div>
      <PlantelBanner/>
      <SectionTitle title="Mi Convocatoria"/>
      <motion.div {...scaleIn} style={{...ss.card,textAlign:"center",marginBottom:"20px",border:`2px solid ${sportColor}55`,background:`linear-gradient(135deg,${sportColor}22,${sportColor}05)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:`linear-gradient(90deg,transparent,${sportColor},transparent)`}}/>
        <motion.div animate={{scale:[1,1.05,1]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}} style={{fontSize:"72px",fontWeight:900,color:sportColor,margin:"20px 0",filter:`drop-shadow(0 0 24px ${sportColor}88)`,letterSpacing:"-0.04em"}}>{camiseta}</motion.div>
        <div style={{fontSize:"16px",fontWeight:700,marginBottom:"4px"}}>Estás convocado #{camiseta}</div>
        <div style={ss.muted}>vs {club.next.rival} · {club.next.dia}</div>
      </motion.div>
      <div style={{display:"flex",gap:"12px",marginBottom:"16px"}}>
        <motion.button whileHover={{scale:1.02,y:-2}} whileTap={{scale:0.98}} onClick={()=>{setConvocado("confirmed");showToast("✅ Presencia confirmada","success");}} style={{...ss.btn,flex:1,background:convocado==="confirmed"?"linear-gradient(135deg,#22C55E,#16A34A)":"rgba(34,197,94,0.15)",color:convocado==="confirmed"?"#fff":"#22C55E",border:"1px solid #22C55E55",padding:"14px",fontSize:"13px",boxShadow:convocado==="confirmed"?"0 8px 24px rgba(34,197,94,0.35)":"none"}}>{convocado==="confirmed"?"✅ Confirmado":"✓ Confirmar presencia"}</motion.button>
        <motion.button whileHover={{scale:1.02,y:-2}} whileTap={{scale:0.98}} onClick={()=>{setConvocado("rejected");showToast("Ausencia registrada","warning");}} style={{...ss.btn,flex:1,background:convocado==="rejected"?"linear-gradient(135deg,#EF4444,#DC2626)":"rgba(239,68,68,0.15)",color:convocado==="rejected"?"#fff":"#EF4444",border:"1px solid #EF444455",padding:"14px",fontSize:"13px",boxShadow:convocado==="rejected"?"0 8px 24px rgba(239,68,68,0.35)":"none"}}>{convocado==="rejected"?"✕ No asistirás":"✕ No puedo asistir"}</motion.button>
      </div>
      <motion.button whileHover={{scale:1.02,y:-2}} whileTap={{scale:0.98}}
        onClick={()=>setWhatsappModal({ team:`${club.name}${misNomina?.team?` · ${misNomina.team.name}`:""}`, rival:club.next.rival, date:club.next.dia, hora:club.next.hora, lugar:club.next.lugar, starters:misNomina?.starters||[], bench:misNomina?.bench||[] })}
        style={{...ss.btn,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",width:"100%",padding:"12px",fontSize:"13px",boxShadow:"0 8px 24px rgba(37,211,102,0.35)"}}>📱 Compartir convocatoria en WhatsApp</motion.button>
    </div>
  );
}

/* ── Noticias — antes tenía un useState() llamado condicionalmente dentro
   de un if(module==="noticias"){...} en el cuerpo de JugadorView, violando
   las Rules of Hooks: React llama los hooks en orden en cada render, y acá
   solo se invocaba cuando module==="noticias" — al navegar entre módulos
   React detectaba un número distinto de hooks entre renders y tiraba abajo
   el árbol de React (pantalla congelada/en blanco). Ahora vive en su propio
   componente, como el resto de los módulos de esta vista. ──────────────── */
function Noticias({ partidos, club, sportColor }) {
  const [catFiltro, setCatFiltro] = useState("todos");
  const resultados = partidos.filter(p=>p.estado==="jugado");
  const cats = ["todos", ...new Set(resultados.map(r=>r.cat))];
  const feed = catFiltro==="todos" ? resultados : resultados.filter(r=>r.cat===catFiltro);
  const resColors = {victoria:"#22C55E", empate:"#F59E0B", derrota:"#EF4444"};
  const resIcons  = {victoria:"🏆", empate:"🤝", derrota:"💪"};

  return (
    <div>
      <SectionTitle title="Noticias & Resultados" sub={`${club.name} · Todos los equipos`}/>

      {/* Filtro por categoría */}
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"20px"}}>
        {cats.map(c=>(
          <motion.button key={c} whileTap={{scale:0.96}} onClick={()=>setCatFiltro(c)}
            style={{...ss.btn, fontSize:"11px", padding:"6px 14px", background:catFiltro===c?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)", color:catFiltro===c?sportColor:"var(--text-2)", border:`1px solid ${catFiltro===c?sportColor+"55":"var(--border-soft)"}`, boxShadow:catFiltro===c?`0 0 12px ${sportColor}22`:"none", fontWeight:catFiltro===c?700:400}}>
            {c==="todos" ? "📋 Todos" : c}
          </motion.button>
        ))}
      </div>

      {feed.length===0 && (
        <div style={{...ss.card, textAlign:"center", padding:"40px", color:"var(--text-3)"}}>
          Sin resultados para esta categoría aún.
        </div>
      )}

      {feed.map((r,i)=>(
        <motion.div key={r.id} {...fadeUp} transition={{delay:i*0.06}} style={{...ss.card, marginBottom:"14px", border:`1px solid ${resColors[r.resultado]}33`, background:`linear-gradient(135deg,${resColors[r.resultado]}06,transparent)`}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",flexWrap:"wrap",gap:"8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"38px",height:"38px",borderRadius:"50%",background:`${resColors[r.resultado]}18`,border:`1.5px solid ${resColors[r.resultado]}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>
                {resIcons[r.resultado]}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:"14px"}}>{club.name} vs {r.rival}</div>
                <div style={{...ss.muted,fontSize:"11px",marginTop:"2px"}}>{r.fecha} · {r.lugar}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
              <span style={{fontSize:"10px",padding:"2px 9px",borderRadius:"99px",background:`${sportColor}18`,color:sportColor,border:`1px solid ${sportColor}33`,fontWeight:600}}>{r.cat}</span>
              <span style={{fontSize:"10px",padding:"2px 9px",borderRadius:"99px",background:`${resColors[r.resultado]}18`,color:resColors[r.resultado],border:`1px solid ${resColors[r.resultado]}44`,fontWeight:700,textTransform:"uppercase"}}>{r.resultado}</span>
            </div>
          </div>

          {/* Marcador */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"16px",padding:"14px",borderRadius:"var(--r-md)",background:"var(--bg-elev-1)",marginBottom:"12px",border:"1px solid var(--border-soft)"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"11px",color:"var(--text-3)",marginBottom:"4px",fontWeight:600}}>LOCAL</div>
              <div style={{fontSize:"32px",fontWeight:900,color:r.lugar==="Local"?sportColor:"var(--text-1)",letterSpacing:"-0.03em"}}>{r.golesLocal}</div>
              <div style={{fontSize:"11px",fontWeight:600,marginTop:"2px",color:"var(--text-2)"}}>{r.lugar==="Local"?club.name:r.rival}</div>
            </div>
            <div style={{fontSize:"22px",color:"var(--text-3)",fontWeight:300}}>—</div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"11px",color:"var(--text-3)",marginBottom:"4px",fontWeight:600}}>VISITA</div>
              <div style={{fontSize:"32px",fontWeight:900,color:r.lugar==="Visita"?sportColor:"var(--text-1)",letterSpacing:"-0.03em"}}>{r.golesVisita}</div>
              <div style={{fontSize:"11px",fontWeight:600,marginTop:"2px",color:"var(--text-2)"}}>{r.lugar==="Visita"?club.name:r.rival}</div>
            </div>
          </div>

          {/* Resumen del entrenador */}
          <div style={{fontSize:"13px",color:"var(--text-2)",lineHeight:1.6,marginBottom:"10px"}}>"{r.resumen}"</div>
          <div style={{...ss.muted,fontSize:"11px",marginBottom:"10px"}}>— {r.autor} ({r.autorRol})</div>

          {/* Destacados */}
          {r.destacados?.length > 0 && (
            <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:"10px",color:"var(--text-3)"}}>⭐ Destacados:</span>
              {r.destacados.map(d=>(
                <span key={d} style={{fontSize:"11px",padding:"2px 9px",borderRadius:"99px",background:"rgba(245,158,11,0.12)",color:"#F59E0B",border:"1px solid rgba(245,158,11,0.3)",fontWeight:600}}>{d}</span>
              ))}
            </div>
          )}

          {/* Placeholder análisis IA — se activará cuando el coach suba el video */}
          {r.aiStatus === "procesando" && (
            <div style={{marginTop:"12px",padding:"10px 14px",borderRadius:"var(--r-sm)",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.25)",fontSize:"11px",color:"#C084FC",display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</span> Agente IA analizando el video del partido...
            </div>
          )}
          {r.aiStatus === "listo" && r.aiAnalysis && (
            <div style={{marginTop:"12px",padding:"10px 14px",borderRadius:"var(--r-sm)",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.3)"}}>
              <div style={{fontSize:"11px",color:"#C084FC",fontWeight:700,marginBottom:"6px"}}>⚡ Análisis IA</div>
              <div style={{fontSize:"12px",color:"var(--text-2)"}}>{r.aiAnalysis}</div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── JugadorView ────────────────────────────────────────────── */
export default function JugadorView({module, sport, sp, club, player, players, sportColor, countryData, convocado, setConvocado, setWhatsappModal, showToast, rankTab, setRankTab, payments, setPayments, addPayment=null, declarePayment=null, userCats=[], isDemo=true, partidos=[], clubId=null}) {
  const camiseta = player.number;
  const { posts: realPosts } = usePosts(clubId);
  const postColors = {"resultado":"#22C55E","médico":"#3B82F6","admin":"#F59E0B","advertencia":"#EF4444"};

  // Notificaciones del club
  const [notifs, setNotifs] = useState([]);
  const [notifsVistas, setNotifsVistas] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sportos_notifs_vistas") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    if (!clubId) return;
    getNotifications(clubId, 10).then(rows => setNotifs(rows || [])).catch(() => {});
  }, [clubId]);
  const marcarVistas = () => {
    const ids = notifs.map(n => n.id);
    setNotifsVistas(ids);
    localStorage.setItem("sportos_notifs_vistas", JSON.stringify(ids));
  };
  const notifsNuevas = notifs.filter(n => !notifsVistas.includes(n.id));

  // El plantel del jugador es su primera categoría asignada (solo una)
  const miPlantel = isDemo ? null : (userCats[0] || null);
  // Filtra compañeros de su mismo plantel
  const visiblePlayers = miPlantel ? players.filter(p=>p.category===miPlantel) : players;

  const PlantelBanner = () => miPlantel ? (
    <motion.div {...fadeUp} style={{...ss.card, marginBottom:"14px", padding:"10px 14px", background:"linear-gradient(135deg,rgba(34,197,94,0.08),transparent)", border:"1px solid rgba(34,197,94,0.2)", display:"flex", alignItems:"center", gap:"8px"}}>
      <span style={{fontSize:"11px",color:"var(--text-2)"}}>👤 Tu plantel:</span>
      <span style={{fontSize:"11px",padding:"2px 10px",borderRadius:"99px",background:"rgba(34,197,94,0.12)",color:"#4ADE80",border:"1px solid rgba(34,197,94,0.25)",fontWeight:600}}>{miPlantel}</span>
    </motion.div>
  ) : null;

  if(module==="midashboard") {
    const hoy = new Date().toISOString().split("T")[0];
    const resColors = {victoria:"#22C55E", empate:"#F59E0B", derrota:"#EF4444"};
    const resIcons  = {victoria:"🏆", empate:"🤝", derrota:"💪"};

    // Filtra partidos por el plantel del jugador (en modo real)
    const misPartidos = miPlantel
      ? partidos.filter(p=>p.cat===miPlantel)
      : partidos;

    // Próximo partido: el más cercano en el futuro (o hoy)
    const proximoPartido = misPartidos
      .filter(p=>p.estado==="programado" && p.fecha>=hoy)
      .sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.hora.localeCompare(b.hora))[0] || null;

    // Último resultado jugado
    const ultimoRes = misPartidos
      .filter(p=>p.estado==="jugado")
      .sort((a,b)=>b.fecha.localeCompare(a.fecha))[0] || null;

    // Feed cronológico: mezcla resultados + noticias del club
    const feedItems = [
      ...misPartidos.filter(p=>p.estado==="jugado").map(r=>({...r, _tipo:"resultado", _fecha:r.fecha})),
      ...realPosts.map(p=>({...p, _tipo:"noticia", _fecha:p.created_at||"2025-06-08"})),
    ].sort((a,b)=> new Date(b._fecha) - new Date(a._fecha));

    return (
      <div>
        {/* ── Notificaciones del club ── */}
        {notifs.length > 0 && (
          <motion.div {...fadeUp} style={{...ss.card, marginBottom:"14px", padding:"12px 14px", border:`1px solid ${notifsNuevas.length>0?"#3B82F655":"var(--border-soft)"}`, background: notifsNuevas.length>0?"linear-gradient(135deg,rgba(59,130,246,0.08),transparent)":"var(--bg-glass)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom: notifs.length>0?"10px":"0"}}>
              <div style={{fontSize:"12px",fontWeight:700,display:"flex",alignItems:"center",gap:"6px"}}>
                🔔 Notificaciones del club
                {notifsNuevas.length > 0 && <Badge color="#3B82F6" glow>{notifsNuevas.length} nuevas</Badge>}
              </div>
              {notifsNuevas.length > 0 && (
                <motion.button whileTap={{scale:0.95}} onClick={marcarVistas}
                  style={{...ss.btn,background:"transparent",color:"var(--text-3)",fontSize:"10px",padding:"3px 8px",border:"1px solid var(--border-soft)"}}>
                  Marcar vistas
                </motion.button>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {notifs.slice(0,4).map(n => {
                const esNueva = !notifsVistas.includes(n.id);
                const iconos = {nomina:"📋",resultado:"🏆",wellness:"💪",general:"📣"};
                return (
                  <div key={n.id} style={{display:"flex",alignItems:"flex-start",gap:"8px",padding:"8px 10px",borderRadius:"var(--r-sm)",background:esNueva?"rgba(59,130,246,0.08)":"transparent",border:esNueva?"1px solid rgba(59,130,246,0.2)":"1px solid transparent"}}>
                    <span style={{fontSize:"16px",flexShrink:0}}>{iconos[n.type]||"📣"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"12px",fontWeight:esNueva?700:500,color:esNueva?"var(--text-1)":"var(--text-2)"}}>{n.title}</div>
                      {n.body && <div style={{fontSize:"11px",color:"var(--text-3)",marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.body}</div>}
                    </div>
                    {esNueva && <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#3B82F6",boxShadow:"0 0 8px #3B82F6",flexShrink:0,marginTop:"3px"}}/>}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Cabecera jugador ── */}
        <motion.div {...fadeUp} style={{...ss.card, marginBottom:"16px", border:`1px solid ${sportColor}33`, background:`linear-gradient(135deg,${sportColor}12,${sportColor}03)`, display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px"}}>
          <motion.div whileHover={{rotate:8,scale:1.05}} style={{width:"52px",height:"52px",borderRadius:"50%",background:`linear-gradient(135deg,${sportColor}44,${sportColor}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px",fontWeight:900,color:sportColor,border:`2.5px solid ${sportColor}77`,boxShadow:`0 0 20px ${sportColor}44`,flexShrink:0}}>{player.number}</motion.div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"17px",fontWeight:800,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name}</div>
            <div style={{color:sportColor,fontSize:"12px",fontWeight:500,marginTop:"2px"}}>{player.position} · {club.name}</div>
          </div>
          <div style={{display:"flex",gap:"8px",flexShrink:0}}>
            <div style={{textAlign:"center",padding:"6px 12px",borderRadius:"var(--r-sm)",background:"var(--bg-elev-1)",border:"1px solid var(--border-soft)"}}>
              <Semaforo status={player.med_status}/>
              <div style={{fontSize:"9px",color:"var(--text-3)",marginTop:"4px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Salud</div>
            </div>
            <div style={{textAlign:"center",padding:"6px 12px",borderRadius:"var(--r-sm)",background:player.cuota_status==="ok"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${player.cuota_status==="ok"?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`}}>
              <div style={{fontSize:"16px",fontWeight:800,color:player.cuota_status==="ok"?"#22C55E":"#EF4444"}}>{player.cuota_status==="ok"?"✓":"!"}</div>
              <div style={{fontSize:"9px",color:"var(--text-3)",marginTop:"2px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Cuota</div>
            </div>
          </div>
        </motion.div>

        {/* ── Próximo partido — PROTAGONISTA ── */}
        {proximoPartido ? (
          <motion.div {...fadeUp} transition={{delay:0.05}} style={{...ss.card, marginBottom:"16px", border:`2px solid ${sportColor}55`, background:`linear-gradient(135deg,${sportColor}18,${sportColor}05)`, overflow:"hidden", position:"relative"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:`linear-gradient(90deg,transparent,${sportColor},transparent)`}}/>
            <div style={{fontSize:"10px",color:sportColor,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:"12px",display:"flex",alignItems:"center",gap:"6px"}}>
              <span style={{width:"6px",height:"6px",borderRadius:"50%",background:sportColor,boxShadow:`0 0 8px ${sportColor}`,display:"inline-block"}}/>
              Próximo partido · {proximoPartido.cat} Eq.{proximoPartido.equipo}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
              <div>
                <div style={{fontSize:"22px",fontWeight:900,letterSpacing:"-0.02em",marginBottom:"4px"}}>
                  {club.name} <span style={{color:"var(--text-3)",fontWeight:300,fontSize:"18px"}}>vs</span> {proximoPartido.rival}
                </div>
                <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{...ss.muted,fontSize:"12px"}}>📅 {proximoPartido.fecha}</span>
                  <span style={{...ss.muted,fontSize:"12px"}}>🕐 {proximoPartido.hora}</span>
                  <span style={{fontSize:"11px",padding:"2px 9px",borderRadius:"99px",background:`${sportColor}22`,color:sportColor,border:`1px solid ${sportColor}44`,fontWeight:600}}>{proximoPartido.lugar}</span>
                </div>
              </div>
              <motion.div animate={{scale:[1,1.04,1]}} transition={{duration:2.5,repeat:Infinity,ease:"easeInOut"}}
                style={{fontSize:"42px",fontWeight:900,color:sportColor,letterSpacing:"-0.04em",filter:`drop-shadow(0 0 16px ${sportColor}88)`}}>
                #{camiseta}
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div {...fadeUp} transition={{delay:0.05}} style={{...ss.card, marginBottom:"16px", border:"1px solid var(--border-soft)", padding:"16px", textAlign:"center", color:"var(--text-3)", fontSize:"13px"}}>
            📅 Sin partidos programados próximamente
          </motion.div>
        )}

        {/* ── Último resultado — PROTAGONISTA ── */}
        {ultimoRes && (
          <motion.div {...fadeUp} transition={{delay:0.1}} style={{...ss.card, marginBottom:"16px", border:`2px solid ${resColors[ultimoRes.resultado]}44`, background:`linear-gradient(135deg,${resColors[ultimoRes.resultado]}10,${resColors[ultimoRes.resultado]}03)`, overflow:"hidden", position:"relative"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:`linear-gradient(90deg,transparent,${resColors[ultimoRes.resultado]},transparent)`}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}}>
              <div>
                <div style={{fontSize:"10px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:"4px"}}>Último resultado · {ultimoRes.cat}</div>
                <div style={{fontSize:"16px",fontWeight:800}}>{club.name} vs {ultimoRes.rival}</div>
                <div style={{...ss.muted,fontSize:"11px",marginTop:"2px"}}>{ultimoRes.fecha} · {ultimoRes.lugar}</div>
              </div>
              <span style={{fontSize:"11px",padding:"4px 12px",borderRadius:"99px",background:`${resColors[ultimoRes.resultado]}20`,color:resColors[ultimoRes.resultado],border:`1.5px solid ${resColors[ultimoRes.resultado]}55`,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                {resIcons[ultimoRes.resultado]} {ultimoRes.resultado}
              </span>
            </div>

            {/* Marcador grande */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"20px",padding:"18px 0",borderTop:"1px solid var(--border-soft)",borderBottom:"1px solid var(--border-soft)",marginBottom:"12px"}}>
              <div style={{textAlign:"center",flex:1}}>
                <div style={{fontSize:"11px",color:"var(--text-3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{ultimoRes.lugar==="Local"?club.name:ultimoRes.rival}</div>
                <div style={{fontSize:"52px",fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,color:ultimoRes.lugar==="Local"?resColors[ultimoRes.resultado]:"var(--text-1)"}}>{ultimoRes.golesLocal}</div>
              </div>
              <div style={{fontSize:"20px",color:"var(--text-3)",fontWeight:300,flexShrink:0}}>:</div>
              <div style={{textAlign:"center",flex:1}}>
                <div style={{fontSize:"11px",color:"var(--text-3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{ultimoRes.lugar==="Visita"?club.name:ultimoRes.rival}</div>
                <div style={{fontSize:"52px",fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,color:ultimoRes.lugar==="Visita"?resColors[ultimoRes.resultado]:"var(--text-1)"}}>{ultimoRes.golesVisita}</div>
              </div>
            </div>

            <p style={{margin:"0 0 8px",fontSize:"13px",color:"var(--text-2)",lineHeight:1.6,fontStyle:"italic"}}>"{ultimoRes.resumen}"</p>
            <div style={{...ss.muted,fontSize:"11px"}}>— {ultimoRes.autor}</div>
            {ultimoRes.destacados?.length>0 && (
              <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap",marginTop:"10px"}}>
                <span style={{fontSize:"10px",color:"var(--text-3)"}}>⭐</span>
                {ultimoRes.destacados.map(d=><span key={d} style={{fontSize:"11px",padding:"2px 9px",borderRadius:"99px",background:"rgba(245,158,11,0.12)",color:"#F59E0B",border:"1px solid rgba(245,158,11,0.3)",fontWeight:600}}>{d}</span>)}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Feed cronológico: resultados + noticias mezclados ── */}
        <div style={{fontSize:"10px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:"10px",paddingLeft:"4px"}}>Actividad del club</div>

        {feedItems.slice(0,8).map((item,i)=>{
          if(item._tipo==="resultado") return (
            <motion.div key={`r-${item.id}`} {...fadeUp} transition={{delay:i*0.04}} style={{...ss.card, marginBottom:"10px", display:"flex", alignItems:"center", gap:"12px", padding:"12px 14px", border:`1px solid ${resColors[item.resultado]}22`}}>
              <div style={{width:"42px",height:"42px",borderRadius:"var(--r-sm)",background:`${resColors[item.resultado]}15`,border:`1.5px solid ${resColors[item.resultado]}33`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <div style={{fontSize:"15px",fontWeight:900,color:resColors[item.resultado],lineHeight:1}}>{item.golesLocal}:{item.golesVisita}</div>
                <div style={{fontSize:"8px",color:resColors[item.resultado],fontWeight:700,textTransform:"uppercase",marginTop:"1px"}}>{item.resultado.slice(0,3)}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>vs {item.rival}</div>
                <div style={{display:"flex",gap:"8px",marginTop:"3px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"10px",color:"var(--text-3)"}}>{item.fecha}</span>
                  <span style={{fontSize:"10px",padding:"1px 7px",borderRadius:"99px",background:`${sportColor}12`,color:sportColor,border:`1px solid ${sportColor}22`,fontWeight:600}}>{item.cat}</span>
                </div>
              </div>
              {item.destacados?.includes(player.name) && (
                <span style={{fontSize:"18px",flexShrink:0}} title="Fuiste destacado">⭐</span>
              )}
            </motion.div>
          );
          return (
            <motion.div key={`n-${item.id}`} {...fadeUp} transition={{delay:i*0.04}} style={{...ss.card, marginBottom:"10px", padding:"12px 14px", borderLeft:`3px solid ${postColors[item.type]||"#6B7280"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  <Badge color={postColors[item.type]}>{item.type}</Badge>
                  <span style={{fontSize:"12px",fontWeight:600}}>{item.author}</span>
                </div>
                <span style={{...ss.muted,fontSize:"10px"}}>{item.time}</span>
              </div>
              <p style={{margin:0,fontSize:"12px",color:"var(--text-2)",lineHeight:1.5}}>{item.text}</p>
            </motion.div>
          );
        })}
      </div>
    );
  }

  if(module==="noticias") return <Noticias partidos={partidos} club={club} sportColor={sportColor}/>;

  if(module==="micuota") return <MiCuota player={player} club={club} countryData={countryData} sportColor={sportColor} showToast={showToast} payments={payments} setPayments={setPayments} addPayment={addPayment} declarePayment={declarePayment} clubId={clubId} isDemo={isDemo}/>;

  if(module==="migym") return <GymJugador player={player} sportColor={sportColor} showToast={showToast} rankTab={rankTab} setRankTab={setRankTab} players={players} clubId={clubId}/>;

  if(module==="nominasclub") {
    const forms = FORMATIONS[sport];
    const teamsToShow = miPlantel ? TEAMS.filter(t=>t.name===miPlantel) : TEAMS;
    return <NominasClub teamsToShow={teamsToShow} forms={forms} sport={sport} sportColor={sportColor} clubId={clubId} players={players} player={player} sp={sp} PlantelBanner={PlantelBanner}/>;
  }

  if(module==="miconvocatoria") return (
    <MiConvocatoria camiseta={camiseta} club={club} sport={sport} players={players} sportColor={sportColor} convocado={convocado} setConvocado={setConvocado}
      setWhatsappModal={setWhatsappModal} showToast={showToast} clubId={clubId} playerId={player.id} PlantelBanner={PlantelBanner}/>
  );

  return null;
}
