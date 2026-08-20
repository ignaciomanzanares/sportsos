import { useState, useEffect } from "react";
import { m as motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { supabase } from "../lib/supabase";
import { usePlataforma } from "../lib/usePlataforma";
import { terminoAnotacion, nombrePuesto } from "../data/sports";
import { getNotifications } from "../lib/db";
import { periodoDe, periodoDePago, nombrePeriodo } from "../lib/periodo";
import { ordenarPlantel } from "../lib/ordenPlantel";
import { useInjuryReports, playersEnAlerta } from "../lib/useInjuryReports";
import EmptyState from "../components/EmptyState";

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
          {/* "📍 Local" estaba escrito a mano: decía Local incluso cuando el
              partido era de visita, que es la mitad del fixture. */}
          <div style={{fontSize:"11px", color:"var(--text-3)", marginTop:"4px", textTransform:"capitalize"}}>
            📅 {next?.dia || "—"}
            {next?.hora && next.hora !== "00:00" ? ` · ${next.hora} hrs` : ""}
            {next?.lugar ? ` · 📍 ${next.lugar}` : ""}
          </div>
          {next?.equipo && (
            <div style={{fontSize:"11px", color:"var(--text-3)", marginTop:"2px"}}>{next.equipo}</div>
          )}
        </div>
        {res?.rival && (
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"10px", color:"var(--text-3)", marginBottom:"4px"}}>Último resultado</div>
            <div style={{fontWeight:800, fontSize:"14px",
              color:res.res==="Victoria"?"#1FA04A":res.res==="Derrota"?"#C0392B":"#C98408"}}>
              {res.res} {res.score}
            </div>
            <div style={{fontSize:"10px", color:"var(--text-3)"}}>
              vs {res.rival}{res.equipo ? ` · ${res.equipo}` : ""}
            </div>
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

/**
 * Abreviatura del puesto, con el vocabulario del deporte.
 *
 * Estaba escrita solo para fútbol: POR / DEF / MED / DEL. En rugby eso no
 * existe —no hay defensas ni delanteros, hay forwards y backs, y un pilar no
 * es lo mismo que un segunda línea— así que un plantel entero de rugby salía
 * etiquetado con puestos de otro deporte.
 */
// En el orden de la camiseta, del 1 al 15: así se lee un plantel de rugby.
// Ala y N.º 8 van juntos como tercera línea — en la cancha se habla de "los
// tres" y separarlos es una distinción que nadie usa para mirar una lista.
const RUGBY_ABREV = [
  [/loosehead|tighthead|\bprop\b|pilar/,   "PIL"],
  [/hooker/,                               "HOO"],
  [/\block\b|segunda/,                     "2L"],
  [/flanker|\bala\b|tercera/,              "3L"],
  [/number\s*8|octavo|n\.?º?\s*8/,          "3L"],
  [/scrum-?half|medio/,                    "MED"],
  [/fly-?half|apertura/,                   "APE"],
  [/centre|center|centro/,                 "CEN"],
  [/wing|winger/,                          "WIN"],
  [/fullback|zaguero/,                     "FB"],
];

// El orden de los filtros no puede ser alfabético: 2L antes que PIL no
// significa nada. Es el de la camiseta, y los sin puesto al final.
const ORDEN_ABREV = ["PIL","HOO","2L","3L","MED","APE","CEN","WIN","FB"];

const FUTBOL_ABREV = [
  [/portero|arquero|goalkeeper/,           "POR"],
  [/lateral|central|defensa|defender/,     "DEF"],
  [/volante|mediocampista|medio|midfield/, "MED"],
  [/delantero|forward|punta/,              "DEL"],
];

// pos puede ser null de verdad (jugador sin puesto cargado), no solo undefined:
// un default de "" no lo cubre y antes tumbaba la pantalla entera.
function posAbbr(pos, sportName = "Rugby") {
  const p = (pos || "").toLowerCase();
  if (!p) return "—";
  const tabla = String(sportName).toLowerCase() === "rugby" ? RUGBY_ABREV : FUTBOL_ABREV;
  for (const [re, abrev] of tabla) if (re.test(p)) return abrev;
  // Sin coincidencia, las tres primeras letras del puesto real: dice menos que
  // una etiqueta correcta, pero nunca dice algo falso.
  return p.slice(0, 3).toUpperCase();
}

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Recién";
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-CL");
}

