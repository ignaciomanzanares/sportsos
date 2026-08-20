import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { saveNotification } from "./db";
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

      // Antes esto mandaba un UPDATE por jugador, uno detrás de otro: importar
      // un plantel de 140 eran 140 viajes al servidor en fila. Y ninguno miraba
      // si había fallado, así que un rechazo de la base se veía igual que un
      // import perfecto: el aviso decía "140 importados" pasara lo que pasara.
      // Ahora es una sola escritura por lote, y si falla se entera el usuario.
      const toInsert = [];
      const toUpdate = [];
      for (const p of withoutRut) {
        const id = byName.get(p.name.trim().toLowerCase());
        if (id) toUpdate.push({ ...p, id, club_id: clubId });
        else    toInsert.push({ ...p, club_id: clubId });
      }
      if (toUpdate.length > 0) {
        const { error: err } = await supabase.from("players").upsert(toUpdate);
        if (err) throw err;
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

  return { players, loading, error, addPlayer, importOrUpdatePlayers, updatePlayer, removePlayer, reload: load };
}
