import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import { useInjuryReports, playersEnAlerta } from "../lib/useInjuryReports";
import Badge from "./Badge";

const ESTADOS = [
  { id:"verde",    label:"Apto",     color:"#22C55E" },
  { id:"amarillo", label:"Molestia", color:"#F59E0B" },
  { id:"rojo",     label:"No apto",  color:"#EF4444" },
];

const colorDe = (s) => ESTADOS.find(e=>e.id===s)?.color || "#4A5568";
const fmtFecha = (f) => {
  // Las fechas vienen como YYYY-MM-DD; el mediodía evita que el cambio de
  // zona horaria las corra un día hacia atrás.
  const d = new Date(f + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day:"2-digit", month:"short" });
};

/**
 * Historial de lesiones del plantel: registrar un reporte y ver la evolución.
 *
 * El panel de Salud cuenta cuántos jugadores hay en cada color hoy. Esto
 * responde la pregunta que ese conteo no puede: quién lleva varias sesiones
 * arrastrando una molestia.
 */
export default function PanelLesiones({ clubId, players = [], currentUserId = null, showToast = () => {} }) {
  const { reports, error, addReport, removeReport } = useInjuryReports(clubId);
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [form, setForm] = useState({
    playerId: "", status: "amarillo", nota: "", sesion: "",
    fecha: new Date().toISOString().slice(0,10),
  });

  const alertas = playersEnAlerta(reports, players);
  const nombreDe = (id) => players.find(p=>p.id===id)?.name || "Jugador";

  const guardar = async () => {
    if (!form.playerId) { showToast("Elige un jugador","warning"); return; }
    setBusy(true);
    try {
      await addReport({ ...form, reportedBy: currentUserId });
      setForm(f => ({ ...f, playerId:"", nota:"", sesion:"" }));
      setAbierto(false);
      showToast("Reporte guardado","success");
    } catch (e) {
      showToast(e.message || "No se pudo guardar el reporte","warning");
    } finally { setBusy(false); }
  };

  const borrar = async (id) => {
    try { await removeReport(id); showToast("Reporte eliminado","success"); }
    catch (e) { showToast(e.message || "No se pudo eliminar","warning"); }
  };

  // Sin club no hay a qué tabla consultar: mejor no mostrar nada que mostrar
  // un historial vacío que parezca "tu plantel está sano".
  if (!clubId) return null;

  return (
    <div style={{ marginTop:"24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:"15px" }}>🩺 Historial de lesiones</div>
          <div style={{ ...ss.muted, fontSize:"11px", marginTop:"2px" }}>
            {reports.length ? `${reports.length} reporte${reports.length===1?"":"s"} registrado${reports.length===1?"":"s"}` : "Sin reportes todavía"}
          </div>
        </div>
        <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
          onClick={()=>setAbierto(v=>!v)}
          style={{ ...ss.btn, background: abierto ? "rgba(255,255,255,0.06)" : "#3B82F6",
                   color: abierto ? "var(--text-2)" : "#fff", fontSize:"12px" }}>
          {abierto ? "✕ Cancelar" : "⊕ Ingresar reporte"}
        </motion.button>
      </div>

      {error && (
        <div style={{ ...ss.card, marginBottom:"12px", border:"1px solid rgba(239,68,68,0.3)", fontSize:"12px", color:"#EF4444" }}>
          No pudimos cargar el historial: {error.message}
        </div>
      )}

      {alertas.length > 0 && (
        <motion.div {...fadeUp} style={{ ...ss.card, marginBottom:"12px",
          border:"1px solid rgba(245,158,11,0.3)", background:"linear-gradient(135deg,rgba(245,158,11,0.07),transparent)" }}>
          <div style={{ fontSize:"12px", fontWeight:700, color:"#F59E0B", marginBottom:"8px" }}>
            ⚠️ Sesiones consecutivas en alerta
          </div>
          {alertas.map(a => (
            <div key={a.playerId} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"12px", padding:"4px 0" }}>
              <span>{a.nombre}</span>
              <span style={{ ...ss.muted, fontSize:"11px" }}>
                {a.racha} seguidas · última: {a.ultimo.nota || ESTADOS.find(e=>e.id===a.ultimo.status)?.label}
              </span>
            </div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {abierto && (
          <motion.div {...scaleIn} style={{ ...ss.card, marginBottom:"14px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"10px", marginBottom:"10px" }}>
              <div>
                <div style={ss.label}>Jugador</div>
                <select value={form.playerId} onChange={e=>setForm(f=>({...f,playerId:e.target.value}))} style={ss.input}>
                  <option value="">Elige…</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div style={ss.label}>Fecha</div>
                <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={ss.input}/>
              </div>
              <div>
                <div style={ss.label}>Sesión</div>
                <input value={form.sesion} placeholder="Ej: Lunes" onChange={e=>setForm(f=>({...f,sesion:e.target.value}))} style={ss.input}/>
              </div>
            </div>

            <div style={ss.label}>Estado</div>
            <div style={{ display:"flex", gap:"8px", marginBottom:"10px", flexWrap:"wrap" }}>
              {ESTADOS.map(e => (
                <button key={e.id} onClick={()=>setForm(f=>({...f,status:e.id}))}
                  style={{ ...ss.btn, fontSize:"12px",
                    background: form.status===e.id ? `${e.color}22` : "var(--bg-elev-2)",
                    color: form.status===e.id ? e.color : "var(--text-3)",
                    border: `1px solid ${form.status===e.id ? e.color : "var(--border-soft)"}` }}>
                  {e.label}
                </button>
              ))}
            </div>

            <div style={ss.label}>Nota</div>
            <input value={form.nota} placeholder="Ej: Tensión en muslo derecho"
              onChange={e=>setForm(f=>({...f,nota:e.target.value}))} style={{ ...ss.input, marginBottom:"12px" }}/>

            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} disabled={busy}
              onClick={guardar}
              style={{ ...ss.btn, width:"100%", padding:"12px", background:"#3B82F6", color:"#fff",
                       opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
              {busy ? "Guardando…" : "Guardar reporte"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {reports.length === 0 ? (
        <div style={{ ...ss.card, textAlign:"center", padding:"28px 16px" }}>
          <div style={{ fontSize:"32px", marginBottom:"8px" }}>🩺</div>
          <div style={{ fontSize:"13px", fontWeight:600, marginBottom:"4px" }}>Sin reportes todavía</div>
          <div style={{ ...ss.muted, fontSize:"11px" }}>
            Registra el estado de un jugador después de cada sesión. Con dos o más
            seguidos en alerta, aparece acá arriba una advertencia.
          </div>
        </div>
      ) : reports.map((r,i) => (
        <motion.div key={r.id} {...fadeUp} transition={{duration:0.3,delay:Math.min(i,8)*0.04}}
          style={{ ...ss.card, marginBottom:"8px", display:"flex", alignItems:"center", gap:"12px",
                   borderLeft:`3px solid ${colorDe(r.status)}` }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:"13px", fontWeight:500 }}>{nombreDe(r.player_id)}</div>
            <div style={{ ...ss.muted, fontSize:"11px" }}>
              {fmtFecha(r.fecha)}{r.sesion ? ` · ${r.sesion}` : ""}{r.nota ? ` · ${r.nota}` : ""}
            </div>
          </div>
          <Badge color={colorDe(r.status)}>{ESTADOS.find(e=>e.id===r.status)?.label}</Badge>
          <button onClick={()=>borrar(r.id)} title="Eliminar reporte"
            style={{ background:"none", border:"none", color:"var(--text-4)", cursor:"pointer", fontSize:"14px" }}>✕</button>
        </motion.div>
      ))}
    </div>
  );
}
