import DATOS from "./capsHistoricos.json";
import { PALABRAS_IGNORADAS } from "../lib/vincularArusa";

/**
 * Caps del primer equipo, temporadas 2021 a 2025.
 *
 * Un cap es un partido jugado por el equipo de Titulares: arrancó de titular
 * o entró desde la banca. El que quedó de reserva sin entrar no suma.
 *
 * De dónde sale. La tabla de estadísticas de ARUSA no sirve para esto: cuenta
 * solo al que arrancó. Se comprobó dividiendo las presencias de cada
 * temporada por los partidos y daba el XV exacto (15,0 a 16,6). Lo real está
 * partido por partido, en dos páginas que sí publica arusa:
 *
 *   /match/<id>/stats         la nómina, Regular 1-15 y Reserve 16-23
 *   /match/<id>/live-scoring  cada Substitution, con quién sale y quién entra
 *
 * Se bajaron los 104 partidos de Titulares del club con
 * scripts/caps-arusa.mjs y se consolidaron con scripts/caps-consolidar.mjs.
 * Hay que navegar con un navegador de verdad: arusa pone un desafío de
 * JavaScript que responde 429 a curl y también al proxy de Cloudflare.
 *
 * El torneo cambió de nombre y formato casi todos los años:
 *
 *   2021  TOP 8 · Titulares
 *   2022  Primera · Titulares
 *   2023  Primera Nacional (TOP 10) · Titulares
 *   2024  SEGUNDA División · Titulares  ← el club estaba en segunda ese año
 *   2025  Primera División · grupo Titulares
 *
 * 2024 cuenta porque el criterio es el EQUIPO, no la categoría: fueron
 * partidos del primer equipo aunque el club estuviera en segunda.
 *
 * ESTE NÚMERO ES UN PISO, no un total exacto.
 *
 * Las titularidades son firmes: salen de la nómina publicada. Los ingresos
 * desde la banca no, porque los cambios los anota a mano quien hace la
 * planilla del partido y se le pasan muchos. Medido sobre los 98 partidos con
 * nómina: 11 figuran con CERO cambios (imposible en un partido de rugby) y el
 * promedio es 5,1 cuando la banca son 8. O sea que arusa registra cerca de
 * dos tercios de los ingresos.
 *
 * Lo detectó un jugador del club mirando su propia ficha: estaba en la banca
 * con el 22 contra Sporting, entró, y arusa solo anotó los cambios del 21, 16,
 * 20 y 23. La pantalla lo dice: son un mínimo, y a los que más rotan les
 * faltan partidos.
 *
 * La cobertura de nóminas es completa: los 102 partidos de las seis
 * temporadas. Lo que falta son solo los ingresos desde la banca que arusa no
 * anotó.
 *
 * Incluye la temporada en curso. Sumarla en vivo desde la tabla de ARUSA
 * habría sido cómodo pero incorrecto: esa tabla mide titularidades, así que
 * el jugador vería su historia con una regla y su año con otra. Se refresca
 * corriendo los dos scripts después de cada fecha — caps-arusa.mjs baja solo
 * los partidos nuevos.
 */
const HISTORICO_DESDE = 2021;

/**
 * Igual que clave_nombre en la base: palabras del nombre, sin acentos ni orden.
 *
 * La lista de palabras a ignorar se importa y no se escribe acá. Estaba
 * copiada a mano y se había quedado corta —le faltaban "las", "y", "da",
 * "do", "van" y "von"—, así que un "Nicolás van der Berg" daba una clave
 * distinta a la que usan el vinculador de ARUSA y la base. Ninguno de los 125
 * nombres del club la pisa hoy, pero el día que entre un Von Mühlenbrock su
 * ficha se engancha bien y sus caps aparecen en cero, sin ningún error.
 */
function clave(nombre) {
  return String(nombre || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(p => p.length > 1 && !PALABRAS_IGNORADAS.has(p))
    .sort()
    .join(" ");
}

// Índice por id de ARUSA, que es el cruce exacto cuando existe.
const POR_ID = new Map();
for (const v of Object.values(DATOS)) if (v.id) POR_ID.set(String(v.id), v);

/**
 * Caps de un jugador: { total, porAnio } o null si nunca jugó en Titulares.
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

export { HISTORICO_DESDE };
