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
const DESDE_ARUSA = ["partidos", "tries", "conversiones", "penales", "puntos"];

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
    // `arusaStats` deja ver de dónde salió cada número, para que la pantalla
    // pueda decirlo en vez de presentarlo como carga del club.
    return { ...p, stats, arusaStats: a };
  });
}

/** ¿Este número vino del torneo y no del club? */
export function vieneDeArusa(player, clave) {
  return player?.arusaStats?.[clave] != null && player.arusaStats[clave] === player.stats?.[clave];
}