const NOTIF_DOT = { nomina:"#818cf8", partido:"#22c55e", pago:"#fbbf24", plantel:"#38bdf8", general:"#5a5753" };

function HomeAdmin({ players, sportColor, sp, payments, partidos, onNavigate, clubId, onEditPlayer }) {
  const [posFilter, setPosFilter] = useState("TODOS");

  const pagados    = payments.filter(p=>p.estado==="pagado").length;
  const totalJugs  = players.length;
  const victorias  = partidos.filter(p=>p.resultado==="victoria").length;
  // "Goles" no existe en rugby. Cada deporte declara su estadística principal.
  const anot = terminoAnotacion(sp);
  const totalGoles = players.reduce((s,p)=>s+(p.stats?.[anot.clave]||0),0);

  // Próximos partidos: del más cercano al más lejano, y solo los que aún no se
  // juegan. La lista venía en el orden en que Supabase devuelve los partidos
  // (fecha descendente), así que "próximos" mostraba primero el de diciembre;
  // y Leverade deja partidos viejos sin cerrar, que se colaban como futuros.
  const hoyISO   = new Date().toISOString().slice(0,10);
  const proximos = partidos
    .filter(p => p.estado === "programado" && p.fecha >= hoyISO)
    .sort((a,b) => (a.fecha+(a.hora||"")).localeCompare(b.fecha+(b.hora||"")))
    .slice(0,4);

  // Actividad reciente — antes era un feed 100% inventado (hat-trick falso,
  // "cuotas procesadas" que nunca corrió, etc). Ahora lee notifications real.
  const [notifs, setNotifs] = useState([]);
  useEffect(() => {
    if (!clubId) return;
    getNotifications(clubId, 6).then(setNotifs).catch(() => {});
  }, [clubId]);

  const activity = notifs.map(n => ({
    dot: NOTIF_DOT[n.type] || sportColor,
    text: n.body || n.title,
    time: relTime(n.created_at),
  }));

  // Tabla de jugadores con filtro de posición
  // Los filtros salen de los puestos que el plantel realmente tiene, en el
  // vocabulario del deporte. Los sin puesto quedan bajo "—", que también se
  // puede filtrar: son justo los que hay que ir a completar.
  const abrev = (p) => posAbbr(nombrePuesto(p.position), sp?.name);
  const allFilters = ["TODOS", ...Array.from(new Set(players.map(abrev)))
    .sort((a,b) => {
      const ia = ORDEN_ABREV.indexOf(a), ib = ORDEN_ABREV.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })];
  const filtered = ordenarPlantel(posFilter === "TODOS" ? players : players.filter(p=>abrev(p)===posFilter));

  const avatarColors = ["#4f46e5","#0284c7","#b45309","#be185d","#047857","#7c3aed","#c2410c","#0f766e"];

  const CARD = { background:"#121110", border:"1px solid #1e1c19", borderRadius:"8px", padding:"18px" };

  const kpi = [
    { label:"Jugadores activos",  value: totalJugs,  change: totalJugs === 1 ? "1 en el plantel" : `${totalJugs} en el plantel`, changeColor: sportColor, onClick: ()=>onNavigate("jugadores") },
    { label:"Partidos ganados",   value: victorias,  change: `${partidos.filter(p=>p.estado==="jugado").length} jugados`, changeColor:"#a8a49f", onClick: ()=>onNavigate("matchcenter") },
    { label:`${anot.etiqueta} marcados`, value: totalGoles, change: "Temporada actual",  changeColor:"#a8a49f", onClick: ()=>onNavigate("estadisticas") },
    { label:"Cuotas pagadas",     value: `${pagados}/${totalJugs}`, change: `${Math.round(pagados/(totalJugs||1)*100)}% al día`, changeColor: sportColor, onClick: ()=>onNavigate("finanzas") },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

      {/* KPI CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"10px"}}>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"10px"}}>

        {/* Próximos partidos */}
        <div style={CARD}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:"14px"}}>
            <div style={{fontFamily:BEBAS,fontSize:"14px",color:"#f0ede8",textTransform:"uppercase",letterSpacing:"0.04em"}}>Próximos Partidos</div>
            {/* Al calendario, no al Match Center: acá se muestran los próximos
                partidos y "ver todos" es la lista completa, no el detalle del
                que viene. */}
            <button onClick={()=>onNavigate("calendario")} style={{fontSize:"11.5px",fontWeight:500,color:sportColor,background:"none",border:"none",cursor:"pointer",padding:0}}>ver todos →</button>
          </div>
          {proximos.length === 0 ? (
            <div style={{fontSize:"12px",color:"#4a4743",padding:"12px 0"}}>No hay partidos programados.</div>
          ) : proximos.map((m,i)=>(
            <motion.div key={m.id||i} whileHover={{background:"#161412"}}
              style={{display:"flex",alignItems:"center",gap:"14px",padding:"10px 11px",borderRadius:"6px",cursor:"pointer",transition:"background 0.12s"}}>
              <div style={{fontFamily:DM_MONO,fontSize:"12px",color:"#4a4743",flexShrink:0,width:"56px"}}>{m.fecha ? `${m.fecha.slice(8,10)}/${m.fecha.slice(5,7)}` : "—"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"13px",fontWeight:500,color:"#d4d2ce",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.rival}</div>
                <div style={{fontSize:"11px",color:"#4a4743",marginTop:"1px"}}>{m.lugar} · {m.hora||"—"}</div>
              </div>
              <div style={{fontFamily:DM_MONO,fontSize:"10.5px",fontWeight:500,color:m.cat?.includes("Primer")?"#818cf8":"#5a5753",flexShrink:0}}>
                {m.cat || "—"}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actividad */}
        <div style={CARD}>
          <div style={{fontFamily:BEBAS,fontSize:"14px",color:"#f0ede8",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"14px"}}>Actividad</div>
          {activity.length===0 && (
            <EmptyState icon="🔔" title="Sin actividad todavía" desc="Acá vas a ver resultados publicados, pagos confirmados y cambios en el plantel." color={sportColor}/>
          )}
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
                {/* "PJ" era minutos/90 y "Asist." son asistencias de fútbol:
                    en rugby ninguna de las dos existe. Los partidos jugados y
                    los puntos sí, y vienen del torneo. */}
                {/* La alineación se declara por columna. Antes era una cuenta
                    sobre el índice ("i>3 ? right : i===6 ? center : left") y el
                    segundo caso nunca se alcanzaba: el encabezado de PJ quedaba
                    a la izquierda sobre números alineados a la derecha, y el de
                    Estado a la derecha sobre texto centrado. */}
                {[["#","left"],["Jugador","left"],["Pos","left"],["PJ","right"],
                  [anot.etiqueta,"right"],[anot.clave==="tries"?"Pts":"Asist.","right"],
                  ["Estado","center"]].map(([h,align])=>(
                  <th key={h} style={{textAlign:align,padding:"6px 10px",fontSize:"10px",fontWeight:500,color:"#3e3b37",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p,i)=>{
                const initials = p.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                const statusColor = p.med_status==="rojo"?"#f87171":p.med_status==="amarillo"?"#fbbf24":sportColor;
                const statusLabel = p.med_status==="rojo"?"Lesionado":p.med_status==="amarillo"?"Alerta":"Disponible";
                const bgColor = avatarColors[i % avatarColors.length];
                return (
                  <tr key={p.id} style={{cursor:onEditPlayer?"pointer":"default"}}
                    onClick={()=>onEditPlayer?.(p)}
                    title={onEditPlayer?"Editar ficha":undefined}
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
                    <td style={{padding:"10px",borderBottom:"1px solid #1a1816",fontFamily:DM_MONO,fontSize:"11.5px",fontWeight:500,color:"#a8a49f"}}>{abrev(p)}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:DM_MONO,fontSize:"13px",color:"#b0ada8",borderBottom:"1px solid #1a1816"}}>{p.stats?.partidos ?? (p.stats?.minutos != null ? Math.round(p.stats.minutos/90) : "—")}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:BEBAS,fontSize:"15px",fontWeight:700,color:sportColor,borderBottom:"1px solid #1a1816"}}>{p.stats?.[anot.clave] ?? "—"}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:DM_MONO,fontSize:"13px",color:"#b0ada8",borderBottom:"1px solid #1a1816"}}>{(anot.clave==="tries" ? p.stats?.puntos : p.stats?.asistencias) ?? "—"}</td>
                    <td style={{padding:"10px",textAlign:"center",borderBottom:"1px solid #1a1816"}}>
                      <span style={{fontSize:"10.5px",fontWeight:500,color:statusColor}}>{statusLabel}</span>
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
  // Era Math.floor(players.length * 0.78): la "asistencia de hoy" era el 78%
  // del plantel, inventado, todos los días. Ahora se cuenta la asistencia real
  // de hoy; null significa que nadie la tomó, y eso se dice.
  const [presentes, setPresentes] = useState(null);
  useEffect(() => {
    if (!clubId) { setPresentes(null); return; }
    const hoy = new Date().toISOString().slice(0, 10);
    let vivo = true;
    supabase.from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId).eq("date", hoy).eq("present", true)
      .then(({ count }) => { if (vivo) setPresentes(count ?? 0); });
    return () => { vivo = false; };
  }, [clubId]);

  // Tendencia de asistencia — últimas 4 semanas desde Supabase
  // Arrancaba en 65/72/80% y el efecto de más abajo se salta si el club no
  // tiene jugadores: un club recién creado veía "Asistencia en alza" sobre
  // semanas que nunca ocurrieron. En cero hasta que haya asistencia real.
  const [trendData, setTrendData] = useState([
    { label:"Sem 1", pct: 0 },
    { label:"Sem 2", pct: 0 },
    { label:"Sem 3", pct: 0 },
    { label:"Hoy",   pct: 0 },
  ]);
  const hayAsistencia = trendData.some(t => t.pct > 0);

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
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"12px"}}>
        <HeroStat icon="✅" value={presentes === null ? "—" : `${presentes}/${players.length}`} label="Asistencia hoy"
          sub={presentes === null ? "Nadie la tomó todavía" : "Presentes en entrenamiento"} color="#1FA04A" onClick={()=>onNavigate("asistencia")}/>
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
            {!hayAsistencia ? "Sin asistencia registrada todavía"
              : trendData[3].pct > trendData[0].pct ? "📈 Asistencia en alza este mes" : "📉 Asistencia en baja este mes"}
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

