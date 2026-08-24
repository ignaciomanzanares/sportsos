import { m as motion } from "framer-motion";
import { ss } from "../styles/tokens";
import { fadeUp } from "../styles/motion";

/**
 * Cuántos partidos jugó cada uno en Primera.
 *
 * En el rugby un "cap" es una presencia en el primer equipo, y esa es
 * justamente la distinción que el club quiere ver: sumar los partidos de
 * Intermedia y Pre-Intermedia infla el número y borra lo que se está
 * midiendo. Por eso este bloque va aparte de las otras estadísticas, que sí
 * son la suma de las tres divisiones.
 *
 * El dato sale de ARUSA, que publica los partidos jugados división por
 * división. No hace falta contar formaciones ni leer el minuto a minuto.
 */
export default function CapsPrimera({ players = [], sportColor = "#1FA04A" }) {
  const conCaps = players
    .filter(p => (p.stats?.capsPrimera || 0) > 0)
    .sort((a, b) => (b.stats.capsPrimera - a.stats.capsPrimera)
                 || String(a.name || "").localeCompare(String(b.name || "")));

  if (conCaps.length === 0) return null;

  const max = conCaps[0].stats.capsPrimera;
  const medalla = ["#D4AF37", "#94A3B8", "#CD7F32"];

  return (
    <motion.div {...fadeUp} style={{ ...ss.card, marginBottom: "16px" }}>
      <div style={{ fontWeight: 600, fontSize: "13px", display: "flex",
                    alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        🎖 Caps en Primera
        <span style={{ ...ss.muted, fontSize: "10px", fontWeight: 400 }}>· datos de ARUSA</span>
      </div>
      <div style={{ ...ss.muted, fontSize: "11px", marginBottom: "14px" }}>
        Partidos del primer equipo. Intermedia y Pre-Intermedia no cuentan.
      </div>

      {conCaps.map((p, i) => (
        <div key={p.id}
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0",
                   borderBottom: i < conCaps.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
          <span style={{ fontSize: "11px", color: "var(--text-4)", minWidth: "20px",
                         textAlign: "right", fontWeight: i < 3 ? 800 : 400,
                         ...(i < 3 ? { color: medalla[i] } : {}) }}>
            {i + 1}
          </span>
          <span style={{ flex: 1, fontSize: "12.5px", minWidth: 0, overflow: "hidden",
                         textOverflow: "ellipsis", whiteSpace: "nowrap",
                         color: i < 3 ? sportColor : "var(--text-1)",
                         fontWeight: i < 3 ? 600 : 400 }}>
            {p.name}
          </span>
          {/* La barra se lee de un vistazo mejor que el número solo: quién es
              titular fijo y quién entró dos veces se ve sin leer. */}
          <div style={{ width: "38%", maxWidth: "150px", height: "5px", borderRadius: "99px",
                        background: "var(--bg-elev-2)", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ width: `${(p.stats.capsPrimera / max) * 100}%`, height: "100%",
                          borderRadius: "99px",
                          background: i < 3 ? sportColor : "var(--text-4)" }}/>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 800, minWidth: "26px", textAlign: "right",
                         color: i < 3 ? sportColor : "var(--text-1)" }}>
            {p.stats.capsPrimera}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
