import { useState, useEffect } from "react";

/**
 * Tabla de posiciones y estadísticas de jugadores del torneo (ARUSA/Leverade).
 *
 * Pasa por /api/leverade, que lee del caché que llena rugby-chile — nunca se
 * habla con arusa.cl desde el navegador. Si el caché está vacío devuelve
 * listas vacías: la vista dice que no hay datos en vez de inventarlos.
 */
export function useArusaTorneo(division = "PRIMERA") {
  const [posiciones, setPosiciones] = useState([]);
  const [jugadores, setJugadores]   = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    Promise.all([
      fetch(`/api/leverade?tipo=posiciones&division=${division}`).then(r => r.json()),
      fetch(`/api/leverade?tipo=estadisticas&division=${division}`).then(r => r.json()),
    ])
      .then(([pos, est]) => {
        if (!vivo) return;
        setPosiciones(pos.filas || []);
        setJugadores(est.filas || []);
        setError(null);
      })
      .catch(err => { if (vivo) setError(err); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [division]);

  return { posiciones, jugadores, cargando, error };
}

/** Estadísticas de un club, ordenadas por la columna que se pida. */
export function jugadoresDelClub(jugadores, clubName, ordenarPor = "puntos") {
  const club = String(clubName || "").trim().toLowerCase();
  return jugadores
    .filter(j => String(j.equipo || "").toLowerCase() === club)
    .sort((a, b) => (b[ordenarPor] || 0) - (a[ordenarPor] || 0));
}
