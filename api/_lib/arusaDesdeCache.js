// Partidos de un club, sacados del caché en vez de raspando arusa.
//
// El camino viejo (api/_lib/arusaSync.js) pide el calendario del club a
// arusa.cl en cada clic de "Sincronizar ahora". Eso tiene dos problemas:
// arusa cierra la conexión desde Vercel — así que nunca funcionó en
// producción — y, si funcionara, sería peor: una petición por club y a
// demanda, o sea diez clubes un sábado golpeando a la vez la misma IP
// compartida, con un throttle que castiga por IP durante días.
//
// Acá se lee la lista completa de partidos del torneo que rugby-chile ya
// dejó en arusa_cache, y se filtra por el club. Sincronizar deja de ser una
// petición a un tercero y pasa a ser una consulta a nuestra propia base:
// instantánea, sin límite de veces, y no puede caerse por culpa de arusa.
import { leerCache, edadCache } from "./arusaCache.js";
import { nombreCanonico } from "./leverade.js";

const CLAVE_PARTIDOS = "matches:ALL";

const soloFecha = (dt) => (dt ? String(dt).replace(" ", "T").slice(0, 10) : null);
const soloHora  = (dt) => (dt ? String(dt).replace(" ", "T").slice(11, 16) : null);

/**
 * Convierte los partidos del torneo en las filas que espera la tabla matches,
 * quedándose solo con los de este club.
 */
export function partidosDelClub(todos, clubName) {
  const club = nombreCanonico(String(clubName || "").trim()).toLowerCase();
  const filas = [];

  for (const m of todos) {
    const local = nombreCanonico(m.homeTeam || "").toLowerCase();
    const visita = nombreCanonico(m.awayTeam || "").toLowerCase();
    const esLocal = local === club;
    const esVisita = visita === club;
    if (!esLocal && !esVisita) continue;

    const fecha = soloFecha(m.datetime);
    if (!fecha) continue; // sin fecha no hay partido que agendar

    const jugado = Boolean(m.finished) &&
      Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore);

    let resultado = null;
    if (jugado) {
      const propio = esLocal ? m.homeScore : m.awayScore;
      const ajeno  = esLocal ? m.awayScore : m.homeScore;
      resultado = propio > ajeno ? "victoria" : propio < ajeno ? "derrota" : "empate";
    }

    filas.push({
      external_id: String(m.matchId),
      rival: esLocal ? m.awayTeam : m.homeTeam,
      match_date: fecha,
      hora: soloHora(m.datetime),
      // "Local"/"Visita" — así lo lee el resto de la app (db.js matchToPartido).
      location: esLocal ? "Local" : "Visita",
      estado: jugado ? "jugado" : "programado",
      score_home: jugado ? m.homeScore : null,
      score_away: jugado ? m.awayScore : null,
      result: resultado,
      // La división del torneo es el equipo adulto que jugó: Primera,
      // Intermedia o Pre-Intermedia. Coincide con las categorías del club.
      cat: m.division ? m.division.replace("PRE_INTERMEDIA", "Pre-Intermedia")
                                   .replace("INTERMEDIA", "Intermedia")
                                   .replace("PRIMERA", "Primera") : null,
      notes: m.round ? `Fecha ${m.round}` : null,
    });
  }
  return filas;
}

/**
 * Sincroniza los partidos del club desde el caché.
 * Devuelve además cuándo se actualizó el caché, para que la vista pueda decir
 * "datos de hace X" en vez de aparentar que acaba de hablar con arusa.
 */
export async function sincronizarDesdeCache(client, { clubId, clubName }) {
  const todos = await leerCache(CLAVE_PARTIDOS);
  if (!todos || todos.length === 0) {
    return { total: 0, creados: 0, actualizados: 0, cacheVacio: true, cacheActualizado: null };
  }

  const partidos = partidosDelClub(todos, clubName);
  let creados = 0, actualizados = 0;

  for (const p of partidos) {
    const { rows } = await client.query(
      `insert into matches (club_id, rival, match_date, hora, location, result, score_home, score_away, estado, cat, notes, external_source, external_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'arusa',$12)
       on conflict (club_id, external_source, external_id) where external_source is not null
       do update set rival=excluded.rival, match_date=excluded.match_date, hora=excluded.hora,
         location=excluded.location, result=excluded.result, score_home=excluded.score_home,
         score_away=excluded.score_away, estado=excluded.estado, cat=excluded.cat, notes=excluded.notes
       returning (xmax = 0) as inserted`,
      [clubId, p.rival, p.match_date, p.hora, p.location, p.result, p.score_home, p.score_away, p.estado, p.cat, p.notes, p.external_id],
    );
    if (rows[0]?.inserted) creados++; else actualizados++;
  }

  await client.query("update clubs set arusa_last_sync = now() where id = $1", [clubId]);
  return {
    total: partidos.length, creados, actualizados,
    cacheVacio: false,
    cacheActualizado: await edadCache(CLAVE_PARTIDOS),
  };
}
