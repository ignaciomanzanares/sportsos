import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { supabase } from "../lib/supabase";

// ── Componentes base del Home ─────────────────────────────────────────────

function HeroStat({ icon, value, label, sub, color, onClick }) {
  return (
    <motion.div {...fadeUp} whileHover={onClick?{y:-3,scale:1.02}:{}} onClick={onClick}
      style={{...ss.card, padding:"24px", border:`1px solid ${color}33`, background:`linear-gradient(135deg,${color}10,${color}04)`,
        cursor:onClick?"pointer":"default", gridColumn:"span 1"}}>
      <div style={{fontSize:"28px", marginBottom:"10px"}}>{icon}</div>
      <div style={{fontSize:"36px", fontWeight:900, color, letterSpacing:"-0.03em", lineHeight:1}}>{value}</div>
      <div style={{fontWeight:700, fontSize:"13px", marginTop:"6px", color:"var(--text-1)"}}>{label}</div>
      {sub && <div style={{fontSize:"11px", color:"var(--text-3)", marginTop:"3px"}}>{sub}</div>}
    </motion.div>
  );
}

function QuickAction({ icon, label, color, onClick }) {
  return (
    <motion.button whileHover={{y:-2, scale:1.04}} whileTap={{scale:0.96}} onClick={onClick}
      style={{...ss.btn, flexDirection:"column", gap:"6px", padding:"16px 12px",
        background:`${color}10`, border:`1px solid ${color}33`, color,
        borderRadius:"var(--r-lg)", flex:1, minWidth:"80px", fontSize:"11px", fontWeight:700}}>
      <span style={{fontSize:"22px"}}>{icon}</span>
      {label}
    </motion.button>
  );
}

function MiniCard({ title, children, delay=0 }) {
  return (
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay, duration:0.4}}
      style={{...ss.card, padding:"18px"}}>
      <div style={{fontWeight:700, fontSize:"12px", color:"var(--text-3)", textTransform:"uppercase",
        letterSpacing:"0.07em", marginBottom:"14px"}}>{title}</div>
      {children}
    </motion.div>
  );
}

function NextMatchCard({ club, sp, sportColor, onNavigate }) {
  const res = club?.prev;
  const next = club?.next;
  return (
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.05}}
      style={{...ss.card, padding:"0", overflow:"hidden", border:`1px solid ${sportColor}33`,
        background:`linear-gradient(135deg,${sportColor}08,transparent)`}}>
      {/* Banda superior */}
      <div style={{background:`linear-gradient(90deg,${sportColor}22,${sportColor}08)`,
        padding:"10px 18px", display:"flex", alignItems:"center", gap:"10px",
        borderBottom:"1px solid var(--border-soft)"}}>
        <span style={{fontSize:"18px"}}>{sp.icon}</span>
        <span style={{fontWeight:700, fontSize:"12px", color:sportColor}}>Próximo partido</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:"10px", color:"var(--text-3)"}}>{sp.name}</span>
      </div>
      <div style={{padding:"18px", display:"flex", gap:"20px", alignItems:"center", flexWrap:"wrap"}}>
        <div style={{flex:1, minWidth:"120px"}}>
          <div style={{fontSize:"11px", color:"var(--text-3)", marginBottom:"4px"}}>Rival</div>
          <div style={{fontWeight:800, fontSize:"18px"}}>{next?.rival || "Por definir"}</div>
          <div style={{fontSize:"11px", color:"var(--text-3)", marginTop:"4px"}}>
            📅 {next?.dia || "—"} · 📍 Local
          </div>
        </div>
        {res && (
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"10px", color:"var(--text-3)", marginBottom:"4px"}}>Último resultado</div>
            <div style={{fontWeight:800, fontSize:"14px",
              color:res.res==="Victoria"?"#1FA04A":res.res==="Derrota"?"#C0392B":"#C98408"}}>
              {res.res} {res.score}
            </div>
            <div style={{fontSize:"10px", color:"var(--text-3)"}}>vs {res.rival}</div>
          </div>
        )}
        <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
          onClick={()=>onNavigate("matchcenter")}
          style={{...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,
            color:"#fff", fontSize:"11px", padding:"8px 16px", fontWeight:700,
            boxShadow:`0 4px 14px ${sportColor}44`}}>
          Ver Match Center →
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── HOME POR ROL ──────────────────────────────────────────────────────────

