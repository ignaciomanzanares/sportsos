import * as XLSX from "xlsx";

/**
 * Leer el microciclo desde el Excel que manda el preparador físico.
 *
 * Cargar a mano un plan de tres días con seis ejercicios cada uno son
 * dieciocho formularios, y el PF ya lo tiene escrito. Se lee su archivo tal
 * como lo manda: no hay plantilla obligatoria.
 *
 * Dos formas de organizar el día, las dos válidas porque las dos se usan:
 * una hoja por día (la pestaña se llama "Lunes"), o una columna "Día" dentro
 * de una sola hoja. Si no hay ninguna de las dos, todo cae en un solo día y se
 * avisa, en vez de repartir los ejercicios por adivinanza.
 */

const DIAS = {
  lunes: ["lunes", "lun", "monday", "mon", "l"],
  martes: ["martes", "mar", "tuesday", "tue", "ma"],
  miercoles: ["miercoles", "miércoles", "mie", "mié", "wednesday", "wed", "mi", "x"],
  jueves: ["jueves", "jue", "thursday", "thu", "j"],
  viernes: ["viernes", "vie", "friday", "fri", "v"],
  sabado: ["sabado", "sábado", "sab", "saturday", "sat", "s"],
  domingo: ["domingo", "dom", "sunday", "sun", "d"],
};

export const ORDEN_DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export const ETIQUETA_DIA = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles", jueves: "Jueves",
  viernes: "Viernes", sabado: "Sábado", domingo: "Domingo",
};

const COLUMNAS = {
  dia:      ["dia", "día", "sesion", "sesión", "jornada"],
  name:     ["ejercicio", "ejercicios", "movimiento", "trabajo", "actividad"],
  sets:     ["series", "sets", "s", "series x reps", "series por reps", "seriesxreps", "series/reps", "sxr"],
  reps:     ["reps", "repeticiones", "rep", "r"],
  pct:      ["1rm", "% 1rm", "%1rm", "porcentaje", "intensidad", "carga", "%"],
  rest:     ["descanso", "pausa", "rest", "recuperacion", "recuperación"],
  muscles:  ["musculos", "músculos", "grupo muscular", "grupo", "zona"],
  notes:    ["notas", "observaciones", "obs", "comentarios", "tecnica", "técnica"],
  bloque:   ["bloque", "titulo", "título", "foco", "objetivo"],
};

const norm = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .trim().toLowerCase().replace(/\s+/g, " ");

const BUSCADOR = new Map();
for (const [campo, palabras] of Object.entries(COLUMNAS)) {
  for (const p of palabras) BUSCADOR.set(norm(p), campo);
}

function diaDe(texto) {
  // Solo coincidencia exacta. Con "empieza por" —que parecía más tolerante—
  // "Dominadas" se leía como domingo y el ejercicio desaparecía convertido en
  // un separador de día.
  const t = norm(texto).replace(/[:.\-–]+$/, "").trim();
  if (!t) return null;
  for (const [dia, alias] of Object.entries(DIAS)) {
    if (alias.includes(t)) return dia;
  }
  return null;
}

