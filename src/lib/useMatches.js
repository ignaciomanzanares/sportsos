import { useState, useEffect, useCallback } from "react";
import { getMatches, matchToPartido } from "./db";

/**
 * Carga partidos reales desde Supabase, mapeados a la forma que
 * leen los componentes (matchToPartido, ya definido en db.js).
 * Sin clubId devuelve [] (App.jsx usa MOCK_PARTIDOS como vitrina de demo).
 */
export function useMatches(clubId) {
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading]   = useState(false);
  // Antes había try/finally sin catch: si la consulta fallaba, la promesa se
  // rompía en silencio y el calendario mostraba "0 partidos" sin decir por qué
  // — indistinguible de un club que efectivamente no tiene partidos.
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    if (!clubId) { setPartidos([]); setError(null); return; }
    setLoading(true);
    try {
      const data = await getMatches(clubId);
      setPartidos(data.map(matchToPartido));
      setError(null);
    } catch (err) {
      console.error("[useMatches] no se pudieron cargar los partidos:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  return { partidos, loading, error, reload: load, setPartidos };
}
