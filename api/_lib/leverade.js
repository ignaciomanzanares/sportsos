// Cliente de Leverade / arusa.cl para el rugby chileno.
//
// Portado desde el proyecto rugby-chile (api/src/lib/leverade.ts). Se copia en
// vez de consumir la API de ese proyecto a propósito: SportOS es un producto
// con clubes detrás, y no debería caerse porque se cayó un proyecto personal
// alojado en otro lado. Esto es un cliente de un tercero, no lógica de
// negocio; duplicarlo es aislamiento, no deuda.
//
// Qué expone hoy:
//   - obtenerPosiciones(division)  → tabla de posiciones
//   - obtenerEstadisticas(division) → estadísticas por jugador
//
// Lo que NO se trajo (todavía): el minuto a minuto de los partidos y el
// raspado de tries, que en rugby-chile sirven para la vista en vivo. SportOS
// no tiene esa vista, así que traerlos ahora sería código muerto.
//
// OJO: esto es rugby chileno y nada más. Un club de básquetbol en Perú no
// tiene nada que hacer acá — la integración se ofrece por club, no se incrusta
// en las vistas.
import { leerCache, escribirCache } from "./arusaCache.js";

const TOURNAMENT_ID = "1328550";
const ARUSA_BASE = `https://arusa.cl/en/tournament/${TOURNAMENT_ID}`;
const ARUSA_AJAX_EN = "https://arusa.cl/en/ajax";
// Tope por petición: una conexión colgada no puede dejar esperando al usuario.
const TIMEOUT_MS = 8000;
const USER_AGENT = "SportOSBot/1.0 (+https://sportos-v02.vercel.app)";

// El torneo 1328550 tiene tres grupos, uno por división. Las tres son adulta
// (+18): son los tres equipos que presenta cada club, no categorías de edad.
export const DIVISIONES = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"];

export const DIVISION_A_GRUPO = {
  PRIMERA: "3667033",
  INTERMEDIA: "3667034",
  PRE_INTERMEDIA: "3667035",
};

// Nombre que muestra arusa → nombre canónico. Sin esto, la tabla de posiciones
// y las estadísticas no se pueden cruzar por equipo: cada una usa el suyo.
const NOMBRE_CANONICO = {
  "Old Mackayans": "Old Macks",
  "Prince of Wales CC": "PWCC",
  "Stade Français": "Stade Francais",
  "Univ. Católica": "UC",
  "Old Boys RC": "Old Boys",
  "Old Johns RC": "Old Johns",
  "Old Reds RC": "Old Reds",
};

export function nombreCanonico(nombre) {
  return NOMBRE_CANONICO[nombre] ?? nombre;
}

export function resolverDivision(raw) {
  const d = typeof raw === "string" ? raw.toUpperCase() : "PRIMERA";
  return d in DIVISION_A_GRUPO ? d : "PRIMERA";
}

