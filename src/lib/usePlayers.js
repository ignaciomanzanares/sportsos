import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { PLAYERS_RUGBY } from "../data/players";
import { CAMPOS_DERIVADOS } from "./statsArusa";

// PLAYERS_RUGBY usa nombres de campo viejos (pos/num/med/cuota/cat) que no
// coinciden con las columnas reales de Supabase (position/number/med_status/
// cuota_status/category) — normalizado acá para que el modo demo use
// exactamente los mismos nombres que los datos reales, y así el resto de
// la app (que espera esos nombres) no se rompa en preview.
const DEMO_PLAYERS = PLAYERS_RUGBY.map(({ pos, num, med, cuota, cat, hiaReason, gym, ...rest }) => ({
  ...rest,
  position: pos,
  number: num,
  med_status: med,
  cuota_status: cuota,
  category: cat,
  hia_reason: hiaReason || null,
}));

/**
 * Hook que carga jugadores desde Supabase.
 * Sin club_id (modo preview de rol) usa datos de demo en memoria, sin persistir.
 */
/**
 * Saca lo que la app calcula y la tabla no tiene.
 *
 * También saca `stats`: sí es columna, pero la lista que ven las pantallas
 * viene mezclada con los tries y puntos del torneo. Guardarla convertiría un
 * dato de ARUSA en un dato "cargado por el club", que después no se
 * actualizaría nunca más. Ninguna pantalla edita stats, así que no se pierde
 * nada al no mandarla.
 */
function soloColumnas(obj) {
  const limpio = { ...obj };
  for (const k of [...CAMPOS_DERIVADOS, "stats"]) delete limpio[k];
  return limpio;
}

export function usePlayers(clubId) {
  const [players, setPlayers]   = useState(clubId ? [] : DEMO_PLAYERS);
  const [error,   setError]     = useState(null);
  const isReal = !!clubId;

  const load = useCallback(async () => {
    if (!isReal) return;
    try {
      // Dos fuentes, a propósito.
      //
      // `plantel_publico` es la vista que puede leer cualquier miembro del
      // club: nombre, puesto, categoría, estado médico. Lo que hace falta
      // para armar una nómina y nada más.
      //
      // `players` es la tabla, y el RLS decide cuánto devuelve: al cuerpo
      // técnico el plantel entero, al jugador su propia ficha y nada más.
      // Antes cualquier jugador se bajaba los 145 RUT y teléfonos del club.
      //
      // Se superpone lo segundo sobre lo primero, así que cada pantalla
      // recibe una sola lista y no tiene que saber nada de esto: el que ve
      // más, ve más, sin ninguna rama por rol en las vistas.
      const [publico, completo] = await Promise.all([
        supabase.from("plantel_publico").select("*").eq("club_id", clubId).order("number"),
        supabase.from("players").select("*").eq("club_id", clubId).order("number"),
      ]);
      if (publico.error && completo.error) throw publico.error;

      const porId = new Map((publico.data || []).map(p => [p.id, p]));
      for (const p of completo.data || []) porId.set(p.id, { ...porId.get(p.id), ...p });
      const lista = [...porId.values()].sort(
        (a, b) => (a.number ?? 999) - (b.number ?? 999));
      setPlayers(lista);
    } catch (e) {
      setError(e.message);
    }
  }, [clubId, isReal]);

  useEffect(() => { load(); }, [load]);

  const addPlayer = async (player) => {
    if (!isReal) { setPlayers(p => [...p, { ...player, id: Date.now() }]); return; }
    const { data, error: err } = await supabase
      .from("players")
      .insert({ ...player, club_id: clubId })
      .select().single();
    if (err) throw err;
    setPlayers(p => [...p, data]);
    return data;
  };

  const updatePlayer = async (id, changes) => {
    if (!isReal) { setPlayers(p => p.map(x => x.id === id ? { ...x, ...changes } : x)); return; }
    const { data, error: err } = await supabase
      .from("players").update(soloColumnas(changes)).eq("id", id).select().single();
    if (err) throw err;
    setPlayers(p => p.map(x => x.id === id ? data : x));
    return data;
  };

  const removePlayer = async (id) => {
    if (!isReal) { setPlayers(p => p.filter(x => x.id !== id)); return; }
    const { error: err } = await supabase.from("players").delete().eq("id", id);
    if (err) throw err;
    setPlayers(p => p.filter(x => x.id !== id));
  };

  return { players, error, addPlayer, updatePlayer, removePlayer, reload: load };
}
