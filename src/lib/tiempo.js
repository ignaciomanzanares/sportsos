/**
 * "Hace 5m", "Hace 3h", "Hace 2d" — cómo se muestra la antigüedad de un post
 * o de un comentario.
 *
 * Vivía copiada en usePosts y useComments, idéntica hasta el último carácter.
 * Dos copias de la misma regla son dos lugares donde arreglarla el día que
 * alguien pida "hace una semana" en vez de "Hace 8d".
 */
export function haceCuanto(fecha) {
  const diff = Date.now() - new Date(fecha).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Ahora";
  if (m < 60) return `Hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}
