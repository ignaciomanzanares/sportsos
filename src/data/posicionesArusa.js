import DATOS from "./posicionesArusa.json";

/**
 * Puestos reales de los jugadores del torneo, por id de ARUSA.
 *
 * ARUSA publica tries y puntos pero no en qué puesto juega nadie. Estos 514
 * puestos salen del otro proyecto (rugby-chile / top10chile): están sacados a
 * mano de las nóminas del XV que cada club publica en Instagram fecha a fecha,
 * quedándose con el puesto que más veces jugó cada uno. Quien nunca apareció en
 * una nómina no tiene entrada — no hay puestos supuestos.
 *
 * Se copia el dato en vez de consultarlo: es un archivo estático que cambia una
 * vez por temporada, y hacer que SportOS dependa en caliente de otro proyecto
 * para llenar una columna sería pagar un acoplamiento permanente por un trabajo
 * de una sola vez.
 */

// Los puestos del otro proyecto son genéricos (PROP, sin distinguir cuál de los
// dos pilares); acá se usa el nombre con el que se habla en la cancha. Donde el
// genérico no distingue, se deja el genérico: inventar "Loosehead" cuando el
// dato solo dice "Prop" sería precisión falsa.
const NOMBRE = {
  PROP: "Prop",
  HOOKER: "Hooker",
  LOCK: "Lock",
  FLANKER: "Flanker",
  NUMBER_8: "Number 8",
  SCRUM_HALF: "Scrum-half",
  FLY_HALF: "Fly-half",
  CENTER: "Centre",
  WING: "Wing",
  FULLBACK: "Fullback",
};

/** Puesto de un jugador por su id de ARUSA, o null si no está en la lista. */
export function puestoDeArusa(arusaId) {
  const f = DATOS[String(arusaId || "")];
  return f?.p ? (NOMBRE[f.p] || null) : null;
}

/** Cuántos del plantel podrían recibir puesto desde esta lista. */
export function conPuestoDisponible(players) {
  return players.filter(p => !p.position && p.arusa_player_id && puestoDeArusa(p.arusa_player_id));
}
