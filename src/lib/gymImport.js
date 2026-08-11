import * as XLSX from "xlsx";

/**
 * Leer el microciclo desde los Excel que manda el preparador físico.
 *
 * El PF no llena una plantilla: manda su planilla, y su planilla es una tabla
 * ancha donde cada día del microciclo es un bloque de columnas puesto al lado
 * del anterior. Arriba de cada bloque va la fecha, debajo si es GYM o CANCHA,
 * después el nombre del bloque de trabajo ("Bloque I: MOVILIDAD O ROLLER") y
 * recién ahí la tabla Movimiento / Series / Reps / Carga / Descanso. En la
 * columna de la izquierda de cada movimiento, el link al video.
 *
 * Además manda tres archivos por semana, uno por grupo de puestos: medios,
 * wings y fullbacks; primeras y segundas líneas; terceras líneas y centros. Se
 * suben juntos y cada ejercicio queda marcado con su grupo, porque el lunes de
 * un pilar y el de un wing no son el mismo entrenamiento.
 *
 * Se soporta también la forma simple —una columna "Día", o una hoja por día—
 * porque no todos los clubes van a mandar esta planilla.
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

// getDay() → clave. Domingo es 0.
const POR_NUMERO = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const COLUMNAS = {
  dia:      ["dia", "día", "sesion", "sesión", "jornada"],
  name:     ["ejercicio", "ejercicios", "movimiento", "movimientos", "trabajo", "actividad"],
  sets:     ["series", "sets", "s", "series x reps", "series por reps", "seriesxreps", "series/reps", "sxr"],
  reps:     ["reps", "repeticiones", "rep", "r"],
  carga:    ["carga", "peso", "intensidad", "1rm", "% 1rm", "%1rm", "porcentaje", "%"],
  rest:     ["descanso", "pausa", "rest", "recuperacion", "recuperación"],
  muscles:  ["musculos", "músculos", "grupo muscular", "zona"],
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
  for (const [dia, alias] of Object.entries(DIAS)) if (alias.includes(t)) return dia;
  return null;
}

/**
 * El día que representa una celda de encabezado de columna.
 * Puede ser un número de fecha de Excel (46244), un texto con fecha
 * ("Sabado 15/08/2026") o el nombre del día suelto.
 */
function diaDeCelda(celda) {
  if (celda == null || celda === "") return null;
  if (typeof celda === "number" && celda > 20000 && celda < 90000) {
    const f = XLSX.SSF.parse_date_code(celda);
    if (f) return POR_NUMERO[new Date(f.y, f.m - 1, f.d).getDay()];
  }
  const texto = String(celda);
  const m = texto.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const [, d, mes, a] = m;
    const anio = Number(a) < 100 ? 2000 + Number(a) : Number(a);
    return POR_NUMERO[new Date(anio, Number(mes) - 1, Number(d)).getDay()];
  }
  // "Sabado 15/08" sin año, o el día suelto.
  return diaDe(texto.split(/[\s,]+/)[0]);
}

const esURL = (v) => typeof v === "string" && /^https?:\/\//i.test(v.trim());
const esBloque = (v) => typeof v === "string" && /^\s*bloque\b/i.test(v);
const esCabecera = (v) => BUSCADOR.get(norm(v)) === "name";

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

const texto = (v) => (v == null ? "" : String(v).trim());

// ── Planilla ancha: un bloque de columnas por día ────────────────────────

/** Columnas donde arranca cada día, mirando las primeras filas. */
function columnasDeDia(filas) {
  for (const fila of filas.slice(0, 4)) {
    const encontradas = [];
    (fila || []).forEach((celda, i) => {
      const dia = diaDeCelda(celda);
      if (dia) encontradas.push({ col: i, dia });
    });
    if (encontradas.length >= 2) return encontradas;
  }
  return null;
}

