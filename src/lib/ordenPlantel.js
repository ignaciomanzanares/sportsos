/**
 * El orden en que conviene mirar un plantel.
 *
 * Primero los que juegan el torneo —tienen ficha en ARUSA, partidos y tries—,
 * después los que no. Los 52 de Old Reds que no aparecen en ARUSA no jugaron
 * esta temporada: pueden ser gente que dejó el club, y mezclarlos con los
 * activos hace que buscar a alguien sea recorrer una lista con la mitad de
 * ruido. No se ocultan, se van abajo.
 *
 * Dentro de cada grupo, por partidos jugados y después alfabético.
 */
export function ordenarPlantel(players) {
  return [...players].sort((a, b) => {
    const ja = a.arusa_player_id ? 0 : 1;
    const jb = b.arusa_player_id ? 0 : 1;
    if (ja !== jb) return ja - jb;
    const pa = a.stats?.partidos ?? -1;
    const pb = b.stats?.partidos ?? -1;
    if (pa !== pb) return pb - pa;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}
