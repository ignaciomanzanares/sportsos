import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

/**
 * Carga el club real desde Supabase. Sin clubId devuelve null
 * (App.jsx usa CLUBS[sport] como vitrina de demo en ese caso).
 */
export function useClub(clubId) {
  const [club, setClub]     = useState(null);
  // Si la consulta falla y no lo contamos, el club queda en null y App.jsx cae
  // a CLUBS[sport]: al usuario le mostramos TOROS RC y su plantel inventado
  // como si fueran suyos. Con club_id hay club; que no cargue es un error que
  // hay que decir, no algo que se disimula con datos de demo.
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    if (!clubId) { setClub(null); setError(null); return; }
    const { data, error: err } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single();
    if (err) { setError(err); }
    else     { setClub(data); setError(null); }
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  return { club, error, reload: load };
}
