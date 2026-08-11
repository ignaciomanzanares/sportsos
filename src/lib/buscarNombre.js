/**
 * Buscar personas por nombre, igual en toda la app.
 *
 * Había tres búsquedas distintas —el plantel, la asistencia y la búsqueda
 * global— y solo una ignoraba los acentos. Escribiendo "perez", la asistencia
 * encontraba nueve jugadores y el plantel tres: los tres que alguien escribió
 * sin tilde. Los otros seis existían, estaban en la misma lista, y la pantalla
 * decía que no. Un plantel que responde distinto según dónde lo busques no es
 * un plantel, son tres.
 *
 * También calza por cualquier palabra suelta y en cualquier orden: el club
 * escribe "Sánchez Jose Miguel" y ARUSA "José Miguel Pérez Santander", así que
 * quien busca no puede saber si el apellido va primero.
 */

/** "José Pérez" → "jose perez" */
export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿El nombre calza con lo que se escribió?
 * Cada palabra buscada tiene que aparecer en alguna del nombre — así "perez
 * santi" encuentra a "Perez Rasmussen Santiago" sin exigir el orden.
 */
export function coincide(nombre, consulta) {
  const q = normalizar(consulta);
  if (!q) return true;
  const n = normalizar(nombre);
  return q.split(" ").every(t => n.includes(t));
}

/** Filtra una lista por el campo de nombre que tenga (name o nombre). */
export function filtrarPorNombre(lista, consulta) {
  if (!normalizar(consulta)) return lista;
  return lista.filter(x => coincide(x?.name ?? x?.nombre, consulta));
}
