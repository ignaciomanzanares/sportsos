import DATOS from "./plantelArusa.json";

/**
 * Planteles del torneo, tal como quedaron registrados en la temporada.
 *
 * El caché que llena rugby-chile trae 88 jugadores de Old Reds, pero la lista
 * completa son 95: siete —Ángel López, Benjamín Jirón, Renato Martínez y
 * cuatro más— juegan uno o dos partidos, no anotan nunca, y en algún momento
 * dejaron de venir en la respuesta de arusa. Un jugador que existe y no anota
 * no es un jugador que no existe, y para un plantel es exactamente igual de
 * importante que el goleador.
 *
 * Por eso este archivo: la foto de la temporada que el otro proyecto tiene
 * guardada, que se une con lo que llega en vivo. Lo de arriba manda —siempre
 * está más al día— y esto solo agrega a los que faltan.
 */

/** Jugadores registrados de un club, en la forma que usa el resto de la app. */
export function plantelRegistrado(clubName) {
  const club = String(clubName || "").trim().toLowerCase();
  return Object.entries(DATOS)
    .filter(([, v]) => String(v.t).toLowerCase() === club)
    .map(([id, v]) => ({
      id,
      nombre: v.n,
      equipo: v.t,
      partidos: v.pj,
      puntos: v.pts,
      tries: v.tries,
      conversiones: v.conv,
      penales: v.pen,
    }));
}

/**
 * Une el plantel en vivo con el registrado, sin pisar lo que llegó en vivo.
 * Se comparan ids de ARUSA, que es el mismo identificador en las dos fuentes.
 */
export function unirConRegistrado(enVivo, clubName) {
  const porId = new Map(enVivo.map(j => [String(j.id), j]));
  for (const j of plantelRegistrado(clubName)) {
    if (!porId.has(String(j.id))) porId.set(String(j.id), j);
  }
  return [...porId.values()];
}