const BEBAS = "'Bebas Neue', sans-serif";
const DM_MONO = "'DM Mono', monospace";

// Mapea posición larga a abreviatura de 3 letras
function posAbbr(pos) {
  // pos="" como default solo cubre undefined, no null — y position es
  // null de verdad para jugadores reales sin posición cargada (crasheaba
  // toda la pantalla con "Cannot read properties of null").
  const p = (pos || "").toLowerCase();
  if (p.includes("portero") || p.includes("arquero") || p.includes("goalkeeper")) return "POR";
  if (p.includes("delantero") || p.includes("ala") || p.includes("forward") || p.includes("fullback") || p.includes("tries")) return "DEL";
  if (p.includes("medio") || p.includes("apertura") || p.includes("scrum") || p.includes("centro") || p.includes("half")) return "MED";
  if (p.includes("defensa") || p.includes("flanker") || p.includes("lock") || p.includes("prop") || p.includes("hooker") || p.includes("número")) return "DEF";
  return "MED";
}

function HomeAdmin({ players, sportColor, club, sp, countryData, payments, partidos, onNavigate }) {
  const [posFilter, setPosFilter] = useState("TODOS");

  const pagados    = payments.filter(p=>p.estado==="pagado").length;
  const totalJugs  = players.length;
  const victorias  = partidos.filter(p=>p.resultado==="victoria").length;
  const totalGoles = players.reduce((s,p)=>s+(p.stats?.goles||0),0);
  const balanceMes = payments.filter(p=>p.estado==="pagado").length * 15000;

  // Próximos partidos
  const proximos = partidos.filter(p=>p.estado==="programado").slice(0,4);

  // Actividad reciente (mock basado en posts/datos reales)
  const activity = [
    { dot: sportColor,  text: `${players[0]?.name||"Jugador"} marcó hat-trick en entrenamiento`, time: "Hace 2h" },
    { dot: "#818cf8",   text: "Cuotas del mes procesadas correctamente", time: "Hace 5h" },
    { dot: "#fbbf24",   text: `${players.filter(p=>p.cuota_status==="vencida").length} jugadores con cuota vencida`, time: "Ayer 14:30" },
    { dot: "#f87171",   text: players.find(p=>p.med_status==="rojo") ? `${players.find(p=>p.med_status==="rojo").name} en protocolo médico` : "Sin alertas médicas", time: "Ayer 09:00" },
    { dot: "#5a5753",   text: "Convocatoria para próximo partido publicada", time: "Hace 2d" },
  ];

  // Tabla de jugadores con filtro de posición
  const allFilters = ["TODOS", ...Array.from(new Set(players.map(p=>posAbbr(p.position))))];
  const filtered = posFilter === "TODOS" ? players : players.filter(p=>posAbbr(p.position)===posFilter);

  // Rating basado en gym.pct o stats
  const perf = (p) => {
    const pct = p.gym?.pct ?? 70;
    return ((pct / 100) * 5 + 5).toFixed(1); // escala 5–10
  };
  const perfColor = (v) => parseFloat(v) >= 8 ? sportColor : "#fbbf24";

  const avatarColors = ["#4f46e5","#0284c7","#b45309","#be185d","#047857","#7c3aed","#c2410c","#0f766e"];

  const CARD = { background:"#121110", border:"1px solid #1e1c19", borderRadius:"8px", padding:"18px" };

  const kpi = [
    { label:"Jugadores activos",  value: totalJugs,  change: "+2 este mes",      changeColor: sportColor, onClick: ()=>onNavigate("jugadores") },
    { label:"Partidos ganados",   value: victorias,  change: `${partidos.filter(p=>p.estado==="jugado").length} jugados`, changeColor:"#a8a49f", onClick: ()=>onNavigate("matchcenter") },
    { label:"Goles marcados",     value: totalGoles, change: "Temporada actual",  changeColor:"#a8a49f", onClick: ()=>onNavigate("estadisticas") },
    { label:"Cuotas pagadas",     value: `${pagados}/${totalJugs}`, change: `${Math.round(pagados/(totalJugs||1)*100)}% al día`, changeColor: sportColor, onClick: ()=>onNavigate("finanzas") },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

      {/* KPI CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px"}}>
        {kpi.map((card,i)=>(
          <motion.div key={i} whileHover={{background:"#161412"}} onClick={card.onClick}
            style={{...CARD, cursor:"pointer", transition:"background 0.15s"}}>
            <div style={{fontSize:"11px",fontWeight:500,color:"#4a4743",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"10px"}}>{card.label}</div>
            <div style={{fontFamily:BEBAS,fontSize:"38px",color:"#f0ede8",lineHeight:1,letterSpacing:"-0.02em"}}>{card.value}</div>
            <div style={{marginTop:"8px",fontSize:"11.5px",color:card.changeColor}}>{card.change}</div>
          </motion.div>
        ))}
      </div>

      {/* PARTIDOS + ACTIVIDAD */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:"10px"}}>

        {/* Próximos partidos */}
        <div style={CARD}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:"14px"}}>
            <div style={{fontFamily:BEBAS,fontSize:"14px",color:"#f0ede8",textTransform:"uppercase",letterSpacing:"0.04em"}}>Próximos Partidos</div>
            <button onClick={()=>onNavigate("matchcenter")} style={{fontSize:"11.5px",fontWeight:500,color:sportColor,background:"none",border:"none",cursor:"pointer",padding:0}}>ver todos →</button>
          </div>
          {proximos.length === 0 ? (
            <div style={{fontSize:"12px",color:"#4a4743",padding:"12px 0"}}>No hay partidos programados.</div>
          ) : proximos.map((m,i)=>(
            <motion.div key={m.id||i} whileHover={{background:"#161412"}}
              style={{display:"flex",alignItems:"center",gap:"14px",padding:"10px 11px",borderRadius:"6px",cursor:"pointer",transition:"background 0.12s"}}>
              <div style={{fontFamily:DM_MONO,fontSize:"12px",color:"#4a4743",flexShrink:0,width:"56px"}}>{m.fecha?.slice(5).replace("-","/")||"—"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"13px",fontWeight:500,color:"#d4d2ce",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.rival}</div>
                <div style={{fontSize:"11px",color:"#4a4743",marginTop:"1px"}}>{m.lugar} · {m.hora||"—"}</div>
              </div>
              <div style={{fontFamily:DM_MONO,fontSize:"10.5px",fontWeight:500,color:m.cat?.includes("Primer")?"#818cf8":"#5a5753",flexShrink:0}}>
                {m.cat?.includes("Primer")?"LIGA":"AMIST."}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actividad */}
        <div style={CARD}>
          <div style={{fontFamily:BEBAS,fontSize:"14px",color:"#f0ede8",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"14px"}}>Actividad</div>
          {activity.map((act,i)=>(
            <div key={i} style={{display:"flex",gap:"10px",padding:"9px 0",borderBottom:"1px solid #1a1816"}}>
              <div style={{width:"5px",height:"5px",borderRadius:"50%",background:act.dot,marginTop:"6px",flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"12px",color:"#b0ada8",lineHeight:1.45}}>{act.text}</div>
                <div style={{fontFamily:DM_MONO,fontSize:"10.5px",color:"#3e3b37",marginTop:"3px"}}>{act.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TABLA PLANTEL */}
      <div style={CARD}>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:"14px"}}>
          <div>
            <span style={{fontFamily:BEBAS,fontSize:"14px",color:"#f0ede8",textTransform:"uppercase",letterSpacing:"0.04em"}}>Plantel</span>
            <span style={{fontSize:"11.5px",color:"#4a4743",marginLeft:"10px"}}>{players.length} jugadores</span>
          </div>
          <div style={{display:"flex",gap:"4px"}}>
            {allFilters.map(f=>(
              <button key={f} onClick={()=>setPosFilter(f)}
                style={{fontFamily:DM_MONO,fontSize:"11.5px",fontWeight:500,padding:"4px 10px",borderRadius:"4px",cursor:"pointer",
                  border:`1px solid ${posFilter===f?sportColor:"#1e1c19"}`,
                  background:posFilter===f?sportColor:"transparent",
                  color:posFilter===f?"#0b0a09":"#5a5753",
                  transition:"all 0.12s"}}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:"500px"}}>
            <thead>
              <tr style={{borderBottom:"1px solid #1e1c19"}}>
                {["#","Jugador","Pos","PJ","Goles","Asist.","Estado","Rating"].map((h,i)=>(
                  <th key={h} style={{textAlign:i>3?"right":i===6?"center":"left",padding:"6px 10px",fontSize:"10px",fontWeight:500,color:"#3e3b37",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p,i)=>{
                const rating = perf(p);
                const pc = perfColor(rating);
                const initials = p.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                const statusColor = p.med_status==="rojo"?"#f87171":p.med_status==="amarillo"?"#fbbf24":sportColor;
                const statusLabel = p.med_status==="rojo"?"Lesionado":p.med_status==="amarillo"?"Alerta":"Disponible";
                const bgColor = avatarColors[i % avatarColors.length];
                return (
                  <tr key={p.id} style={{cursor:"pointer"}}
                    onMouseEnter={e=>{Array.from(e.currentTarget.cells).forEach(c=>c.style.background="#161412");}}
                    onMouseLeave={e=>{Array.from(e.currentTarget.cells).forEach(c=>c.style.background="");}}
                  >
                    <td style={{padding:"10px",fontFamily:DM_MONO,fontSize:"11.5px",color:"#3e3b37",borderBottom:"1px solid #1a1816"}}>{p.number}</td>
                    <td style={{padding:"10px",borderBottom:"1px solid #1a1816"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
                        <div style={{width:"28px",height:"28px",borderRadius:"50%",background:bgColor,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:BEBAS,fontSize:"11px",color:"#fff",flexShrink:0}}>{initials}</div>
                        <div>
                          <div style={{fontSize:"13px",fontWeight:500,color:"#d4d2ce"}}>{p.name}</div>
                          <div style={{fontSize:"10.5px",color:"#3e3b37"}}>{p.category||"—"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"10px",borderBottom:"1px solid #1a1816",fontFamily:DM_MONO,fontSize:"11.5px",fontWeight:500,color:"#a8a49f"}}>{posAbbr(p.position)}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:DM_MONO,fontSize:"13px",color:"#b0ada8",borderBottom:"1px solid #1a1816"}}>{Math.round((p.stats?.minutos||0)/90)}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:BEBAS,fontSize:"15px",fontWeight:700,color:sportColor,borderBottom:"1px solid #1a1816"}}>{p.stats?.goles||0}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:DM_MONO,fontSize:"13px",color:"#b0ada8",borderBottom:"1px solid #1a1816"}}>{p.stats?.asistencias||0}</td>
                    <td style={{padding:"10px",textAlign:"center",borderBottom:"1px solid #1a1816"}}>
                      <span style={{fontSize:"10.5px",fontWeight:500,color:statusColor}}>{statusLabel}</span>
                    </td>
                    <td style={{padding:"10px",textAlign:"right",borderBottom:"1px solid #1a1816"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"7px"}}>
                        <div style={{width:"48px",height:"3px",borderRadius:"2px",background:"#1e1c19",overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:"2px",width:`${parseFloat(rating)*10}%`,background:pc}}/>
                        </div>
                        <span style={{fontFamily:DM_MONO,fontSize:"12px",fontWeight:500,color:pc,width:"28px",textAlign:"right"}}>{rating}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Gráfico de barras simple para tendencia de asistencia
function TrendBar({ data, color }) {
  const max = Math.max(...data.map(d=>d.pct), 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:"8px",height:"60px"}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}}>
          <div style={{fontSize:"9px",color:"var(--text-3)",fontWeight:700}}>{d.pct}%</div>
          <motion.div
            initial={{height:0}} animate={{height:`${(d.pct/max)*44}px`}}
            transition={{duration:0.6,delay:i*0.08}}
            style={{width:"100%",borderRadius:"4px 4px 2px 2px",
              background:d.pct>=75?color:d.pct>=50?"#C98408":"#C0392B",
              minHeight:"4px"}}/>
          <div style={{fontSize:"9px",color:"var(--text-3)",whiteSpace:"nowrap"}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function HomeEntrenador({ players, sportColor, club, sp, partidos, onNavigate, clubId=null }) {
  const hoy       = new Date().toISOString().split("T")[0];
  const ultimoRes = partidos.find(p=>p.estado==="jugado");
  const presentes = Math.floor(players.length * 0.78);

  // Tendencia de asistencia — últimas 4 semanas desde Supabase
  const [trendData, setTrendData] = useState([
    { label:"Sem 1", pct: 65 },
    { label:"Sem 2", pct: 72 },
    { label:"Sem 3", pct: 80 },
    { label:"Hoy",   pct: players.length > 0 ? Math.round(presentes/players.length*100) : 78 },
  ]);

  useEffect(() => {
    if (!clubId || players.length === 0) return;
    const lunes = (offsetWeeks) => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay() + 1 - offsetWeeks * 7);
      return d.toISOString().split("T")[0];
    };
    const semanas = [
      { label:"Sem 1", desde: lunes(3), hasta: lunes(2) },
      { label:"Sem 2", desde: lunes(2), hasta: lunes(1) },
      { label:"Sem 3", desde: lunes(1), hasta: lunes(0) },
      { label:"Hoy",   desde: lunes(0), hasta: new Date(Date.now()+86400000).toISOString().split("T")[0] },
    ];
    Promise.all(semanas.map(s =>
      supabase.from("attendance")
        .select("present", { count: "estimated" })
        .eq("club_id", clubId)
        .gte("date", s.desde)
        .lt("date", s.hasta)
        .eq("present", true)
    )).then(results => {
      const nuevoTrend = results.map((res, i) => {
        const count = res.count ?? (res.data?.length ?? 0);
        const pct = players.length > 0 ? Math.round((count / players.length) * 100) : semanas[i].pct || 0;
        return { label: semanas[i].label, pct: Math.min(pct, 100) };
      });
      const hayDatos = nuevoTrend.some(t => t.pct > 0);
      if (hayDatos) setTrendData(nuevoTrend);
    });
  }, [clubId, players.length]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      {/* Próximo partido — hero */}
      <NextMatchCard club={club} sp={sp} sportColor={sportColor} onNavigate={onNavigate}/>

      {/* Stats */}
      <div className="stats-hero-4" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px"}}>
        <HeroStat icon="✅" value={`${presentes}/${players.length}`} label="Asistencia hoy"
          sub="Presentes en entrenamiento" color="#1FA04A" onClick={()=>onNavigate("asistencia")}/>
        <HeroStat icon="🏆" value={partidos.filter(p=>p.resultado==="victoria").length}
          label="Victorias" sub={`de ${partidos.filter(p=>p.estado==="jugado").length} partidos jugados`}
          color={sportColor} onClick={()=>onNavigate("matchcenter")}/>
        <HeroStat icon="👥" value={players.length} label="Plantel"
          sub="Jugadores activos" color="#3B82F6" onClick={()=>onNavigate("nomina")}/>
      </div>

      <div className="home-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        {/* Tendencia asistencia */}
        <MiniCard title="Tendencia asistencia — 4 semanas" delay={0.08}>
          <TrendBar data={trendData} color={sportColor}/>
          <div style={{fontSize:"10px",color:"var(--text-3)",marginTop:"8px"}}>
            {trendData[3].pct > trendData[0].pct ? "📈 Asistencia en alza este mes" : "📉 Asistencia en baja este mes"}
          </div>
        </MiniCard>

        {/* Acciones rápidas */}
        <MiniCard title="Acciones rápidas" delay={0.1}>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <QuickAction icon="✅" label="Asistencia" color="#1FA04A" onClick={()=>onNavigate("asistencia")}/>
            <QuickAction icon="💬" label="El Muro" color={sportColor} onClick={()=>onNavigate("muro")}/>
            <QuickAction icon="📋" label="Nómina" color="#3B82F6" onClick={()=>onNavigate("nomina")}/>
            <QuickAction icon="🏆" label="Resultado" color="#C98408" onClick={()=>onNavigate("muro")}/>
          </div>
        </MiniCard>
      </div>

      {/* Último resultado */}
      <MiniCard title="Último partido" delay={0.12}>
        {ultimoRes ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
              <div style={{fontWeight:900,fontSize:"26px",
                color:ultimoRes.resultado==="victoria"?"#1FA04A":ultimoRes.resultado==="derrota"?"#C0392B":"#C98408"}}>
                {ultimoRes.golesLocal} — {ultimoRes.golesVisita}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:"12px"}}>vs {ultimoRes.rival}</div>
                <div style={{fontSize:"10px",color:"var(--text-3)"}}>{ultimoRes.fecha} · {ultimoRes.lugar}</div>
              </div>
            </div>
            {ultimoRes.tarjetas?.length>0 && (
              <div style={{fontSize:"11px",color:"var(--text-3)"}}>
                🃏 {ultimoRes.tarjetas.length} tarjeta{ultimoRes.tarjetas.length>1?"s":""} en el partido
              </div>
            )}
          </div>
        ) : (
          <div style={{fontSize:"12px",color:"var(--text-3)"}}>Sin partidos jugados aún.</div>
        )}
      </MiniCard>
    </div>
  );
}