function HomePreparador({ players, sportColor, onNavigate, clubId=null }) {
  // Antes decía "2 lesionados, 3 en alerta" siempre, con un comentario que lo
  // admitía ("Simular estado wellness"): el 96% de aptos era players.length-5
  // sobre cualquier plantel. Ahora sale de injury_reports, que es donde el
  // preparador efectivamente registra el estado.
  const { reports, loading: cargandoLesiones } = useInjuryReports(clubId);
  const alerta = playersEnAlerta(reports, players);
  const ultimoPorJugador = new Map();
  for (const r of reports) if (!ultimoPorJugador.has(r.player_id)) ultimoPorJugador.set(r.player_id, r);
  const idsAlerta   = new Set(alerta.map(a => a.playerId));
  const lesionados  = [...ultimoPorJugador.values()].filter(r => r.status === "rojo").length;
  const enAlerta    = [...idsAlerta].filter(id => ultimoPorJugador.get(id)?.status !== "rojo").length;
  const aptos       = Math.max(players.length - lesionados - enAlerta, 0);
  const hayReportes = reports.length > 0;

  const WELLNESS_RESUMEN = [
    {level:"lesionado", count:lesionados, color:"#C0392B", icon:"🚑", label:"Lesionados"},
    {level:"alerta",    count:enAlerta,   color:"#C98408", icon:"⚠️", label:"En alerta"},
    {level:"ok",        count:aptos,      color:"#1FA04A", icon:"✅", label:"Aptos"},
  ];
  const pct = players.length ? Math.round(aptos/players.length*100) : 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
      {/* Hero: estado del plantel */}
      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
        style={{...ss.card,padding:"0",overflow:"hidden",border:"1px solid rgba(192,57,43,0.25)",
          background:"linear-gradient(135deg,rgba(192,57,43,0.06),transparent)"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border-soft)",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* "Post partido" era decorado: el resumen no mira ningún partido. */}
          <div style={{fontWeight:700,fontSize:"14px"}}>💪 Estado del plantel</div>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
            onClick={()=>onNavigate("estadoplantel")}
            style={{...ss.btn,background:"rgba(192,57,43,0.12)",color:"#C0392B",
              border:"1px solid rgba(192,57,43,0.3)",fontSize:"11px",padding:"6px 14px",fontWeight:700}}>
            Ver detalle →
          </motion.button>
        </div>
        {!cargandoLesiones && !hayReportes && (
          <div style={{padding:"18px",fontSize:"12px",color:"var(--text-3)"}}>
            Todavía nadie registró el estado físico del plantel. Se llena desde
            Estado Plantel, jugador por jugador.
          </div>
        )}
        {hayReportes && <>
        <div style={{padding:"18px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:"12px"}}>
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
        </>}
      </motion.div>

      {/* Se fueron "Semana 8 · Pretemporada 2025" y "78% de cumplimiento": el
          microciclo no guarda semana ni temporada en ningún lado, y no hay
          registro de ejercicios completados del que sacar un porcentaje. Igual
          el aviso de "cuestionario wellness programado", que no está
          programado: no existe tal envío. */}
      <MiniCard title="Acciones rápidas" delay={0.1}>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <QuickAction icon="💪" label="Estado plantel" color="#C0392B" onClick={()=>onNavigate("estadoplantel")}/>
          <QuickAction icon="📅" label="Microciclo" color={sportColor} onClick={()=>onNavigate("microciclo")}/>
          <QuickAction icon="🏋️" label="Ranking" color="#C98408" onClick={()=>onNavigate("rankingfuerza")}/>
        </div>
      </MiniCard>
    </div>
  );
}

function HomeJugador({ player, sportColor, sp, club, payments, onNavigate, convocado=null }) {
  const anotJug = { ...terminoAnotacion(sp), icono: sp?.stats?.[0]?.icon || "🏉" };
  // Buscaba por p.jugador, un campo que los pagos no tienen (son playerId y
  // playerName), así que miPago era siempre undefined y la tarjeta decía
  // "cuota al día" pasara lo que pasara. Ahora se pregunta por el mes en curso.
  const mesActual  = periodoDe();
  const delMes     = (payments || []).filter(p => p.playerId === player?.id && periodoDePago(p) === mesActual);
  const cuotaOk    = delMes.some(p => p.estado === "pagado");
  const declaradoMes = !cuotaOk && delMes.some(p => p.estado === "declarado");
  // Mientras el club no haya registrado ninguna cuota, decir "Pendiente" sería
  // acusar de deuda a gente a la que nadie le cobró nada.
  const clubCobra  = (payments || []).length > 0;
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"12px"}}>
        {/* Sin cuota registrada no se dice "Al día — Gracias por pagar": nadie
            ha pagado nada, y felicitar por un pago que no existe es peor que
            no decir nada. El wellness (😊 19/25, "última respuesta: ayer") y
            el puesto en el ranking de fuerza estaban escritos a mano: no hay
            cuestionario ni ranking que los produzca. */}
        <HeroStat icon="💳"
          value={cuotaOk ? "Al día" : declaradoMes ? "Por confirmar" : clubCobra ? "Pendiente" : "Sin cuota"}
          label="Mi cuota"
          sub={cuotaOk ? nombrePeriodo(mesActual) : declaradoMes ? "El admin la está revisando"
               : clubCobra ? `Pendiente de ${nombrePeriodo(mesActual)}` : "El club no te cobró todavía"}
          color={cuotaOk ? "#1FA04A" : declaradoMes ? "#C98408" : clubCobra ? "#C98408" : "#6B7896"}
          onClick={()=>onNavigate("micuota")}/>
        {/* Antes esta tarjeta usaba el ícono del deporte como si fuera un
            número: una pelota gigante que no decía nada. Van los partidos y los
            tries del jugador en el torneo, que son datos suyos y reales. Ir al
            gym ya está en Acciones rápidas, abajo. */}
        <HeroStat icon="🏉" value={player?.stats?.partidos ?? "—"} label="Partidos"
          sub="Jugados en el torneo" color="#3B82F6" onClick={()=>onNavigate("midashboard")}/>
        <HeroStat icon={anotJug.icono} value={player?.stats?.[anotJug.clave] ?? "—"} label={anotJug.etiqueta}
          sub="En el torneo" color={sportColor} onClick={()=>onNavigate("midashboard")}/>
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

/**
 * Panel de superadmin. Antes eran cuatro cifras escritas a mano — 24 clubes,
 * $1.840 de comisiones, 387 usuarios, 94% de retención — sobre una plataforma
 * con un club y nueve usuarios. Se muestran las dos que se pueden contar de
 * verdad; comisiones y retención no tienen tabla de dónde salir y por eso no
 * están: un panel que inventa sus cifras no sirve para controlar nada.
 */
function HomeSuperAdmin({ sportColor, onNavigate }) {
  const { clubes, usuarios, cargando } = usePlataforma();
  const valor = (n) => (cargando ? "…" : n ?? "—");
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"12px"}}>
      <HeroStat icon="🏢" value={valor(clubes)} label="Clubes activos" sub="Sin suspender" color={sportColor} onClick={()=>onNavigate("clubes")}/>
      <HeroStat icon="👥" value={valor(usuarios)} label="Usuarios" sub="Con perfil creado" color="#3B82F6" onClick={()=>onNavigate("dashboard")}/>
    </div>
  );
}