/** Número suelto dentro de un texto: "4x6" → 4, "80%" → 80, "180s" → 180. */
function numero(v) {
  if (v == null || v === "") return null;
  const m = String(v).match(/-?\d+([.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : null;
}

/** "4x6" en una sola celda: devuelve [series, reps]. */
function seriesPorReps(v) {
  const m = String(v ?? "").match(/(\d+)\s*[x×]\s*(\d+\s*m?)/i);
  return m ? [Number(m[1]), m[2].trim()] : null;
}

function mapearEncabezado(fila) {
  const mapa = {};
  fila.forEach((celda, i) => {
    const campo = BUSCADOR.get(norm(celda));
    if (campo && mapa[campo] == null) mapa[campo] = i;
  });
  return mapa;
}

/** La fila de encabezado es la primera que reconoce al menos "ejercicio". */
function buscarEncabezado(filas) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const mapa = mapearEncabezado(filas[i] || []);
    if (mapa.name != null) return { fila: i, mapa };
  }
  return null;
}

function ejercicioDeFila(fila, mapa) {
  const nombre = String(fila[mapa.name] ?? "").trim();
  if (!nombre) return null;

  let sets = mapa.sets != null ? numero(fila[mapa.sets]) : null;
  let reps = mapa.reps != null ? (fila[mapa.reps] ?? null) : null;
  // "4x6" en la misma celda es lo más común cuando no hay dos columnas.
  const combinado = seriesPorReps(fila[mapa.sets] ?? fila[mapa.reps] ?? nombre);
  if (combinado && (sets == null || reps == null)) [sets, reps] = combinado;
  if (typeof reps === "string") reps = reps.trim() || null;

  return {
    name: nombre,
    sets: sets ?? 3,
    reps: reps ?? 8,
    pct: mapa.pct != null ? numero(fila[mapa.pct]) : null,
    rest: mapa.rest != null ? (numero(fila[mapa.rest]) ?? 120) : 120,
    muscles: mapa.muscles != null ? String(fila[mapa.muscles] ?? "").trim() : "",
    notes: mapa.notes != null ? String(fila[mapa.notes] ?? "").trim() : "",
  };
}

/**
 * Lee el archivo y devuelve { sessions, avisos }.
 * `avisos` es lo que el usuario tiene que saber para confiar en el resultado:
 * un import silencioso que interpreta mal es peor que uno que no corre.
 */
export async function parseGymPlan(file) {
  const buf = await file.arrayBuffer();
  const libro = XLSX.read(buf, { type: "array" });
  const sessions = {};
  const avisos = [];
  let total = 0;

  for (const nombreHoja of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, blankrows: false });
    if (filas.length === 0) continue;

    const enc = buscarEncabezado(filas);
    if (!enc) {
      avisos.push(`La hoja "${nombreHoja}" no tiene una columna de ejercicios; se omitió.`);
      continue;
    }

    const diaDeLaHoja = diaDe(nombreHoja);
    let ultimoDia = diaDeLaHoja;
    let bloque = null;

    for (const fila of filas.slice(enc.fila + 1)) {
      // El día puede venir en su propia columna junto al ejercicio ("Lunes |
      // Sentadilla | 4 | 6") o en una fila sola que hace de separador. Antes
      // cualquier fila con día se descartaba, así que el primer ejercicio de
      // cada día se perdía.
      const enColumna = enc.mapa.dia != null ? diaDe(fila[enc.mapa.dia]) : null;
      const soloDia   = enc.mapa.dia == null ? diaDe(fila[enc.mapa.name]) : null;
      if (enColumna) ultimoDia = enColumna;
      if (soloDia)   { ultimoDia = soloDia; bloque = null; continue; }

      if (enc.mapa.bloque != null && fila[enc.mapa.bloque]) bloque = String(fila[enc.mapa.bloque]).trim();

      const ej = ejercicioDeFila(fila, enc.mapa);
      if (!ej) continue;

      const dia = ultimoDia || "lunes";
      if (!ultimoDia) avisos.push(`No se pudo saber el día de "${ej.name}"; quedó en Lunes.`);
      if (!sessions[dia]) sessions[dia] = { label: bloque || "", exercises: [] };
      if (bloque && !sessions[dia].label) sessions[dia].label = bloque;
      sessions[dia].exercises.push(ej);
      total++;
    }
  }

  if (total === 0) {
    throw new Error("No se encontró ningún ejercicio. Revisa que haya una columna llamada \"Ejercicio\".");
  }

  // Ordenados de lunes a domingo, no en el orden en que aparecieron las hojas.
  const ordenadas = {};
  for (const d of ORDEN_DIAS) if (sessions[d]) ordenadas[d] = sessions[d];
  for (const d of Object.keys(sessions)) if (!ordenadas[d]) ordenadas[d] = sessions[d];

  // Un aviso por tipo: repetir "no se supo el día" veinte veces no informa más.
  return { sessions: ordenadas, avisos: [...new Set(avisos)], total };
}
