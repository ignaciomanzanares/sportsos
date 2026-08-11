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
 * ¿`corto` es el mismo nombre que `largo`, escrito con menos apellidos?
 *
 * El plantel dice "Infante Tomás" y ARUSA "Tomás Infante Fantuzzi": mismo
 * jugador, un apellido de diferencia. Comparar conjuntos exactos los daba por
 * personas distintas y terminamos con dos Tomás Infante.
 *
 * Se exige que TODAS las palabras del corto estén en el largo y que sean al
 * menos dos (nombre y apellido): con una sola, "Pérez" calzaría con los siete
 * Pérez del club.
 */
const contenidoEn = (corto, largo) =>
  corto.size >= 2 && corto.size < largo.size && [...corto].every(t => largo.has(t));

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
    if (candidatos.length === 1)    { exactos.push({ jugador: p, arusa: candidatos[0] }); continue; }
    if (candidatos.length > 1)      { ambiguos.push({ jugador: p, candidatos }); continue; }

    // Segunda pasada: el mismo nombre con un apellido de más en ARUSA. Si hay
    // un solo candidato es tan seguro como el conjunto exacto; si hay varios,
    // decide una persona.
    const parciales = arusa.filter(j => contenidoEn(k, j.k));
    if (parciales.length === 1)      exactos.push({ jugador: p, arusa: parciales[0] });
    else if (parciales.length > 1)   ambiguos.push({ jugador: p, candidatos: parciales });
    else                             sinMatch.push(p);
  }
  return { exactos, ambiguos, sinMatch };
}

/**
 * Jugadores del torneo que no están en el plantel.
 *
 * El plantel se cargó a mano desde una planilla y quedó incompleto: faltaban
 * cuatro Pérez, dos Barrena, un Flores. ARUSA tiene la ficha de todos los que
 * jugaron, así que sirve para completar en vez de volver a tipear nombres.
 *
 * Se excluye a quien ya está vinculado (por id) y a quien calza por nombre con
 * alguien del plantel, aunque el vínculo todavía no se haya guardado — si no,
 * se ofrecería agregar un duplicado de alguien que ya está.
 */
export function arusaSinPlantel(plantel, jugadoresArusa) {
  const vinculados = new Set(plantel.map(p => String(p.arusa_player_id || "")).filter(Boolean));
  const clavesPlantel = plantel.map(p => clave(p.name)).filter(k => k.size > 0);
  return jugadoresArusa.filter(j => {
    if (vinculados.has(String(j.id))) return false;
    const k = clave(j.nombre);
    if (clavesPlantel.some(kp => mismoConjunto(k, kp))) return false;
    // Y tampoco si es alguien del plantel escrito con menos apellidos, y no
    // hay duda de quién: así fue como se coló un segundo Tomás Infante.
    return clavesPlantel.filter(kp => contenidoEn(kp, k)).length !== 1;
  });
}

/**
 * "filippo borghi" / "DIego Bozzo Pizarro" → "Filippo Borghi".
 * ARUSA no tiene criterio de mayúsculas y el plantel se lee como una lista.
 */
export function nombreProlijo(nombre) {
  return String(nombre || "").trim().toLowerCase()
    .split(/\s+/)
    .map(t => RUIDO.has(t) ? t : t.charAt(0).toUpperCase() + t.slice(1))
    .join(" ");
}

/** Estadísticas de ARUSA de un jugador ya vinculado. */
export function statsDe(jugador, jugadoresArusa) {
  if (!jugador?.arusa_player_id) return null;
  return jugadoresArusa.find(j => String(j.id) === String(jugador.arusa_player_id)) || null;
}

/**
 * Jugadores repetidos dentro del propio plantel.
 *
 * "Infante Tomás" y "Tomás Infante Fantuzzi" son la misma persona cargada dos
 * veces: la primera vino en la planilla del club y la segunda se agregó desde
 * ARUSA cuando el emparejamiento exigía que los nombres calzaran palabra por
 * palabra. Se detecta igual que el emparejamiento —un nombre contenido en el
 * otro, sin ambigüedad— y se propone conservar uno solo.
 *
 * Se conserva la ficha vieja, que es la que tiene la asistencia, el número y
 * la posición cargados; se le pasa el vínculo con ARUSA y el nombre completo,
 * y se borra la duplicada. Nunca al revés: perder la asistencia de la
 * temporada por quedarse con la ficha recién creada sería el peor resultado
 * posible de una limpieza.
 */
export function duplicadosDelPlantel(plantel) {
  const conClave = plantel.map(p => ({ p, k: clave(p.name) })).filter(x => x.k.size >= 2);
  const pares = [];
  const yaTomados = new Set();

  for (const corto of conClave) {
    const largos = conClave.filter(x => x.p.id !== corto.p.id && contenidoEn(corto.k, x.k));
    if (largos.length !== 1) continue; // con dudas no se borra nada
    const largo = largos[0];
    if (yaTomados.has(corto.p.id) || yaTomados.has(largo.p.id)) continue;
    yaTomados.add(corto.p.id); yaTomados.add(largo.p.id);

    // La ficha nueva es la que vino de ARUSA: trae vínculo y nada más.
    const nueva = largo.p.arusa_player_id && !corto.p.arusa_player_id ? largo.p
                : corto.p.arusa_player_id && !largo.p.arusa_player_id ? corto.p
                : null;
    if (!nueva) continue; // las dos son del club o las dos de ARUSA: que decida una persona
    const vieja = nueva.id === largo.p.id ? corto.p : largo.p;
    pares.push({
      conservar: vieja,
      borrar: nueva,
      // El nombre completo es el mejor de los dos, venga de donde venga.
      nombreFinal: (largo.p.name || "").length >= (corto.p.name || "").length ? largo.p.name : corto.p.name,
      arusaId: nueva.arusa_player_id,
    });
  }
  return pares;
}
