import { m as motion } from "framer-motion";
import { ss } from "../styles/tokens";
import { fadeUp } from "../styles/motion";
import { capsHistoricos, HISTORICO_DESDE } from "../data/capsHistoricos";

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
  const anioEnCurso = new Date().getFullYear();

  // Carrera completa: lo guardado de 2021 a 2025 más lo que va del año, que
  // llega en vivo desde la API. Se suman en vez de guardar el año en curso
  // en el archivo, así no hay que regenerarlo cada fecha.
  const conCaps = players
    .map(p => {
      const c = capsHistoricos(p);
      return { ...p, _anio: c?.porAnio?.[anioEnCurso] || 0, _carrera: c?.total || 0 };
    })
    .filter(p => p._carrera > 0)
    .sort((a, b) => (b._carrera - a._carrera)
                 || String(a.name || "").localeCompare(String(b.name || "")));

  if (conCaps.length === 0) return null;

  const max = conCaps[0]._carrera;
  const medalla = ["#D4AF37", "#94A3B8", "#CD7F32"];

  return (
    <motion.div {...fadeUp} style={{ ...ss.card, marginBottom: "16px" }}>
      <div style={{ fontWeight: 600, fontSize: "13px", display: "flex",
                    alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        🎖 Caps del primer equipo
        <span style={{ ...ss.muted, fontSize: "10px", fontWeight: 400 }}>· datos de ARUSA</span>
      </div>
      {/* Se dice qué se está contando y qué no: un número de caps sin la regla
          al lado se presta a que cada uno entienda otra cosa. */}
      <div style={{ ...ss.muted, fontSize: "11px", marginBottom: "14px", lineHeight: 1.5 }}>
        Desde {HISTORICO_DESDE}: titular, o entrando desde la banca. Intermedia y
        Pre-Intermedia no cuentan.
        {/* Se dice que el número es un piso porque lo es: la nómina publicada
            está completa, pero los cambios los anota a mano quien hace la
            planilla y se le pasan cerca de un tercio. Presentarlo como total
            exacto sería mentir justo sobre los que más rotan. */}
        <span style={{ display:"block", marginTop:"5px", color:"var(--text-4)" }}>
          Son un mínimo: arusa no registra todos los cambios, así que a varios
          les faltan partidos de banca.
        </span>
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
            <div style={{ width: `${(p._carrera / max) * 100}%`, height: "100%",
                          borderRadius: "99px",
                          background: i < 3 ? sportColor : "var(--text-4)" }}/>
          </div>
          {/* El desglose importa: 40 caps de los cuales 6 son de este año
              cuenta una historia distinta a 40 todos de este año. */}
          {p._anio > 0 && (
            <span style={{ fontSize: "10px", color: "var(--text-4)", flexShrink: 0 }}
              title={`${p._anio} en ${anioEnCurso}`}>
              +{p._anio}
            </span>
          )}
          <span style={{ fontSize: "13px", fontWeight: 800, minWidth: "26px", textAlign: "right",
                         color: i < 3 ? sportColor : "var(--text-1)" }}>
            {p._carrera}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