function leerBloqueDeDia(filas, desde, grupo) {
  const ejercicios = [];
  let bloque = null;
  let cols = null;   // posiciones de series/reps/carga/descanso, relativas a la hoja
  let tipo = null;   // GYM / CANCHA / CASA
  let titulo = null;

  for (const fila of filas) {
    const cabecera = fila?.[desde];

    // "GYM" / "CANCHA" / "CASA": qué es la sesión de ese día.
    if (!tipo && /^(gym|cancha|casa|off)$/i.test(texto(cabecera))) { tipo = texto(cabecera).toUpperCase(); continue; }

    if (esCabecera(cabecera)) {
      // La fila de títulos puede repetirse una vez por bloque.
      cols = { sets: desde + 1, reps: desde + 2, carga: desde + 3, rest: desde + 4 };
      continue;
    }

    if (esBloque(cabecera)) { bloque = texto(cabecera); continue; }

    const nombre = texto(cabecera);
    if (!nombre) continue;

    // Antes de la primera tabla, lo que hay es el título de la sesión
    // ("TEMPO RUNS + COD"): los días de cancha no traen tabla y sin esto
    // quedarían como un día vacío, que se lee como "no hay entrenamiento".
    // La fecha de encabezado no es título: sin esta guarda la sesión se
    // llamaba "GYM · 46244", que es el número de serie del día en Excel.
    if (!cols) { if (!titulo && !diaDeCelda(cabecera)) titulo = nombre; continue; }
    if (nombre.length > 90) continue; // párrafos de instrucciones, no ejercicios

    const url = fila[desde - 1];
    ejercicios.push({
      name: nombre,
      sets: numero(fila[cols.sets]),
      reps: texto(fila[cols.reps]) || null,
      carga: texto(fila[cols.carga]).replace(/^x$|^---$/i, "") || null,
      rest: texto(fila[cols.rest]) || null,
      video: esURL(url) ? url.trim() : null,
      bloque,
      grupo,
    });
  }

  return { ejercicios, label: [tipo, titulo].filter(Boolean).join(" · ") };
}

function leerPlanillaAncha(filas, grupos, grupo) {
  const porDia = {};
  grupos.forEach((g) => {
    const { ejercicios, label } = leerBloqueDeDia(filas, g.col, grupo);
    if (!porDia[g.dia]) porDia[g.dia] = { label: "", exercises: [] };
    if (label && !porDia[g.dia].label) porDia[g.dia].label = label;
    porDia[g.dia].exercises.push(...ejercicios);
  });
  return porDia;
}

// ── Planilla simple: columna "Día", o una hoja por día ───────────────────

function mapearEncabezado(fila) {
  const mapa = {};
  (fila || []).forEach((celda, i) => {
    const campo = BUSCADOR.get(norm(celda));
    if (campo && mapa[campo] == null) mapa[campo] = i;
  });
  return mapa;
}

function buscarEncabezado(filas) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const mapa = mapearEncabezado(filas[i]);
    if (mapa.name != null) return { fila: i, mapa };
  }
  return null;
}

function ejercicioDeFila(fila, mapa, grupo) {
  const nombre = texto(fila[mapa.name]);
  if (!nombre) return null;

  let sets = mapa.sets != null ? numero(fila[mapa.sets]) : null;
  let reps = mapa.reps != null ? (fila[mapa.reps] ?? null) : null;
  const combinado = seriesPorReps(fila[mapa.sets] ?? fila[mapa.reps] ?? nombre);
  if (combinado && (sets == null || reps == null)) [sets, reps] = combinado;

  return {
    name: nombre,
    sets,
    reps: texto(reps) || null,
    carga: mapa.carga != null ? (texto(fila[mapa.carga]) || null) : null,
    rest: mapa.rest != null ? (texto(fila[mapa.rest]) || null) : null,
    video: null,
    bloque: null,
    grupo,
    muscles: mapa.muscles != null ? texto(fila[mapa.muscles]) : "",
    notes: mapa.notes != null ? texto(fila[mapa.notes]) : "",
  };
}

function leerPlanillaSimple(filas, enc, diaDeLaHoja, grupo, avisos) {
  const porDia = {};
  let ultimoDia = diaDeLaHoja;
  let bloque = null;

  for (const fila of filas.slice(enc.fila + 1)) {
    const enColumna = enc.mapa.dia != null ? diaDe(fila[enc.mapa.dia]) : null;
    const soloDia   = enc.mapa.dia == null ? diaDe(fila[enc.mapa.name]) : null;
    if (enColumna) ultimoDia = enColumna;
    if (soloDia) { ultimoDia = soloDia; bloque = null; continue; }

    if (enc.mapa.bloque != null && fila[enc.mapa.bloque]) bloque = texto(fila[enc.mapa.bloque]);

    const ej = ejercicioDeFila(fila, enc.mapa, grupo);
    if (!ej) continue;
    ej.bloque = bloque;

    const dia = ultimoDia || "lunes";
    if (!ultimoDia) avisos.push(`No se pudo saber el día de "${ej.name}"; quedó en Lunes.`);
    if (!porDia[dia]) porDia[dia] = { label: bloque || "", exercises: [] };
    porDia[dia].exercises.push(ej);
  }
  return porDia;
}

