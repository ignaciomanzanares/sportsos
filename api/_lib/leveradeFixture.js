// Fixture completo de la temporada: adulta Y formativas.
//
// Se consulta api.leverade.com directo, no arusa.cl. Esa distinción es todo:
// arusa cierra la conexión desde Vercel y castiga por IP, pero la API de
// Leverade —que es el sistema que hay debajo— responde a cualquiera y sin
// autenticación. Así el calendario no depende del puente con rugby-chile ni
// del caché.
//
// Antes se leía solo el torneo de Primera División, que trae las tres
// divisiones adultas en tres grupos. Las formativas son torneos aparte
// ("Primera División M13", "M16"…), y por eso el calendario de M6–M18 salía
// vacío: no es que el dato no exista, es que estábamos mirando un torneo que
// no las incluye.
const LEVERADE = "https://api.leverade.com";
// ARUSA como organizador: de acá cuelgan todos sus torneos, temporada a temporada.
const MANAGER_ID = "532872";
const TIMEOUT_MS = 8000;

const DIVISIONES_ADULTAS = {
  "3667033": "Primera",
  "3667034": "Intermedia",
  "3667035": "Pre-Intermedia",
};

async function traer(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${LEVERADE}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`leverade ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Torneos de una temporada. Sin temporada, la del torneo de Primera actual. */
export async function torneosDeTemporada(seasonId = "8826") {
  const j = await traer(`/managers/${MANAGER_ID}?include=tournaments`);
  return (j.included || [])
    .filter(x => x.type === "tournament" && x.relationships?.season?.data?.id === String(seasonId))
    .map(x => ({ id: String(x.id), nombre: x.attributes?.name || "" }));
}

/**
 * La categoría que le corresponde a un partido.
 *
 * En los torneos formativos sale del nombre ("Primera División M13" → M13).
 * En el de adultos, del grupo: sus tres grupos son los tres equipos que
 * presenta cada club, y ahí el nombre del torneo no distingue.
 */
function categoriaDe(nombreTorneo, groupId) {
  const edad = /\bM\d+\b/i.exec(nombreTorneo);
  if (edad) return edad[0].toUpperCase();
  return DIVISIONES_ADULTAS[groupId] || nombreTorneo;
}

function partidosDeTorneo(j, nombreTorneo) {
  const inc = j.included || [];

  const equipos = {};
  for (const x of inc) if (x.type === "team") equipos[String(x.id)] = x.attributes?.name || "";

  const puntos = new Map();
  for (const x of inc) {
    if (x.type !== "result" || x.attributes?.value == null) continue;
    const mid = String(x.relationships?.match?.data?.id ?? "");
    const tid = String(x.relationships?.team?.data?.id ?? "");
    if (!mid || !tid) continue;
    if (!puntos.has(mid)) puntos.set(mid, new Map());
    puntos.get(mid).set(tid, Number(x.attributes.value));
  }

  const rondaGrupo = {}, rondaNum = {};
  for (const x of inc) {
    if (x.type !== "round") continue;
    const g = x.relationships?.group?.data?.id;
    if (g) rondaGrupo[String(x.id)] = String(g);
    const fm = /Fecha\s+(\d+)/i.exec(x.attributes?.name ?? "");
    if (fm) rondaNum[String(x.id)] = Number(fm[1]);
  }

  const out = [];
  for (const m of inc) {
    if (m.type !== "match") continue;
    if (m.attributes?.canceled) continue;
    const rid = String(m.relationships?.round?.data?.id ?? "");
    const gid = rondaGrupo[rid];
    const hid = String(m.meta?.home_team ?? ""), aid = String(m.meta?.away_team ?? "");
    const homeTeam = equipos[hid], awayTeam = equipos[aid];
    // Sin los dos equipos no hay partido que mostrar: un "vs ?" es peor que
    // omitirlo.
    if (!homeTeam || !awayTeam) continue;
    const pm = puntos.get(String(m.id));
    out.push({
      matchId: String(m.id),
      homeTeam, awayTeam,
      categoria: categoriaDe(nombreTorneo, gid),
      torneo: nombreTorneo,
      round: rondaNum[rid] ?? 0,
      finished: Boolean(m.attributes?.finished),
      homeScore: pm?.get(hid), awayScore: pm?.get(aid),
      datetime: m.attributes?.datetime ?? null,
    });
  }
  return out;
}

/**
 * Todos los partidos de la temporada, de todas las categorías.
 * Los torneos se piden en paralelo: en serie serían trece viajes encadenados
 * y la función se quedaría sin tiempo.
 */
export async function obtenerFixtureTemporada(seasonId = "8826") {
  const torneos = await torneosDeTemporada(seasonId);
  const resultados = await Promise.allSettled(
    torneos.map(t =>
      traer(`/tournaments/${t.id}?include=groups.rounds.matches.results,teams`)
        .then(j => partidosDeTorneo(j, t.nombre)),
    ),
  );

  const partidos = [];
  const fallidos = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") partidos.push(...r.value);
    else fallidos.push(torneos[i].nombre);
  });
  // Se informa qué torneos fallaron en vez de devolver un fixture incompleto
  // como si estuviera entero.
  return { partidos, fallidos, torneos: torneos.length };
}
