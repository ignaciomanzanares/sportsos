import DATOS from "./capsHistoricos.json";

/**
 * Caps del primer equipo, temporadas 2021 a 2025.
 *
 * Un cap es un partido jugado por el equipo de Titulares. Sale de las tablas
 * de estadísticas de ARUSA, temporada por temporada — Leverade guarda las seis
 * y el torneo cambió de nombre y de formato casi todos los años:
 *
 *   2021  TOP 8 · Titulares
 *   2022  Primera · Titulares
 *   2023  Primera Nacional (TOP 10) · Titulares
 *   2024  SEGUNDA División · Titulares  ← el club estaba en segunda ese año
 *   2025  Primera División · grupo Titulares
 *
 * 2024 se incluye porque el criterio es el EQUIPO, no la categoría: fueron
 * partidos del primer equipo aunque el club estuviera en segunda. Si el club
 * prefiere contar solo primera división, es sacar ese año de la suma.
 *
 * IMPORTANTE — lo que este número NO es: ARUSA cuenta solo al que arrancó de
 * titular. Se comprobó sumando todas las presencias de cada temporada y
 * dividiendo por los partidos: da entre 15,0 y 16,6, o sea el XV. Si contara
 * a los que entran desde la banca daría cerca de 23. Y no hay de dónde
 * sacarlo: arusa no publica formaciones ni sustituciones — el minuto a minuto
 * solo trae ensayos, conversiones, penales y tarjetas.
 *
 * O sea: esto es "partidos de titular", no "presencias". Es el techo de lo
 * que la fuente permite.
 *
 * El año en curso NO está acá: lo trae la API en vivo y se suma aparte, para
 * que no haya que regenerar este archivo cada fecha.
 */

const HISTORICO_DESDE = 2021;
const HISTORICO_HASTA = 2025;

/** Igual que clave_nombre en la base: palabras del nombre, sin acentos ni orden. */
function clave(nombre) {
  return String(nombre || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(p => p.length > 1 && !["de", "del", "la", "los"].includes(p))
    .sort()
    .join(" ");
}

// Índice por id de ARUSA, que es el cruce exacto cuando existe.
const POR_ID = new Map();
for (const v of Object.values(DATOS)) if (v.id) POR_ID.set(String(v.id), v);

/**
 * Caps históricos de un jugador: { total, porAnio } o null.
 * Se cruza primero por id de ARUSA y solo si no hay, por nombre.
 */
export function capsHistoricos(player) {
  const v = (player?.arusa_player_id && POR_ID.get(String(player.arusa_player_id)))
         || DATOS[clave(player?.name)];
  if (!v) return null;
  const porAnio = v.a || {};
  const total = Object.values(porAnio).reduce((s, n) => s + n, 0);
  return total > 0 ? { total, porAnio, nombre: v.n } : null;
}

export { HISTORICO_DESDE, HISTORICO_HASTA };
