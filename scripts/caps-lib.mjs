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
export function quienJugo(partido, correcciones) {
  const fecha = String(partido.fecha).slice(0, 10);

  if (partido.nomina?.length) {
    return partido.nomina
      .filter(j => {
        if (j.t === "titular") return true;
        const dicho = correcciones[clave(j.n)]?.[fecha];
        if (dicho === true || dicho === false) return dicho;
        if (dicho === "titular" || dicho === "banca") return true;
        return j.jugo;
      })
      .map(j => ({ id: j.id, n: limpiarNombre(j.n), t: j.t }));
  }

  // Sin nómina: se arma solo con lo confirmado a mano.
  const out = [];
  for (const [k, v] of Object.entries(correcciones)) {
    const dicho = v?.[fecha];
    if (dicho !== "titular" && dicho !== "banca") continue;
    out.push({ id: null, n: v._nombre || k, t: dicho });
  }
  return out;
}

/** ¿Este partido depende enteramente de lo que recuerde la gente? */
export const sinNomina = partido => !partido.nomina?.length;