function HomePreparador({ players, sportColor, sp, onNavigate }) {
  // Simular estado wellness del plantel
  const WELLNESS_RESUMEN = [
    {level:"lesionado", count:2, color:"#C0392B", icon:"🚑", label:"Lesionados"},
    {level:"alerta",    count:3, color:"#C98408", icon:"⚠️", label:"En alerta"},
    {level:"ok",        count:players.length-5, color:"#1FA04A", icon:"✅", label:"Aptos"},
  ];
  const pct = Math.round((players.length-5)/players.length*100);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      {/* Hero: estado del plantel */}
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
        style={{...ss.card,padding:"0",overflow:"hidden",border:"1px solid rgba(192,57,43,0.25)",
          background:"linear-gradient(135deg,rgba(192,57,43,0.06),transparent)"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border-soft)",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontWeight:700,fontSize:"14px"}}>💪 Estado del plantel — Post partido</div>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
            onClick={()=>onNavigate("estadoplantel")}
            style={{...ss.btn,background:"rgba(192,57,43,0.12)",color:"#C0392B",
              border:"1px solid rgba(192,57,43,0.3)",fontSize:"11px",padding:"6px 14px",fontWeight:700}}>
            Ver detalle →
          </motion.button>
        </div>
        <div style={{padding:"18px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px"}}>
          {WELLNESS_RESUMEN.map(w=>(
            <div key={w.level} style={{textAlign:"center",padding:"14px 8px",borderRadius:"var(--r-md)",
              background:`${w.color}08`,border:`1px solid ${w.color}22`}}>
              <div style={{fontSize:"24px",marginBottom:"6px"}}>{w.icon}</div>
              <div style={{fontWeight:900,fontSize:"28px",color:w.color,letterSpacing:"-0.02em"}}>{w.count}</div>
              <div style={{fontSize:"11px",color:"var(--text-3)",marginTop:"3px"}}>{w.label}</div>
            </div>
          ))}
        </div>
        <div style={{padding:"0 18px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{flex:1,height:"6px",borderRadius:"99px",background:"var(--bg-elev-3)",overflow:"hidden"}}>
              <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1,delay:0.4}}
                style={{height:"100%",borderRadius:"99px",background:"linear-gradient(90deg,#1FA04A,#2DC05A)"}}/>
            </div>
            <span style={{fontWeight:800,fontSize:"13px",color:"#1FA04A"}}>{pct}% aptos</span>
          </div>
        </div>
      </motion.div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        {/* Stats */}
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <HeroStat icon="📅" value="Semana 8" label="Microciclo activo" sub="Pretemporada 2025"
            color={sportColor} onClick={()=>onNavigate("microciclo")}/>
          <HeroStat icon="🏋️" value="78%" label="Cumplimiento" sub="Plan de entrenamiento"
            color="#3B82F6" onClick={()=>onNavigate("rankingfuerza")}/>
        </div>

        {/* Acciones rápidas */}
        <MiniCard title="Acciones rápidas" delay={0.1}>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <QuickAction icon="💪" label="Estado plantel" color="#C0392B" onClick={()=>onNavigate("estadoplantel")}/>
            <QuickAction icon="📅" label="Microciclo" color={sportColor} onClick={()=>onNavigate("microciclo")}/>
            <QuickAction icon="🏋️" label="Ranking" color="#C98408" onClick={()=>onNavigate("rankingfuerza")}/>
          </div>
          <div style={{marginTop:"14px",padding:"10px 12px",borderRadius:"var(--r-md)",
            background:"rgba(192,57,43,0.06)",border:"1px solid rgba(192,57,43,0.2)",
            fontSize:"11px",color:"var(--text-2)",display:"flex",gap:"8px",alignItems:"center"}}>
            <span>📣</span>
            <span>Cuestionario wellness programado — se enviará mañana a las 24h del partido.</span>
          </div>
        </MiniCard>
      </div>
    </div>
  );
}

