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

const DIVISIONES_ADULTAS = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

/**
 * Estadísticas de jugador de las tres divisiones adultas, en una sola lista.
 *
 * Un jugador puede aparecer en más de una división en la misma temporada (sube
 * de Intermedia a Primera y sigue anotando en las dos), así que los registros
 * del mismo id se suman: mostrar solo el de Primera le borraría los tries del
 * resto del año.
 */
export function useArusaJugadores(activo = true, clubName = null) {
  const [jugadores, setJugadores] = useState([]);

  useEffect(() => {
    if (!activo) { setJugadores([]); return; }
    let vivo = true;
    Promise.all(
      DIVISIONES_ADULTAS.map(d =>
        fetch(`/api/leverade?tipo=estadisticas&division=${d}`).then(r => r.json()).catch(() => ({})),
      ),
    ).then(res => {
      if (!vivo) return;
      const acc = new Map();
      for (const r of res) for (const j of r.filas || []) {
        const id = String(j.id ?? j.nombre);
        const prev = acc.get(id);
        acc.set(id, prev ? {
          ...prev,
          tries:    (prev.tries || 0)    + (j.tries || 0),
          puntos:   (prev.puntos || 0)   + (j.puntos || 0),
          partidos: (prev.partidos || 0) + (j.partidos || 0),
        } : { ...j, id });
      }
      if (!clubName) { setJugadores([...acc.values()]); return; }
      // El caché en vivo perdió a siete jugadores del club —los que jugaron
      // uno o dos partidos y no anotaron nunca—, así que sus estadísticas
      // salían en blanco aunque existen. Se completan con la foto guardada.
      //
      // La foto son 723 jugadores de todos los clubes del torneo (83 kB) y de
      // ahí se usan los ~95 del club propio. Se carga bajo demanda para que no
      // viaje en el arranque: el jugador que entra a ver su cuota se bajaba el
      // plantel entero de la ARUSA sin necesitarlo.
      import("../data/plantelArusa").then(({ unirConRegistrado }) => {
        if (vivo) setJugadores(unirConRegistrado([...acc.values()], clubName));
      });
    });
    return () => { vivo = false; };
  }, [activo, clubName]);

  return jugadores;
}

/** Estadísticas de un club, ordenadas por la columna que se pida. */
export function jugadoresDelClub(jugadores, clubName, ordenarPor = "puntos") {
  const club = String(clubName || "").trim().toLowerCase();
  return jugadores
    .filter(j => String(j.equipo || "").toLowerCase() === club)
    .sort((a, b) => (b[ordenarPor] || 0) - (a[ordenarPor] || 0));
}
