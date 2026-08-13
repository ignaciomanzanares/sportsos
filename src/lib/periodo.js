/**
 * El mes al que corresponde una cuota, como "2026-08".
 *
 * Hasta ahora una cuota no pertenecía a ningún mes: el jugador que pagaba
 * una vez quedaba "al día" para siempre, porque el estado vivía en una
 * columna suelta de players (cuota_status) que nadie volvía a bajar. Con el
 * período, "al día" pasa a ser una pregunta con fecha: ¿pagó ESTE mes?
 *
 * Se calcula en hora de Chile y no en UTC. El 1 de mes a las 00:30 en
 * Santiago son las 03:30 o 04:30 UTC del mismo día, pero el 31 a las 22:00
 * en Santiago ya es día 1 en UTC: con toISOString() la cuota de un pago
 * hecho la última noche del mes caía en el mes siguiente.
 */

const ZONA = "America/Santiago";

/** "2026-08" para la fecha dada (hoy si no se pasa nada). */
export function periodoDe(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit",
  }).formatToParts(d);
  const y = partes.find(p => p.type === "year")?.value;
  const m = partes.find(p => p.type === "month")?.value;
  return `${y}-${m}`;
}

const MESES = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"];

/** "2026-08" → "Agosto 2026". */
export function nombrePeriodo(periodo) {
  const [y, m] = String(periodo || "").split("-");
  const nombre = MESES[Number(m) - 1];
  if (!nombre || !y) return periodo || "—";
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${y}`;
}

/** El período `n` meses antes (n negativo) o después (n positivo). */
export function correrPeriodo(periodo, n) {
  const [y, m] = String(periodo || "").split("-").map(Number);
  if (!y || !m) return periodo;
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * El período de una cuota ya guardada.
 *
 * Las filas anteriores a esta idea no tienen columna periodo; se deduce de
 * la fecha para que el historial viejo no quede fuera de todos los meses.
 */
export function periodoDePago(pago) {
  return pago?.periodo || (pago?.date ? String(pago.date).slice(0, 7) : "");
}
