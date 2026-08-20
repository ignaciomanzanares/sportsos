import { useState } from "react";
import { m as motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { useArusaTorneo, jugadoresDelClub } from "../lib/useArusaTorneo";

const DIVISIONES = [
  { id: "PRIMERA",        label: "Primera" },
  { id: "INTERMEDIA",     label: "Intermedia" },
  { id: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];

const COLUMNAS = [
  { key: "puntos",  label: "Pts" },
  { key: "tries",   label: "Tries" },
  { key: "partidos", label: "PJ" },
];

/**
 * Tabla del torneo y goleadores del club, con datos reales de ARUSA.
 *
 * Los nombres vienen como los escribe ARUSA y no se intentan cruzar con el
 * plantel del club: son dos registros distintos, y emparejarlos por nombre
 * ("SANTIAGO PRAT PAPIC" contra "Prat Papic Santiago") produciría errores
 * silenciosos justo donde importa. Mejor mostrar la fuente tal cual.
 */
export default function TorneoARUSA({ clubName, sportColor = "#1FA04A" }) {
  const [division, setDivision] = useState("PRIMERA");
  const [orden, setOrden]       = useState("puntos");
  const { posiciones, jugadores, cargando, error } = useArusaTorneo(division);

  const mios = jugadoresDelClub(jugadores, clubName, orden);
  const miFila = posiciones.find(p => p.equipo.toLowerCase() === String(clubName).toLowerCase());

  return (
    <div style={{ marginTop: "24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"10px", marginBottom:"14px" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:"15px" }}>🏆 Torneo ARUSA</div>
          <div style={{ ...ss.muted, fontSize:"11px", marginTop:"2px" }}>
            Posiciones y estadísticas oficiales
          </div>
        </div>
        <div style={{ display:"flex", gap:"6px" }}>
          {DIVISIONES.map(d => (
            <button key={d.id} onClick={()=>setDivision(d.id)}
              style={{ ...ss.btn, fontSize:"11px",
                background: division===d.id ? `${sportColor}22` : "var(--bg-elev-2)",
                color:      division===d.id ? sportColor : "var(--text-3)",
                border: `1px solid ${division===d.id ? sportColor : "var(--border-soft)"}` }}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {cargando && <div style={{ ...ss.card, ...ss.muted, fontSize:"12px" }}>Cargando datos del torneo…</div>}

      {!cargando && error && (
        <div style={{ ...ss.card, fontSize:"12px", color:"#EF4444" }}>
          No pudimos cargar los datos del torneo: {error.message}
        </div>
      )}

      {!cargando && !error && posiciones.length === 0 && (
        <div style={{ ...ss.card, ...ss.muted, fontSize:"12px" }}>
          Todavía no hay datos del torneo sincronizados para esta división.
        </div>
      )}

      {!cargando && posiciones.length > 0 && (
        <motion.div {...fadeUp} style={{ ...ss.card, marginBottom:"14px", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px", minWidth:"460px" }}>
            <thead>
              <tr style={{ color:"var(--text-4)", textAlign:"left" }}>
                <th style={{ padding:"6px 8px" }}>#</th>
                <th style={{ padding:"6px 8px" }}>Equipo</th>
                <th style={{ padding:"6px 8px" }}>PJ</th>
                <th style={{ padding:"6px 8px" }}>PG</th>
                <th style={{ padding:"6px 8px" }}>PP</th>
                <th style={{ padding:"6px 8px" }}>PF</th>
                <th style={{ padding:"6px 8px" }}>PC</th>
                <th style={{ padding:"6px 8px" }}>Dif</th>
                <th style={{ padding:"6px 8px", fontWeight:800 }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {posiciones.map(f => {
                const esMio = f.equipo.toLowerCase() === String(clubName).toLowerCase();
                return (
                  <tr key={f.equipo} style={{
                    background: esMio ? `${sportColor}18` : "transparent",
                    fontWeight: esMio ? 700 : 400,
                    borderTop: "1px solid var(--border-soft)" }}>
                    <td style={{ padding:"7px 8px" }}>{f.pos}</td>
                    <td style={{ padding:"7px 8px", color: esMio ? sportColor : "var(--text-1)" }}>{f.equipo}</td>
                    <td style={{ padding:"7px 8px" }}>{f.pj}</td>
                    <td style={{ padding:"7px 8px" }}>{f.pg}</td>
                    <td style={{ padding:"7px 8px" }}>{f.pp}</td>
                    <td style={{ padding:"7px 8px" }}>{f.pf}</td>
                    <td style={{ padding:"7px 8px" }}>{f.pc}</td>
                    <td style={{ padding:"7px 8px", color: f.dif > 0 ? "#22C55E" : f.dif < 0 ? "#EF4444" : "var(--text-3)" }}>
                      {f.dif > 0 ? "+" : ""}{f.dif}
                    </td>
                    <td style={{ padding:"7px 8px", fontWeight:800 }}>{f.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {miFila && (
            <div style={{ ...ss.muted, fontSize:"11px", marginTop:"10px" }}>
              {clubName} va {miFila.pos}º de {posiciones.length} · {miFila.pg} ganados de {miFila.pj}
            </div>
          )}
        </motion.div>
      )}

      {!cargando && mios.length > 0 && (
        <motion.div {...fadeUp} style={{ ...ss.card }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", flexWrap:"wrap", gap:"8px" }}>
            <div style={{ fontWeight:600, fontSize:"13px" }}>👤 Jugadores de {clubName} ({mios.length})</div>
            <div style={{ display:"flex", gap:"6px" }}>
              {COLUMNAS.map(c => (
                <button key={c.key} onClick={()=>setOrden(c.key)}
                  style={{ ...ss.btn, fontSize:"11px", padding:"4px 10px",
                    background: orden===c.key ? `${sportColor}22` : "var(--bg-elev-2)",
                    color: orden===c.key ? sportColor : "var(--text-3)", border:"1px solid var(--border-soft)" }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {mios.slice(0, 12).map((j, i) => (
            <div key={j.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"6px 0",
              borderTop: i ? "1px solid var(--border-soft)" : "none" }}>
              <span style={{ ...ss.muted, width:"18px", fontSize:"11px" }}>{i + 1}</span>
              <span style={{ flex:1, fontSize:"12px" }}>{j.nombre}</span>
              <span style={{ ...ss.muted, fontSize:"11px" }}>{j.partidos} PJ</span>
              <span style={{ fontSize:"12px" }}>{j.tries} tries</span>
              <span style={{ fontSize:"12px", fontWeight:700, color:sportColor, width:"52px", textAlign:"right" }}>
                {j.puntos} pts
              </span>
            </div>
          ))}
          <div style={{ ...ss.muted, fontSize:"10px", marginTop:"10px" }}>
            Los nombres vienen de ARUSA y no están cruzados con el plantel del club:
            son dos registros distintos.
          </div>
        </motion.div>
      )}
    </div>
  );
}
