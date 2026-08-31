import { capsHistoricos } from "../data/capsHistoricos";

/**
 * Pegar las estadísticas del torneo al plantel, una sola vez y para toda la app.
 *
 * Los tries y los puntos existen —los publica ARUSA, los mostramos en la tabla
 * del torneo— pero el plantel decía 0 en todas sus columnas. El cruce estaba
 * hecho en una sola pantalla; el resto seguía leyendo `players[].stats`, que
 * para un club que nunca cargó estadísticas a mano está vacío. Dos números
 * distintos para el mismo jugador en dos pantallas es peor que no tener
 * ninguno.
 *
 * Se enriquece en App.jsx, sobre la lista que reciben todas las vistas, así no
 * hay una pantalla "con datos" y otra sin ellos. Lo que el club cargue a mano
 * manda: solo se rellena lo que falta.
 */

// Lo que ARUSA publica por jugador. Minutos y tackles no están y no se
// inventan: quedan sin dato, que es lo que son.
const DESDE_ARUSA = ["partidos", "tries", "conversiones", "penales", "puntos", "capsPrimera"];

/**
 * Campos que esta enriquecida agrega y que NO son columnas de la tabla.
 *
 * El formulario de edición manda de vuelta el jugador entero, así que un campo
 * calculado viaja a Supabase como si fuera columna y la escritura falla con
 * "Could not find the 'arusaStats' column". Se declaran acá, al lado de donde
 * se crean, y usePlayers los saca antes de guardar.
 */
export const CAMPOS_DERIVADOS = ["arusaStats"];

/**
 * Partidos jugados de verdad en lo que va del año.
 *
 * La tabla de ARUSA se queda corta en Primera: cuenta los ingresos desde la
 * banca que alguien anotó en la planilla, y se le pasa cerca de un tercio. En
 * 2026, comparada con las nóminas partido por partido, le faltaban 52
 * presencias — a Joaquín Manzanares le daba 9 donde jugó 13.
 *
 * Nuestro conteo sale de las nóminas (scripts/caps-arusa.mjs) y es mejor,
 * salvo en los 6 partidos que ARUSA nunca cargó: ahí no hay nómina que leer y
 * el que se queda corto es el nuestro. Ninguna de las dos fuentes infla, así
 * que para Primera se toma la mayor, y las otras divisiones se suman aparte
 * tal como vienen.
 */
function partidosCorregidos(player, a) {
  const enPrimeraArusa = a.capsPrimera || 0;
  const otrasDivisiones = Math.max(0, (a.partidos || 0) - enPrimeraArusa);
  const nuestro = capsHistoricos(player)?.porAnio?.[new Date().getFullYear()] || 0;
  return Math.max(nuestro, enPrimeraArusa) + otrasDivisiones;
}

export function enriquecerConArusa(players, jugadoresArusa) {
  if (!jugadoresArusa?.length) return players;
  const porId = new Map(jugadoresArusa.map(j => [String(j.id), j]));

  return players.map(p => {
    const a = p.arusa_player_id ? porId.get(String(p.arusa_player_id)) : null;
    if (!a) return p;
    const stats = { ...(p.stats || {}) };
    for (const k of DESDE_ARUSA) {
      if (stats[k] == null && a[k] != null) stats[k] = a[k];
    }
    // Solo si el número vino del torneo: lo que el club cargue a mano manda,
    // igual que arriba.
    if (p.stats?.partidos == null) stats.partidos = partidosCorregidos(p, a);
    // `arusaStats` deja ver de dónde salió cada número, para que la pantalla
    // pueda decirlo en vez de presentarlo como carga del club.
    return { ...p, stats, arusaStats: a };
  });
}

/** ¿Este número vino del torneo y no del club? */
export function vieneDeArusa(player, clave) {
  return player?.arusaStats?.[clave] != null && player.arusaStats[clave] === player.stats?.[clave];
}
