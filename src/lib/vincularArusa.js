/**
 * Emparejar el plantel del club con los jugadores del torneo.
 *
 * Los dos registros escriben los nombres distinto: ARUSA manda "SANTIAGO PRAT
 * PAPIC" y el plantel dice "Prat Papic Santiago". Comparar los textos tal cual
 * no sirve, y comparar "parecido" tampoco: atribuirle los tries de uno a otro
 * es peor que no mostrar nada.
 *
 * Lo que se hace es comparar el CONJUNTO de palabras del nombre, sin acentos
 * ni mayúsculas. Así el orden deja de importar, que es la diferencia real
 * entre las dos fuentes. Y solo se propone automáticamente cuando el conjunto
 * calza exacto y hay UN solo candidato: si hay dos, decide una persona.
 *
 * El resultado se guarda en players.arusa_player_id, así que se hace una vez
 * y queda — no se adivina en cada carga.
 */

const RUIDO = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "van", "von"]);

/** "SANTIAGO PRAT PAPIC" → Set{papic, prat, santiago} */
export function clave(nombre) {
  return new Set(
    String(nombre || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // fuera acentos
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 1 && !RUIDO.has(t)),
  );
}

const mismoConjunto = (a, b) => a.size > 0 && a.size === b.size && [...a].every(t => b.has(t));

/**
 * Propone vínculos entre el plantel y las filas de ARUSA.
 *
 * Devuelve:
 *   exactos  — un solo candidato con el mismo conjunto de palabras
 *   ambiguos — más de un candidato: los decide una persona
 *   sinMatch — jugadores del plantel que no aparecen en el torneo (normal:
 *              juveniles o menores, gente que no jugó, o que está con otro nombre)
 */
export function proponerVinculos(plantel, jugadoresArusa) {
  const arusa = jugadoresArusa.map(j => ({ ...j, k: clave(j.nombre) }));
  const exactos = [], ambiguos = [], sinMatch = [];

  for (const p of plantel) {
    if (p.arusa_player_id) continue; // ya vinculado, no se vuelve a proponer
    const k = clave(p.name);
    if (k.size === 0) { sinMatch.push(p); continue; }

    const candidatos = arusa.filter(j => mismoConjunto(k, j.k));
    if (candidatos.length === 1)      exactos.push({ jugador: p, arusa: candidatos[0] });
    else if (candidatos.length > 1)   ambiguos.push({ jugador: p, candidatos });
    else                              sinMatch.push(p);
  }
  return { exactos, ambiguos, sinMatch };
}

/** Estadísticas de ARUSA de un jugador ya vinculado. */
export function statsDe(jugador, jugadoresArusa) {
  if (!jugador?.arusa_player_id) return null;
  return jugadoresArusa.find(j => String(j.id) === String(jugador.arusa_player_id)) || null;
}
