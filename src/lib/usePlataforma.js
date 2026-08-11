import { useState, useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Cifras reales de la plataforma para el panel de superadmin.
 *
 * Antes eran cuatro números escritos a mano — 24 clubes, $1.840 de comisiones,
 * 387 usuarios, 94% de retención — sobre una plataforma que tiene un club y
 * nueve usuarios. Un panel de control que inventa sus propias cifras no sirve
 * para controlar nada.
 *
 * Solo se cuenta lo que existe. Comisiones y retención no tienen de dónde
 * salir: no hay tabla de facturación ni registro de sesiones, así que no se
 * muestran hasta que los haya.
 */
export function usePlataforma() {
  const [datos, setDatos] = useState({ clubes: null, usuarios: null });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase.from("clubs").select("id", { count: "exact", head: true }).eq("suspended", false),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ])
      .then(([c, u]) => {
        if (!vivo) return;
        setDatos({ clubes: c.count ?? null, usuarios: u.count ?? null });
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  return { ...datos, cargando };
}
