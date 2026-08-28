/**
 * Quién jugó cada partido — una sola definición para todos los scripts.
 *
 * Vivía copiada en el consolidador y en los dos generadores de informe, con
 * el riesgo de que la app y el .txt del grupo terminaran diciendo números
 * distintos del mismo jugador.
 */
import { readFileSync } from "fs";

export const limpiarNombre = n =>
  String(n || "").replace(/\s*\((c|cc)\)\s*$/i, "").trim();

/** Igual que clave_nombre en la base: palabras sin acentos, ordenadas. */
export const clave = n => limpiarNombre(n)
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .split(/[^a-z]+/).filter(x => x.length > 1 && !["de","del","la","los"].includes(x))
  .sort().join(" ");

/**
 * Anotaciones que la tabla del partido no registró, sacadas del minuto a minuto.
 *
 * Las produce scripts/tries-rescate.mjs. Incluye gente que anotó y ni siquiera
 * figura en la nómina de ese partido —arusa se contradice a sí misma—, así que
 * también suman un cap: no se puede anotar sin haber jugado.
 */
export function leerRescate(ruta = "scripts/tries-rescate.json") {
  try { return JSON.parse(readFileSync(ruta, "utf8")); } catch { return {}; }
}

export function leerCorrecciones(ruta = "scripts/caps-correcciones.json") {
  try {
    const c = JSON.parse(readFileSync(ruta, "utf8"));
    delete c._leeme;
    return c;
  } catch { return {}; }
}

/**
 * Los que jugaron un partido, aplicando lo que confirmaron los jugadores.
 *
 * Hay dos situaciones muy distintas:
 *
 * 1. El partido tiene nómina publicada (98 de 102). Los titulares jugaron y no
 *    se discute. De los de banca, arusa registra el ingreso de dos de cada
 *    tres, así que ahí manda lo que confirma el jugador:
 *      true  → entró
 *      false → se quedó en la banca
 *
 * 2. El partido NO tiene nómina (4 de 2021). Arusa no publicó quién jugó, ni
 *    siquiera los titulares, así que no hay de dónde partir: la única fuente
 *    es la memoria de los jugadores.
 *      "titular" → jugó de arranque
 *      "banca"   → entró desde la banca
 *
 * Devuelve [{ id, n, t }] con t = "titular" | "banca".
 */
export function quienJugo(partido, correcciones, rescate = null) {
  const fecha = String(partido.fecha).slice(0, 10);

  // El que anotó y no está en la nómina jugó igual. Se cuenta como banca
  // porque el XV ya venía completo en la lista — lo que significa que esa
  // lista está mal, no que estos hayan arrancado. Es una suposición, y es la
  // menos arriesgada de las dos.
  const rescatados = (rescate?.extras || [])
    .filter(e => !e.enNomina)
    .map(e => ({ id: null, n: e.n, t: "banca" }));

  if (partido.nomina?.length) {
    return [...rescatados, ...partido.nomina
      .filter(j => {
        if (j.t === "titular") return true;
        const dicho = correcciones[clave(j.n)]?.[fecha];
        if (dicho === true || dicho === false) return dicho;
        if (dicho === "titular" || dicho === "banca") return true;
        return j.jugo;
      })
      .map(j => ({ id: j.id, n: limpiarNombre(j.n), t: j.t }))];
  }

  // Sin nómina: se arma solo con lo confirmado a mano.
  const out = [...rescatados];
  for (const [k, v] of Object.entries(correcciones)) {
    const dicho = v?.[fecha];
    if (dicho !== "titular" && dicho !== "banca") continue;
    out.push({ id: null, n: v._nombre || k, t: dicho });
  }
  return out;
}

/** ¿Este partido depende enteramente de lo que recuerde la gente? */
export const sinNomina = partido => !partido.nomina?.length;

/** Lo que anotó un jugador en un partido, con el rescate ya sumado. */
export function anotacionesDe(partido, mid, rescate) {
  const extra = new Map(
    (rescate?.[mid]?.extras || []).map(e => [clave(e.n), e]));
  const out = [];
  for (const j of (partido.nomina || [])) {
    const e = extra.get(clave(j.n));
    out.push({ n: limpiarNombre(j.n),
      tries: (j.tries||0) + (e?.tries||0), conv: (j.conv||0) + (e?.conv||0),
      pen: (j.pen||0) + (e?.pen||0), drops: (j.drops||0) + (e?.drops||0) });
    if (e) extra.delete(clave(j.n));
  }
  // Los que anotaron sin figurar en la nómina.
  for (const e of extra.values())
    out.push({ n: limpiarNombre(e.n), tries: e.tries||0, conv: e.conv||0,
               pen: e.pen||0, drops: e.drops||0 });
  return out;
}
