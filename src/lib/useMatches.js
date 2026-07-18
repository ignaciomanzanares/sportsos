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

  const load = useCallback(async () => {
    if (!clubId) { setPartidos([]); return; }
    setLoading(true);
    try {
      const data = await getMatches(clubId);
      setPartidos(data.map(matchToPartido));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  return { partidos, loading, reload: load, setPartidos };
}
