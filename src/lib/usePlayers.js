import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { saveNotification } from "./db";

/**
 * Hook que carga jugadores desde Supabase.
 * Sin club_id (modo preview de rol) trabaja en memoria, sin persistir.
 */
export function usePlayers(clubId) {
  const [players, setPlayers]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);
  const isReal = !!clubId;

  const load = useCallback(async () => {
    if (!isReal) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("players")
        .select("*")
        .eq("club_id", clubId)
        .order("number");
      if (err) throw err;
      setPlayers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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

  // Importa o actualiza jugadores desde un Excel (ver src/lib/playerImport.js).
  // Filas con RUT: upsert por (club_id, rut) — re-subir la misma nómina
  // actualiza a los jugadores existentes en vez de duplicarlos.
  // Filas sin RUT: se intenta calzar por nombre exacto dentro del club;
  // si no existe, se crea.
  const importOrUpdatePlayers = async (rows) => {
    if (!isReal) {
      setPlayers(p => [...p, ...rows.map((pl, i) => ({ ...pl, id: Date.now() + i }))]);
      return { total: rows.length };
    }

    const withRut    = rows.filter(p => p.rut);
    const withoutRut = rows.filter(p => !p.rut);

    if (withRut.length > 0) {
      const { error: err } = await supabase
        .from("players")
        .upsert(withRut.map(p => ({ ...p, club_id: clubId })), { onConflict: "club_id,rut" });
      if (err) throw err;
    }

    if (withoutRut.length > 0) {
      const { data: existing } = await supabase.from("players").select("id,name").eq("club_id", clubId);
      const byName = new Map((existing || []).map(p => [p.name.trim().toLowerCase(), p.id]));

      const toInsert = [];
      for (const p of withoutRut) {
        const id = byName.get(p.name.trim().toLowerCase());
        if (id) await supabase.from("players").update(p).eq("id", id);
        else toInsert.push({ ...p, club_id: clubId });
      }
      if (toInsert.length > 0) {
        const { error: err } = await supabase.from("players").insert(toInsert);
        if (err) throw err;
      }
    }

    await load();
    saveNotification({ clubId, type:"plantel", title:"Plantel actualizado",
      body:`${rows.length} jugador${rows.length>1?"es":""} importado${rows.length>1?"s":""}/actualizado${rows.length>1?"s":""} desde Excel` }).catch(()=>{});
    return { total: rows.length };
  };

  const updatePlayer = async (id, changes) => {
    if (!isReal) { setPlayers(p => p.map(x => x.id === id ? { ...x, ...changes } : x)); return; }
    const { data, error: err } = await supabase
      .from("players").update(changes).eq("id", id).select().single();
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

  return { players, loading, error, addPlayer, importOrUpdatePlayers, updatePlayer, removePlayer, reload: load };
}