// ── Parseo del HTML de arusa ─────────────────────────────────────────────
const limpiar = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function celda(fila, clase) {
  const re = new RegExp(`<td[^>]*class="${clase}(?:\\s[^"]*)?"[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const m = re.exec(fila);
  return m ? m[1] : null;
}

const num = (s) => Number(limpiar(s ?? "0")) || 0;

// fetch() envuelve los errores de red en un escueto "fetch failed" y esconde la
// causa real (DNS, TLS, conexión rechazada) en err.cause. Sin desenvolverlo no
// hay forma de distinguir "arusa está caída" de "arusa nos bloquea" ni de
// "nuestro entorno no puede salir a internet".
function detallarError(err) {
  const causa = err?.cause;
  const partes = [err?.message];
  if (causa?.code) partes.push(causa.code);
  if (causa?.message && causa.message !== err?.message) partes.push(causa.message);
  return partes.filter(Boolean).join(" · ");
}

async function pedir(url, headersExtra = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "Accept-Language": "en", "User-Agent": USER_AGENT, ...headersExtra },
    });
  } finally {
    clearTimeout(t);
  }
}

// ── Tabla de posiciones ──────────────────────────────────────────────────
function parsearPosiciones(html) {
  const tbody = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!tbody) return [];
  const filas = [];
  for (const tr of tbody[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const f = tr[1];
    const pos = num(celda(f, "colstyle-posicion"));
    const equipo = limpiar(celda(f, "colstyle-nombre") ?? "");
    if (!equipo || !pos) continue;
    filas.push({
      pos,
      equipo: nombreCanonico(equipo),
      pj: num(celda(f, "colstyle-partidos-jugados")),
      pg: num(celda(f, "colstyle-partidos-ganados")),
      pe: num(celda(f, "colstyle-partidos-empatados")),
      pp: num(celda(f, "colstyle-partidos-perdidos")),
      pf: num(celda(f, "colstyle-valor")),
      pc: num(celda(f, "colstyle-contravalor")),
      dif: num(celda(f, "colstyle-diferencia-valor")),
      pts: num(celda(f, "colstyle-puntos")),
    });
  }
  return filas.sort((a, b) => a.pos - b.pos);
}

/**
 * Tabla de posiciones de una división.
 * Devuelve { filas, desdeCache } — nunca lanza. Si arusa no responde y no hay
 * copia guardada, filas viene vacío: mejor una tabla vacía y honesta que una
 * inventada.
 */
export async function obtenerPosiciones(division) {
  const div = resolverDivision(division);
  const key = `standings:${div}`;
  try {
    const res = await pedir(`${ARUSA_BASE}/ranking/${DIVISION_A_GRUPO[div]}`);
    if (!res.ok) throw new Error(`arusa respondió ${res.status}`);
    const filas = parsearPosiciones(await res.text());
    if (filas.length === 0) throw new Error("posiciones vacías");
    await escribirCache(key, filas);
    return { filas, desdeCache: false };
  } catch (err) {
    // El motivo viaja en la respuesta a propósito: un fallo silencioso obliga a
    // adivinar si arusa está caída, si nos bloqueó, o si el parseo se rompió
    // porque cambiaron el HTML. Son tres problemas distintos.
    console.error(`[leverade] posiciones ${div}:`, detallarError(err));
    const guardadas = await leerCache(key);
    return { filas: guardadas ?? [], desdeCache: true, motivo: detallarError(err) };
  }
}

// ── Estadísticas por jugador ─────────────────────────────────────────────
function parsearEstadisticas(html) {
  const filas = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const f = tr[1];
    if (!f.includes("colstyle-jugador")) continue;
    // arusa antepone una palabra de interfaz ("Look"/"Ver") en la celda del nombre
    const nombre = limpiar(celda(f, "colstyle-jugador") ?? "").replace(/^(Look|Ver)\s+/i, "").trim();
    if (!nombre) continue;
    const equipo = nombreCanonico(limpiar(celda(f, "colstyle-equipo") ?? ""));
    const idM = /\/players\/(\d+)/.exec(f);
    const fila = {
      id: idM ? idM[1] : `${equipo}-${nombre}`,
      nombre,
      equipo,
      partidos: num(celda(f, "colstyle-partidos-jugados")),
      puntos: num(celda(f, "colstyle-puntos-totales")),
      tries: num(celda(f, "colstyle-tries")),
      triesPenal: num(celda(f, "colstyle-tries-penalti")),
      conversiones: num(celda(f, "colstyle-conversiones")),
      penales: num(celda(f, "colstyle-penalti")),
      drops: num(celda(f, "colstyle-drops")),
      amarillas: num(celda(f, "colstyle-tarjetas-amarillas")),
      rojas: num(celda(f, "colstyle-tarjetas-rojas")),
      mvp: num(celda(f, "colstyle-mvp")),
    };
    // arusa le pone 0 partidos jugados a quien entra desde la banca, aunque haya
    // anotado o recibido una tarjeta. Si hubo cualquier actividad, jugó al menos
    // uno: si no, esa gente desaparece de cualquier filtro por partidos > 0.
    const actividad =
      fila.puntos + fila.tries + fila.triesPenal + fila.conversiones +
      fila.penales + fila.drops + fila.amarillas + fila.rojas + fila.mvp;
    if (fila.partidos === 0 && actividad > 0) fila.partidos = 1;
    filas.push(fila);
  }
  return filas;
}

// La tabla de estadísticas de arusa está paginada de a ~50 filas.
async function pedirPagina(grupoId, pagina) {
  const qs = new URLSearchParams({
    input: String(pagina), type: "11", id: grupoId, rows: "50", actual: "1", column: "jugador.asc",
  });
  const res = await pedir(`${ARUSA_AJAX_EN}/table-page?${qs}`, { "X-Requested-With": "XMLHttpRequest" });
  if (!res.ok) return [];
  const json = await res.json();
  if (json.code !== 0 || !json.content) return [];
  return parsearEstadisticas(json.content);
}

/**
 * Estadísticas de todos los jugadores de una división.
 * Devuelve { filas, desdeCache }, igual que obtenerPosiciones.
 */
export async function obtenerEstadisticas(division) {
  const div = resolverDivision(division);
  const key = `players:${div}`;
  try {
    // Se recorren todas las páginas: quedarse con la primera dejaría fuera a
    // todos los jugadores desde la letra F en adelante.
    const porId = new Map();
    for (let pagina = 1; pagina <= 12; pagina++) {
      const filas = await pedirPagina(DIVISION_A_GRUPO[div], pagina);
      if (filas.length === 0) break;
      for (const f of filas) porId.set(f.id, f);
      if (filas.length < 50) break; // última página
    }
    const todas = [...porId.values()];
    if (todas.length === 0) throw new Error("estadísticas vacías");
    await escribirCache(key, todas);
    return { filas: todas, desdeCache: false };
  } catch (err) {
    console.error(`[leverade] estadísticas ${div}:`, detallarError(err));
    const guardadas = await leerCache(key);
    return { filas: guardadas ?? [], desdeCache: true, motivo: detallarError(err) };
  }
}
