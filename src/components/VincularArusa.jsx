import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { supabase } from "../lib/supabase";
import { useArusaTorneo } from "../lib/useArusaTorneo";
import { proponerVinculos } from "../lib/vincularArusa";

const DIVISIONES = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

/**
 * Vincula cada jugador del plantel con su ficha del torneo.
 *
 * Se hace una vez y queda guardado en players.arusa_player_id: adivinar el
 * emparejamiento en cada carga sería lento y, peor, inestable — el mismo
 * jugador podría quedar apuntando a distinta persona según qué datos
 * estuvieran cargados ese día.
 */
export default function VincularArusa({ players = [], clubName, sportColor = "#1FA04A", showToast = () => {}, onVinculado = () => {} }) {
  // Las tres divisiones a la vez: un club reparte su plantel entre los tres
  // equipos, así que buscar solo en Primera dejaría fuera a la mayoría.
  const p1 = useArusaTorneo("PRIMERA");
  const p2 = useArusaTorneo("INTERMEDIA");
  const p3 = useArusaTorneo("PRE_INTERMEDIA");
  const cargando = p1.cargando || p2.cargando || p3.cargando;

  const delClub = useMemo(() => {
    const club = String(clubName || "").toLowerCase();
    const todos = [...p1.jugadores, ...p2.jugadores, ...p3.jugadores];
    const porId = new Map();
    for (const j of todos) if (String(j.equipo).toLowerCase() === club) porId.set(j.id, j);
    return [...porId.values()];
  }, [p1.jugadores, p2.jugadores, p3.jugadores, clubName]);

  const propuesta = useMemo(() => proponerVinculos(players, delClub), [players, delClub]);
  const yaVinculados = players.filter(p => p.arusa_player_id).length;

  const [guardando, setGuardando] = useState(false);
  const [elegido, setElegido] = useState({});

  const vincular = async (pares) => {
    if (pares.length === 0) return;
    setGuardando(true);
    try {
      for (const { jugadorId, arusaId } of pares) {
        const { error } = await supabase.from("players")
          .update({ arusa_player_id: String(arusaId) }).eq("id", jugadorId);
        if (error) throw error;
      }
      showToast(`${pares.length} jugador${pares.length === 1 ? "" : "es"} vinculado${pares.length === 1 ? "" : "s"}`, "success");
      onVinculado();
    } catch (e) {
      showToast("No se pudo vincular: " + e.message, "warning");
    } finally { setGuardando(false); }
  };

  if (cargando) return <div style={{ ...ss.card, ...ss.muted, fontSize:"12px", marginTop:"16px" }}>Buscando el plantel en el torneo…</div>;

  if (delClub.length === 0) return (
    <div style={{ ...ss.card, ...ss.muted, fontSize:"12px", marginTop:"16px" }}>
      No encontramos jugadores de {clubName} en el torneo. Si el club no juega ARUSA, esto no aplica.
    </div>
  );

  return (
    <motion.div {...fadeUp} style={{ ...ss.card, marginTop:"16px" }}>
      <div style={{ fontWeight:700, fontSize:"14px", marginBottom:"4px" }}>🔗 Vincular plantel con ARUSA</div>
      <div style={{ ...ss.muted, fontSize:"11px", marginBottom:"14px", lineHeight:1.5 }}>
        Empareja cada jugador con su ficha del torneo para traer sus tries, puntos y
        tarjetas. Se compara el nombre sin importar el orden ni los acentos, y solo
        se propone cuando hay un único candidato.
      </div>

      <div style={{ display:"flex", gap:"14px", flexWrap:"wrap", marginBottom:"14px", fontSize:"12px" }}>
        <span>✅ Vinculados: <strong>{yaVinculados}</strong></span>
        <span>🎯 Por vincular: <strong>{propuesta.exactos.length}</strong></span>
        <span>❓ Ambiguos: <strong>{propuesta.ambiguos.length}</strong></span>
        <span style={{ color:"var(--text-4)" }}>Sin ficha: {propuesta.sinMatch.length}</span>
      </div>

      {propuesta.exactos.length > 0 && (
        <>
          <motion.button whileTap={{ scale:0.98 }} disabled={guardando}
            onClick={()=>vincular(propuesta.exactos.map(e=>({ jugadorId:e.jugador.id, arusaId:e.arusa.id })))}
            style={{ ...ss.btn, background:sportColor, color:"#fff", fontSize:"12px", padding:"9px 16px", marginBottom:"12px",
              opacity: guardando ? 0.6 : 1 }}>
            {guardando ? "Vinculando…" : `Vincular los ${propuesta.exactos.length} que calzan exacto`}
          </motion.button>
          <div style={{ maxHeight:"180px", overflowY:"auto", marginBottom:"14px" }}>
            {propuesta.exactos.slice(0, 30).map(e => (
              <div key={e.jugador.id} style={{ fontSize:"11px", padding:"3px 0", color:"var(--text-3)" }}>
                {e.jugador.name} <span style={{ color:"var(--text-4)" }}>→</span> {e.arusa.nombre}
                <span style={{ color:"var(--text-4)" }}> · {e.arusa.puntos} pts</span>
              </div>
            ))}
          </div>
        </>
      )}

      {propuesta.ambiguos.length > 0 && (
        <div style={{ marginTop:"6px" }}>
          <div style={{ fontSize:"12px", fontWeight:600, marginBottom:"6px" }}>
            Estos tienen más de un candidato — elige tú
          </div>
          {propuesta.ambiguos.map(a => (
            <div key={a.jugador.id} style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"6px", flexWrap:"wrap" }}>
              <span style={{ fontSize:"12px", flex:1, minWidth:"140px" }}>{a.jugador.name}</span>
              <select value={elegido[a.jugador.id] || ""} onChange={e=>setElegido(p=>({ ...p, [a.jugador.id]: e.target.value }))}
                style={{ ...ss.input, width:"auto", fontSize:"11px", padding:"5px 8px" }}>
                <option value="">Elegir…</option>
                {a.candidatos.map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.puntos} pts</option>)}
              </select>
              <button disabled={!elegido[a.jugador.id] || guardando}
                onClick={()=>vincular([{ jugadorId:a.jugador.id, arusaId:elegido[a.jugador.id] }])}
                style={{ ...ss.btn, fontSize:"11px", padding:"5px 12px",
                  background: elegido[a.jugador.id] ? sportColor : "var(--bg-elev-2)",
                  color: elegido[a.jugador.id] ? "#fff" : "var(--text-4)" }}>
                Vincular
              </button>
            </div>
          ))}
        </div>
      )}

      {propuesta.exactos.length === 0 && propuesta.ambiguos.length === 0 && (
        <div style={{ ...ss.muted, fontSize:"12px" }}>
          No queda nadie por vincular automáticamente. Los {propuesta.sinMatch.length} restantes
          no aparecen en el torneo — normal en formativas o en quien no ha jugado.
        </div>
      )}
    </motion.div>
  );
}
