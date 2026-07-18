import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

/**
 * Carga el club real desde Supabase. Sin clubId devuelve null
 * (App.jsx usa CLUBS[sport] como vitrina de demo en ese caso).
 */
export function useClub(clubId) {
  const [club, setClub]     = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!clubId) { setClub(null); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .single();
    if (!error) setClub(data);
    setLoading(false);
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  return { club, loading, reload: load };
}
