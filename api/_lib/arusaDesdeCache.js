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
      // En adulta la categoría es el equipo que jugó (Primera / Intermedia /
      // Pre-Intermedia); en formativas, la edad (M13, M16…). El fixture de
      // Leverade ya la trae resuelta; el formato viejo del caché traía
      // `division` y se traduce.
      cat: m.categoria || (m.division
        ? m.division.replace("PRE_INTERMEDIA", "Pre-Intermedia")
                    .replace("INTERMEDIA", "Intermedia")
                    .replace("PRIMERA", "Primera")
        : null),
      notes: [m.torneo, m.round ? `Fecha ${m.round}` : null].filter(Boolean).join(" · ") || null,
    });
  }
  return filas;
}

/**
 * Sincroniza los partidos del club desde el caché.
 * Devuelve además cuándo se actualizó el caché, para que la vista pueda decir
 * "datos de hace X" en vez de aparentar que acaba de hablar con arusa.
 */
export async function sincronizarDesdeCache(supabase, { clubId, clubName, todos: recibidos = null }) {
  // Con el fixture ya traído de Leverade se usa ese; el caché queda como
  // respaldo para cuando Leverade no responda.
  const todos = recibidos?.length ? recibidos : await leerCache(CLAVE_PARTIDOS);
  if (!todos || todos.length === 0) {
    return { total: 0, creados: 0, actualizados: 0, cacheVacio: true, cacheActualizado: null };
  }

  const partidos = partidosDelClub(todos, clubName);
  if (partidos.length === 0) {
    // El club no aparece en el torneo. Se dice, no se devuelve un éxito con
    // cero: "sincronizado, 0 partidos" haría pensar que no hay fecha próxima.
    return { total: 0, creados: 0, actualizados: 0, cacheVacio: false, sinPartidos: true,
             cacheActualizado: await edadCache(CLAVE_PARTIDOS) };
  }

  const filas = partidos.map(p => ({ ...p, club_id: clubId, external_source: "arusa" }));
  const { data, error } = await supabase
    .from("matches")
    .upsert(filas, { onConflict: "club_id,external_source,external_id" })
    .select("id");
  if (error) throw new Error(`no se pudieron guardar los partidos: ${error.message}`);

  await supabase.from("clubs").update({ arusa_last_sync: new Date().toISOString() }).eq("id", clubId);

  const porCategoria = {};
  for (const p of partidos) porCategoria[p.cat || "sin categoría"] = (porCategoria[p.cat || "sin categoría"] || 0) + 1;

  return {
    total: partidos.length,
    guardados: data?.length ?? 0,
    porCategoria,
    cacheVacio: false,
    cacheActualizado: await edadCache(CLAVE_PARTIDOS),
  };
}
