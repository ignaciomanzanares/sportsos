import { useState, useEffect } from "react";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Una sola consulta por carga de página, compartida por todas las pantallas
// que ofrecen login social.
let pendiente = null;

/**
 * Qué proveedores de login social tiene realmente habilitados el backend.
 *
 * Supabase los expone en /auth/v1/settings sin necesidad de sesión. Sin esto
 * la app mostraba "Registrarme con Google" aunque el proveedor estuviera
 * apagado: al apretarlo, signInWithOAuth devolvía error y no pasaba nada
 * visible — el usuario quedaba mirando un botón muerto.
 */
export function getAuthProviders() {
  if (pendiente) return pendiente;
  if (!url || !key) return Promise.resolve({});
  pendiente = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then(r => r.ok ? r.json() : null)
    .then(s => s?.external || {})
    // Si la consulta falla no escondemos nada: es preferible un botón que
    // quizá falle a esconderle el login a alguien que sí podía usarlo.
    .catch(() => ({ google: true }));
  return pendiente;
}

export function useProviderEnabled(nombre) {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vivo = true;
    getAuthProviders().then(p => { if (vivo) setHabilitado(!!p[nombre]); });
    return () => { vivo = false; };
  }, [nombre]);
  return habilitado;
}
