import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

/**
 * Días en que el club entrena: lunes, martes y jueves.
 *
 * El selector era un campo de fecha libre, así que ofrecía los 365 días del
 * año para marcar asistencia a entrenamientos que solo ocurren tres veces por
 * semana. Elegir entre los días que existen es más rápido que escribir una
 * fecha, y no deja marcar un domingo por error.
 */
export const DIAS_ENTRENAMIENTO = [1, 2, 4]; // getDay(): 1=lunes, 2=martes, 4=jueves

/** Las últimas `cantidad` fechas de entrenamiento hasta `hasta` (incluida). */
export function fechasDeEntrenamiento(hasta, cantidad = 6) {
  const out = [];
  const d = new Date(hasta + "T12:00:00");
  while (out.length < cantidad) {
    if (DIAS_ENTRENAMIENTO.includes(d.getDay())) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

/**
 * Hook para asistencia — guarda en Supabase.
 * En modo demo, solo estado local.
 */
/**
 * @param avisar  callback para contarle al usuario que algo falló. Sin esto,
 *   cuando la escritura no pasaba —RLS, red caída— la marca aparecía y
 *   desaparecía sola y el entrenador se quedaba sin saber si quedó guardada.
 *   Una asistencia que se revierte en silencio es peor que una que no se
 *   guarda: parece que sí.
 */
export function useAttendance(clubId, date, avisar = () => {}) {
  const [present, setPresent] = useState({});
  const [saving,  setSaving]  = useState({});
  const isReal = !!clubId;

  const load = useCallback(async () => {
    if (!isReal) return;
    const { data, error } = await supabase
      .from("attendance")
      .select("player_id, present")
      .eq("club_id", clubId)
      .eq("date", date);
    if (error) return;
    const map = {};
    data.forEach(r => { map[r.player_id] = r.present; });
    setPresent(map);
  }, [clubId, date, isReal]);

  const toggle = async (playerId) => {
    const next = !present[playerId];
    setPresent(p => ({ ...p, [playerId]: next }));
    if (!isReal) return;
    setSaving(s => ({ ...s, [playerId]: true }));
    try {
      // onConflict explícito: la tabla tiene unique(player_id,date), no la
      // PK (id) — sin esto, cada toggle insertaba una fila nueva y la
      // segunda marcación del mismo día violaba la restricción unique en
      // silencio (el error nunca se revisaba).
      const { error } = await supabase.from("attendance").upsert({
        club_id: clubId, player_id: playerId, date, present: next,
      }, { onConflict: "player_id,date" });
      if (error) throw error;
    } catch (e) {
      // revertir si falla, y decirlo
      setPresent(p => ({ ...p, [playerId]: !next }));
      avisar("No se pudo guardar la asistencia: " + (e?.message || "sin conexión"));
    } finally {
      setSaving(s => ({ ...s, [playerId]: false }));
    }
  };

  // Marca a varios de una vez ("marcar todos" / "limpiar"). Uno por uno eran
  // 124 clics y 124 viajes a la base.
  const marcarVarios = async (playerIds, valor) => {
    if (playerIds.length === 0) return;
    const antes = present;
    setPresent(p => {
      const n = { ...p };
      playerIds.forEach(id => { n[id] = valor; });
      return n;
    });
    if (!isReal) return;
    const { error } = await supabase.from("attendance").upsert(
      playerIds.map(id => ({ club_id: clubId, player_id: id, date, present: valor })),
      { onConflict: "player_id,date" },
    );
    if (error) {
      setPresent(antes);
      avisar("No se pudo guardar la asistencia: " + error.message);
    }
  };

  return { present, saving, toggle, marcarVarios, load };
}

/**
 * Quiénes estuvieron el entrenamiento anterior a `fecha`.
 *
 * Los que vinieron el lunes son casi los mismos que vienen el martes, así que
 * ponerlos primero convierte pasar lista en confirmar una lista en vez de
 * buscar 30 nombres entre 124.
 */
export function useAsistenciaPrevia(clubId, fecha) {
  const [previos, setPrevios] = useState(null); // null = todavía no se sabe

  useEffect(() => {
    if (!clubId || !fecha) { setPrevios(null); return; }
    let vivo = true;
    supabase.from("attendance")
      .select("player_id, date")
      .eq("club_id", clubId).eq("present", true).lt("date", fecha)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (!vivo) return;
        const filas = data || [];
        if (filas.length === 0) { setPrevios(null); return; }
        // Solo la sesión inmediatamente anterior, no el acumulado: "vino la
        // vez pasada" y "viene siempre" son dos preguntas distintas.
        const ultima = filas[0].date;
        setPrevios(new Set(filas.filter(f => f.date === ultima).map(f => f.player_id)));
      });
    return () => { vivo = false; };
  }, [clubId, fecha]);

  return previos;
}

/**
 * Cuántos entrenamientos lleva cada jugador.
 *
 * Sirve para ordenar la lista: con el plantel de 124 nombres en orden de
 * importación, encontrar a alguien es un barrido visual. Los que más vienen
 * arriba es el orden en que el entrenador los busca.
 */
export function useAttendanceStats(clubId) {
  const [conteo, setConteo] = useState({});

  useEffect(() => {
    if (!clubId) { setConteo({}); return; }
    let vivo = true;
    supabase.from("attendance").select("player_id, present").eq("club_id", clubId).eq("present", true)
      .then(({ data }) => {
        if (!vivo) return;
        const c = {};
        (data || []).forEach(r => { c[r.player_id] = (c[r.player_id] || 0) + 1; });
        setConteo(c);
      });
    return () => { vivo = false; };
  }, [clubId]);

  return conteo;
}