function HomeJugador({ player, sportColor, sp, club, payments, partidos, onNavigate, convocado=null }) {
  const miPago     = payments?.find(p=>p.jugador===player?.name);
  const cuotaOk    = !miPago || miPago.estado==="pagado";
  // Si el entrenador no publicó nómina aún, jugadores aptos se muestran como "pendiente"
  const estaConvocado = convocado === true;
  const convocadoDefinido = convocado !== null;
  const proximoPar = club?.next;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      {/* Hero: ¿estoy convocado? */}
      <motion.div initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} transition={{duration:0.5}}
        style={{...ss.card,padding:"28px 24px",textAlign:"center",
          border:`1px solid ${!convocadoDefinido?"rgba(100,100,100,0.3)":estaConvocado?"#1FA04A33":"rgba(192,57,43,0.3)"}`,
          background:`linear-gradient(135deg,${!convocadoDefinido?"rgba(80,80,80,0.04)":estaConvocado?"rgba(31,160,74,0.08)":"rgba(192,57,43,0.06)"},transparent)`}}>
        <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:260,damping:20,delay:0.2}}
          style={{width:"72px",height:"72px",borderRadius:"50%",margin:"0 auto 16px",
            background:`linear-gradient(135deg,${!convocadoDefinido?"#555":estaConvocado?"#1FA04A":"#C0392B"}33,transparent)`,
            border:`3px solid ${!convocadoDefinido?"#55555555":estaConvocado?"#1FA04A55":"#C0392B55"}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"32px",
            boxShadow:`0 0 32px ${!convocadoDefinido?"#55555533":estaConvocado?"#1FA04A44":"#C0392B44"}`}}>
          {!convocadoDefinido?"📋":estaConvocado?"🎽":"⏳"}
        </motion.div>
        <div style={{fontWeight:900,fontSize:"22px",marginBottom:"6px",
          color:!convocadoDefinido?"var(--text-2)":estaConvocado?"#1FA04A":"#C0392B"}}>
          {!convocadoDefinido?"Nómina no publicada aún":estaConvocado?"¡Estás convocado!":"No estás convocado"}
        </div>
        <div style={{fontSize:"13px",color:"var(--text-2)",marginBottom:"16px"}}>
          {!convocadoDefinido
            ? "El entrenador publicará la nómina antes del partido."
            : estaConvocado
              ? `Próximo partido vs ${proximoPar?.rival||"rival"} — ${proximoPar?.dia||"próximamente"}`
              : "Sigue entrenando. Habla con tu entrenador."}
        </div>
        {estaConvocado && (
          <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
            onClick={()=>onNavigate("miconvocatoria")}
            style={{...ss.btn,background:"linear-gradient(135deg,#1FA04A,#2DC05A)",color:"#fff",
              padding:"10px 24px",fontSize:"13px",fontWeight:700,boxShadow:"0 6px 20px rgba(31,160,74,0.4)"}}>
            Ver mi convocatoria →
          </motion.button>
        )}
      </motion.div>

      {/* Stats personales */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px"}}>
        <HeroStat icon="💳" value={cuotaOk?"Al día":"Pendiente"} label="Mi cuota"
          sub={cuotaOk?"Gracias por pagar":"Vence pronto"}
          color={cuotaOk?"#1FA04A":"#C98408"} onClick={()=>onNavigate("micuota")}/>
        <HeroStat icon="💪" value="😊 19/25" label="Mi wellness"
          sub="Última respuesta: ayer" color={sportColor} onClick={()=>onNavigate("midashboard")}/>
        <HeroStat icon="🏋️" value="#3" label="Ranking fuerza"
          sub="En tu categoría" color="#C98408" onClick={()=>onNavigate("migym")}/>
      </div>

      {/* Acciones rápidas */}
      <MiniCard title="Acciones rápidas" delay={0.15}>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <QuickAction icon="💳" label="Mi cuota" color="#C98408" onClick={()=>onNavigate("micuota")}/>
          <QuickAction icon="🏋️" label="Mi gym" color={sportColor} onClick={()=>onNavigate("migym")}/>
          <QuickAction icon="📋" label="Nóminas" color="#3B82F6" onClick={()=>onNavigate("nominasclub")}/>
          <QuickAction icon="📰" label="Noticias" color="#1FA04A" onClick={()=>onNavigate("noticias")}/>
        </div>
      </MiniCard>
    </div>
  );
}

// ── Export principal ──────────────────────────────────────────────────────

export default function HomeView({ role, players, sportColor, club, sp, countryData, payments, partidos, onNavigate, currentUser, convocado=null, clubId=null }) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const nombre = currentUser?.nombre?.split(" ")[0] || "Equipo";

  return (
    <div>
      {/* Saludo */}
      <motion.div {...fadeUp} style={{marginBottom:"24px"}}>
        <div style={{fontSize:"22px",fontWeight:900,letterSpacing:"-0.02em",marginBottom:"2px"}}>
          {greeting()}, {nombre} 👋
        </div>
        <div style={{fontSize:"13px",color:"var(--text-3)"}}>
          {new Date().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})} · {sp?.name}
        </div>
      </motion.div>

      {/* Contenido por rol */}
      {role==="admin"      && <HomeAdmin      players={players} sportColor={sportColor} club={club} sp={sp} countryData={countryData} payments={payments} partidos={partidos} onNavigate={onNavigate}/>}
      {role==="entrenador" && <HomeEntrenador players={players} sportColor={sportColor} club={club} sp={sp} partidos={partidos} onNavigate={onNavigate} clubId={clubId}/>}
      {role==="preparador" && <HomePreparador players={players} sportColor={sportColor} sp={sp} onNavigate={onNavigate}/>}
      {role==="jugador"    && <HomeJugador    player={players[0]} sportColor={sportColor} sp={sp} club={club} payments={payments} partidos={partidos} onNavigate={onNavigate} convocado={convocado}/>}
      {role==="superadmin" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
          <HeroStat icon="🏢" value="24" label="Clubes activos" sub="En SportOS" color={sportColor} onClick={()=>onNavigate("clubes")}/>
          <HeroStat icon="💰" value="$1.840" label="Comisiones" sub="Este mes (USD)" color="#1FA04A" onClick={()=>onNavigate("comisiones")}/>
          <HeroStat icon="👥" value="387" label="Usuarios" sub="En la plataforma" color="#3B82F6" onClick={()=>onNavigate("dashboard")}/>
          <HeroStat icon="📈" value="94%" label="Retención" sub="Últimos 30 días" color="#C98408" onClick={()=>onNavigate("comparativa")}/>
        </div>
      )}
    </div>
  );
}