export default function HomeView({ role, players, sportColor, club, sp, countryData, payments, partidos, onNavigate, currentUser, convocado=null, clubId=null, onEditPlayer=null, miJugador=null }) {
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
      {role==="admin"      && <HomeAdmin      onEditPlayer={onEditPlayer} players={players} sportColor={sportColor} club={club} sp={sp} countryData={countryData} payments={payments} partidos={partidos} onNavigate={onNavigate} clubId={clubId}/>}
      {role==="entrenador" && <HomeEntrenador players={players} sportColor={sportColor} club={club} sp={sp} partidos={partidos} onNavigate={onNavigate} clubId={clubId}/>}
      {role==="preparador" && <HomePreparador players={players} sportColor={sportColor} sp={sp} onNavigate={onNavigate} clubId={clubId}/>}
      {/* La ficha del que entró, no la primera de la lista: con players[0] el
          jugador veía en su Inicio los partidos y los tries de otra persona. */}
      {role==="jugador"    && <HomeJugador    player={miJugador || players[0]} sportColor={sportColor} sp={sp} club={club} payments={payments} partidos={partidos} onNavigate={onNavigate} convocado={convocado}/>}
      {role==="superadmin" && <HomeSuperAdmin sportColor={sportColor} onNavigate={onNavigate}/>}
    </div>
  );
}
