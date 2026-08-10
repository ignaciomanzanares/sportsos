import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

/**
 * Reportes de lesión del club, del más reciente al más antiguo.
 *
 * Sin clubId devuelve una lista vacía: el modo demo no tiene club contra el
 * cual consultar, y datos inventados acá harían creer al usuario que su
 * plantel tiene lesionados que no existen.
 */
export function useInjuryReports(clubId) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    if (!clubId) { setReports([]); setError(null); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from("injury_reports")
      .select("*")
      .eq("club_id", clubId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (err) setError(err);
    else { setReports(data || []); setError(null); }
    setLoading(false);
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  const addReport = async ({ playerId, status, nota, sesion, fecha, reportedBy }) => {
    const { data, error: err } = await supabase
      .from("injury_reports")
      .insert({
        club_id: clubId, player_id: playerId, status,
        nota: nota?.trim() || null, sesion: sesion?.trim() || null,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        reported_by: reportedBy || null,
      })
      .select().single();
    if (err) throw err;
    setReports(prev => [data, ...prev]);
    return data;
  };

  const removeReport = async (id) => {
    const { error: err } = await supabase.from("injury_reports").delete().eq("id", id);
    if (err) throw err;
    setReports(prev => prev.filter(r => r.id !== id));
  };

  return { reports, loading, error, addReport, removeReport, reload: load };
}

/**
 * Jugadores con dos o más reportes consecutivos fuera de verde.
 *
 * Es la señal que la rama demo mostraba como alerta y la razón de ser del
 * historial: un amarillo aislado es ruido, dos seguidos es una lesión que
 * viene. Se mira solo la racha más reciente de cada jugador.
 */
export function playersEnAlerta(reports, players) {
  const porJugador = new Map();
  for (const r of reports) {
    if (!porJugador.has(r.player_id)) porJugador.set(r.player_id, []);
    porJugador.get(r.player_id).push(r);
  }

  const alerta = [];
  for (const [playerId, lista] of porJugador) {
    let racha = 0;
    for (const r of lista) {          // ya vienen del más reciente al más viejo
      if (r.status === "verde") break;
      racha++;
    }
    if (racha >= 2) {
      const p = players.find(x => x.id === playerId);
      alerta.push({ playerId, nombre: p?.name || "Jugador", racha, ultimo: lista[0] });
    }
  }
  return alerta.sort((a, b) => b.racha - a.racha);
}
