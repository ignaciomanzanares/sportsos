// Cómo se escribe un jugador cuando no cabe el nombre entero: en la camiseta,
// en el token de la cancha, en una lista apretada.
//
// En Chile el nombre viene "Nombre(s) Apellido1 Apellido2", y el que identifica
// a alguien es el PRIMERO. Antes mostrábamos la última palabra, así que Santiago
// Prat Papic salía como "Papic" y Diego Espinoza Merino como "Merino": el
// apellido de la madre, el que nadie usa para llamarlo.
//
// No se puede resolver contando palabras, porque los nombres compuestos son
// comunes: "Jose Miguel Sánchez" tiene tres palabras y un solo apellido. Así que
// se salta la primera palabra —siempre es un nombre de pila— y después se
// saltan las que estén en la lista de nombres de pila compuestos de abajo.

// Segundos nombres de pila que aparecen en el club. La lista es corta a
// propósito: solo se consulta a partir de la SEGUNDA palabra, así que un nombre
// que también es apellido (Martín, Javier) no va acá — si va primero se salta
// igual, y si va segundo casi siempre es el apellido, como en Gerard Martin Amar.
const SEGUNDO_NOMBRE = new Set([
  "miguel", "pablo", "antonio", "jose", "josé", "joaquin", "joaquín", "tomas",
  "tomás", "manuel", "carlos", "ignacio", "mauricio", "eduardo", "arturo",
  "gaspar", "felipe", "alfonso", "luis", "alberto", "esteban", "andres", "andrés",
]);

// Partículas que son parte del apellido y no valen por sí solas:
// "San Martín", "de la Fuente", "del Río".
const PARTICULA = new Set(["de", "del", "la", "las", "los", "san", "santa", "da", "do", "di", "van", "von"]);

// De esas, las que se escriben en minúscula. "San" y "Santa" van con mayúscula:
// se dice "San Martín" pero "de la Fuente".
const EN_MINUSCULA = new Set(["de", "del", "la", "las", "los", "da", "do", "di", "van", "von"]);

const capitalizar = t =>
  // Si viene TODO EN MAYÚSCULAS o todo en minúsculas es ruido del scraper y se
  // normaliza. Si tiene mayúsculas adentro se respeta: O'Brien, McCoy.
  t === t.toUpperCase() || t === t.toLowerCase()
    ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    : t;

/** El apellido con el que se lo llama. "Diego Arturo Espinoza Merino" → "Espinoza". */
export function primerApellido(nombre) {
  const palabras = String(nombre || "").replace(/\s*\(c\)\s*$/i, "").trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return capitalizar(palabras[0]);

  // La primera palabra siempre es nombre de pila. De ahí en adelante, se avanza
  // mientras sigan siendo nombres de pila conocidos.
  let i = 1;
  while (i < palabras.length - 1 && SEGUNDO_NOMBRE.has(palabras[i].toLowerCase())) i++;

  // El apellido empieza acá; si arranca con partícula, se lleva las que sigan
  // más la primera palabra de verdad.
  const partes = [palabras[i]];
  while (PARTICULA.has(palabras[i].toLowerCase()) && i + 1 < palabras.length) {
    partes.push(palabras[++i]);
  }

  return partes
    .map(t => (EN_MINUSCULA.has(t.toLowerCase()) ? t.toLowerCase() : capitalizar(t)))
    .join(" ");
}