// ── Entrada ──────────────────────────────────────────────────────────────

/**
 * El grupo de puestos, sacado del nombre del archivo.
 * "SEM19 T.COMPETITIVA MEDIOS, WINGS Y FULL BACKS.xlsx" → "Medios, wings y full backs"
 */
export function grupoDeArchivo(nombre) {
  const limpio = String(nombre || "")
    .replace(/\.(xlsx?|csv)$/i, "")
    .replace(/^\s*sem\s*\d+\s*/i, "")
    .replace(/t\.?\s*competitiva/i, "")
    .replace(/microciclo|micro\s*n?°?\s*\d+/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!limpio) return null;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}

function fusionar(destino, origen) {
  for (const [dia, sesion] of Object.entries(origen)) {
    if (!destino[dia]) destino[dia] = { label: sesion.label || "", exercises: [] };
    if (sesion.label && !destino[dia].label) destino[dia].label = sesion.label;
    destino[dia].exercises.push(...sesion.exercises);
  }
}

async function leerArchivo(file, sessions, avisos) {
  const buf = await file.arrayBuffer();
  const libro = XLSX.read(buf, { type: "array" });
  const grupo = grupoDeArchivo(file.name);
  let leidos = 0;

  for (const nombreHoja of libro.SheetNames) {
    // La hoja de rezagados es el mismo trabajo para quien no fue: duplicaría
    // todos los ejercicios de la semana.
    if (/rezagad/i.test(nombreHoja)) continue;

    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, blankrows: false });
    if (filas.length === 0) continue;

    // La hoja de resumen del microciclo también tiene los siete días en fila,
    // pero no tiene ejercicios: sin esta comprobación aportaba solo títulos
    // sueltos ("GYM · LUNES") que después pisaban el nombre real de la sesión.
    const tieneTabla = filas.some(fila => (fila || []).some(esCabecera));
    const columnas = tieneTabla ? columnasDeDia(filas) : null;
    if (columnas) {
      const porDia = leerPlanillaAncha(filas, columnas, grupo);
      fusionar(sessions, porDia);
      leidos += Object.values(porDia).reduce((s, d) => s + d.exercises.length, 0);
      continue;
    }

    const enc = buscarEncabezado(filas);
    if (!enc) continue; // hojas de referencia (tablas de RIR, calculadoras)
    const porDia = leerPlanillaSimple(filas, enc, diaDe(nombreHoja), grupo, avisos);
    fusionar(sessions, porDia);
    leidos += Object.values(porDia).reduce((s, d) => s + d.exercises.length, 0);
  }

  if (leidos === 0) avisos.push(`De "${file.name}" no se pudo leer ningún ejercicio.`);
  return leidos;
}

/**
 * Lee uno o varios archivos y devuelve { sessions, avisos, total, grupos }.
 * `avisos` es lo que hay que saber para confiar en el resultado: un import
 * silencioso que interpreta mal es peor que uno que no corre.
 */
export async function parseGymPlan(files) {
  const lista = Array.isArray(files) ? files : [files];
  const sessions = {};
  const avisos = [];
  let total = 0;

  for (const f of lista) total += await leerArchivo(f, sessions, avisos);

  if (total === 0) {
    throw new Error('No se encontró ningún ejercicio. Revisa que la planilla tenga una fila "Movimiento" o "Ejercicio".');
  }

  // Ordenados de lunes a domingo, no en el orden en que aparecieron las hojas.
  const ordenadas = {};
  for (const d of ORDEN_DIAS) if (sessions[d]) ordenadas[d] = sessions[d];
  for (const d of Object.keys(sessions)) if (!ordenadas[d]) ordenadas[d] = sessions[d];

  const grupos = [...new Set(
    Object.values(ordenadas).flatMap(s => s.exercises.map(e => e.grupo).filter(Boolean)),
  )];

  return { sessions: ordenadas, avisos: [...new Set(avisos)], total, grupos };
}
