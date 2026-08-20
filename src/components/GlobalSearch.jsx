import { useState, useEffect, useRef } from "react";
import { m as motion } from "framer-motion";
import { ss } from "../styles/tokens";
import { filtrarPorNombre, coincide } from "../lib/buscarNombre";

const MODULE_LABELS = {
  // entrenador
  muro:"El Muro", calendario:"Calendario", matchcenter:"Match Center",
  nomina:"Nómina", estadisticas:"Estadísticas", asistencia:"Asistencia", salud:"Salud",
  // admin
  miclub:"Mi Club", jugadores:"Jugadores", finanzas:"Finanzas",
  // preparador
  microciclo:"Microciclo", estadoplantel:"Estado Plantel", rankingfuerza:"Ranking Fuerza",
  // jugador
  midashboard:"Mi Dashboard", noticias:"Noticias", micuota:"Mi Cuota",
  migym:"Mi Gym", nominasclub:"Nóminas Club", miconvocatoria:"Mi Convocatoria",
};

export default function GlobalSearch({ players=[], posts=[], sportColor="#A855F7", role, modules=[], onNavigate, onClose }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const res = [];

    // Jugadores. Mostraba cuatro y cortaba en silencio: buscando "perez"
    // salían tres y el plantel tiene nueve, así que la búsqueda global parecía
    // decir que los otros no existen.
    const jugadores = filtrarPorNombre(players, q);
    jugadores.slice(0,8).forEach(p => {
      res.push({ type:"jugador", icon:"👤", label:p.name, sub:`#${p.number||"?"} · ${p.category||"Sin cat."}`, action:()=>onNavigate("jugadores") });
    });
    if (jugadores.length > 8) {
      res.push({ type:"jugador", icon:"👥", label:`Ver los ${jugadores.length} que coinciden`,
        sub:"En Jugadores", action:()=>onNavigate("jugadores") });
    }

    // Posts / El Muro
    posts.filter(p => coincide(p.text, q) || coincide(p.author, q)).slice(0,3).forEach(p => {
      res.push({ type:"post", icon:"💬", label:p.author, sub:p.text?.slice(0,60)+"...", action:()=>onNavigate("muro") });
    });

    // Módulos
    modules.filter(m => coincide(MODULE_LABELS[m.id]||m.label||"", q)).forEach(m => {
      res.push({ type:"modulo", icon:"⚡", label:MODULE_LABELS[m.id]||m.label, sub:"Ir al módulo", action:()=>onNavigate(m.id) });
    });

    setResults(res);
  }, [query]);

  const groupColors = { jugador:sportColor, post:"#22C55E", modulo:"#A855F7" };
  const groupLabels = { jugador:"Jugadores", post:"El Muro", modulo:"Módulos" };

  // Agrupar por tipo
  const groups = ["jugador","post","modulo"].map(t=>({ type:t, items:results.filter(r=>r.type===t) })).filter(g=>g.items.length>0);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"clamp(60px,12vh,120px)",padding:"clamp(60px,12vh,120px) 16px 0"}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <motion.div initial={{opacity:0,y:-20,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.97}}
        transition={{type:"spring",stiffness:300,damping:28}}
        style={{width:"100%",maxWidth:"520px",background:"var(--bg-glass-strong)",backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",borderRadius:"var(--r-xl)",border:"1px solid var(--border-mid)",boxShadow:"var(--shadow-lg)",overflow:"hidden"}}>

        {/* Input */}
        <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"16px 18px",borderBottom:"1px solid var(--border-soft)"}}>
          <span style={{fontSize:"16px",color:"var(--text-3)"}}>🔍</span>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Escape"&&onClose()}
            placeholder="Buscar jugadores, posts, módulos..."
            style={{...ss.input,background:"transparent",border:"none",fontSize:"15px",padding:0,flex:1,outline:"none"}}/>
          <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={onClose}
            style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-3)",padding:"4px 10px",fontSize:"11px",border:"1px solid var(--border-soft)"}}>
            Esc
          </motion.button>
        </div>

        {/* Resultados */}
        <div style={{maxHeight:"360px",overflowY:"auto",padding:"8px 0"}}>
          {query && results.length===0 && (
            <div style={{textAlign:"center",padding:"32px",color:"var(--text-3)",fontSize:"13px"}}>
              Sin resultados para "{query}"
            </div>
          )}

          {!query && (
            <div style={{padding:"20px",textAlign:"center",color:"var(--text-3)",fontSize:"13px"}}>
              Escribe para buscar jugadores, posts o módulos...
            </div>
          )}

          {groups.map(group=>(
            <div key={group.type}>
              <div style={{padding:"6px 18px 4px",fontSize:"10px",fontWeight:700,color:groupColors[group.type],letterSpacing:"0.1em",textTransform:"uppercase"}}>
                {groupLabels[group.type]}
              </div>
              {group.items.map((r,i)=>(
                <motion.button key={i} whileHover={{background:"var(--bg-elev-2)"}}
                  onClick={()=>{ r.action(); onClose(); }}
                  style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:"12px",padding:"10px 18px",background:"transparent",border:"none",cursor:"pointer",transition:"background 0.15s"}}>
                  <div style={{width:"32px",height:"32px",borderRadius:"var(--r-sm)",background:`${groupColors[group.type]}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>
                    {r.icon}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:"13px",color:"var(--text-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
                    <div style={{fontSize:"11px",color:"var(--text-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>
                  </div>
                  <span style={{marginLeft:"auto",fontSize:"11px",color:groupColors[group.type],flexShrink:0}}>→</span>
                </motion.button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        {results.length>0 && (
          <div style={{padding:"8px 18px",borderTop:"1px solid var(--border-soft)",display:"flex",gap:"12px",fontSize:"10px",color:"var(--text-4)"}}>
            <span>↵ abrir</span><span>Esc cerrar</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
