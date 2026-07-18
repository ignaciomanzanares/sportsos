import * as XLSX from "xlsx";

// ── Sinónimos de encabezado por campo ──────────────────────────────────────
// No asumimos que todos los clubes usan el mismo wording — cada club sube su
// propia nómina con sus propios títulos de columna, así que acá juntamos las
// variantes más comunes en español/Chile. Si un club usa algo que no está
// listado, cae al detector por contenido (más abajo).
const HEADER_SYNONYMS = {
  name:      ["nombre completo", "nombre y apellido", "nombre jugador", "nombre del jugador", "jugador", "jugadora", "atleta"],
  nombre:    ["nombre", "nombres", "primer nombre"],
  apellido:  ["apellido", "apellidos", "apellido paterno"],
  number:    ["numero", "número", "dorsal", "n", "nro", "n°"],
  position:  ["posicion", "posición", "puesto"],
  category:  ["categoria", "categoría", "division", "división", "plantel"],
  age:       ["edad"],
  fecha_nacimiento: ["f. nac", "f nac", "fecha nacimiento", "fecha de nacimiento", "nacimiento", "fecha nac"],
  telefono:  ["celular", "telefono", "teléfono", "fono", "movil", "móvil", "whatsapp"],
  email:     ["correo", "email", "e-mail", "mail", "correo electronico", "correo electrónico"],
  rut:       ["rut", "cedula", "cédula", "ci", "dni", "documento"],
  isapre:    ["isapre", "prevision", "previsión", "salud"],
  seguro:    ["seguro", "seguro accidentes", "seguro de accidentes"],
  peso_kg:   ["peso", "peso kg"],
  altura_m:  ["altura", "estatura", "talla"],
  contacto_emergencia_nombre:   ["contacto emergencia nombre", "contacto de emergencia", "contacto emergencia", "emergencia nombre"],
  contacto_emergencia_telefono: ["contacto emergencia telefono", "contacto emergencia teléfono", "telefono emergencia", "teléfono emergencia", "emergencia telefono", "emergencia fono"],
};

// Campos numéricos/fecha que necesitan parseo especial (el resto se guarda como texto)
const NUMERIC_FIELDS = new Set(["number", "age", "peso_kg", "altura_m"]);
const DATE_FIELDS    = new Set(["fecha_nacimiento"]);

function normalize(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
}

const SYNONYM_LOOKUP = new Map();
for (const [field, words] of Object.entries(HEADER_SYNONYMS)) {
  for (const w of words) SYNONYM_LOOKUP.set(normalize(w), field);
}

// ── Detección por contenido (respaldo para columnas sin header reconocible) ─
// Cada detector recibe una lista de valores no vacíos de la columna y
// devuelve true/false si "parece" ese campo. Se exige que la mayoría de la
// muestra matchee, no un solo valor suelto.
const CONTENT_DETECTORS = [
  { field: "rut",      test: v => /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/.test(String(v).trim()) },
  { field: "email",    test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) },
  { field: "telefono", test: v => /^(\+?56)?\s*9?\d{8}$/.test(String(v).replace(/\s|-/g, "")) },
  { field: "fecha_nacimiento", test: v => v instanceof Date && !isNaN(v) },
  { field: "peso_kg",  test: v => { const n = Number(v); return n >= 35 && n <= 160; } },
  { field: "altura_m", test: v => { const n = Number(String(v).replace(",", ".")); return n >= 1.3 && n <= 2.3; } },
  { field: "age",      test: v => { const n = Number(v); return Number.isInteger(n) && n >= 10 && n <= 70; } },
];

function detectByContent(values, alreadyClaimedFields) {
  const sample = values.filter(v => v !== "" && v != null).slice(0, 15);
  if (sample.length < 2) return null;
  for (const { field, test } of CONTENT_DETECTORS) {
    if (alreadyClaimedFields.has(field)) continue;
    const matches = sample.filter(test).length;
    if (matches / sample.length >= 0.7) return field;
  }
  return null;
}

function excelDateToISO(value) {
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);

  const s = String(value ?? "").trim();
  if (!s) return null;

  // Normaliza separadores mixtos ("21.03-1998", "21/03/1998", "21-03-1998")
  const norm = s.replace(/[./]/g, "-");
  const m = norm.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
    const day = Number(d), month = Number(mo), year = Number(y);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!isNaN(new Date(iso))) return iso;
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);

  return null; // no se pudo interpretar — se omite en vez de guardar basura
}

function ageFromBirthdate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

// Elige, entre las primeras filas, la que más parece un header (más celdas
// que matchean algún sinónimo) — así no asumimos que la fila 0 siempre es
// el header (puede haber un título del club arriba, filas vacías, etc).
function findHeaderRowIndex(rows) {
  let best = { index: 0, score: -1 };
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const score = rows[i].filter(cell => SYNONYM_LOOKUP.has(normalize(cell))).length;
    if (score > best.score) best = { index: i, score };
  }
  return best.score > 0 ? best.index : 0;
}

function buildFieldMap(headerRow, dataRows) {
  const fieldByCol = headerRow.map(h => SYNONYM_LOOKUP.get(normalize(h)) || null);

  // Respaldo por contenido para columnas sin match de header
  const claimed = new Set(fieldByCol.filter(Boolean));
  fieldByCol.forEach((field, col) => {
    if (field) return;
    const values = dataRows.map(r => r[col]);
    const guess = detectByContent(values, claimed);
    if (guess) { fieldByCol[col] = guess; claimed.add(guess); }
  });

  return fieldByCol;
}

export function buildTemplateWorkbook() {
  const headers = ["Nombre", "Numero", "Posicion", "Categoria", "Edad", "Telefono", "Email", "Contacto Emergencia Nombre", "Contacto Emergencia Telefono"];
  const example  = ["Carlos Rodríguez", "10", "Apertura", "Superior", "24", "+56912345678", "carlos@email.com", "María Rodríguez", "+56987654321"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jugadores");
  return wb;
}

export function downloadTemplate() {
  const wb = buildTemplateWorkbook();
  XLSX.writeFile(wb, "plantilla-jugadores-sportos.xlsx");
}

/**
 * Lee un archivo .xlsx/.csv y detecta automáticamente qué columna es qué
 * campo — no depende de un orden ni wording fijo de encabezados, porque cada
 * club sube su propia nómina con su propio formato. Usa sinónimos de header
 * primero, y detección por contenido (RUT/email/teléfono/fecha/rangos
 * numéricos) para lo que no matcheó ningún sinónimo.
 * Devuelve { ok:true, players:[...] } o { ok:false, error:"..." }.
 */
export async function parsePlayersFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { ok: false, error: "El archivo no tiene ninguna hoja legible." };

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length === 0) return { ok: false, error: "El archivo está vacío." };

  const headerIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerIdx];
  const dataRows  = rows.slice(headerIdx + 1);
  const fieldByCol = buildFieldMap(headerRow, dataRows);

  const hasName = fieldByCol.includes("name");
  const hasNombreApellido = fieldByCol.includes("nombre") || fieldByCol.includes("apellido");
  if (!hasName && !hasNombreApellido) {
    return {
      ok: false,
      error: "No pudimos encontrar una columna de nombre en este archivo. Revisa que tenga una columna tipo \"Nombre\", \"Nombre completo\" o \"Nombre\"+\"Apellido\".",
    };
  }

  const players = dataRows
    .filter(row => row.some(cell => String(cell ?? "").trim() !== ""))
    .map(row => {
      const player = { med_status: "verde", cuota_status: "ok" };
      let nombre = "", apellido = "";

      fieldByCol.forEach((field, i) => {
        if (!field) return;
        const raw = row[i];
        if (raw === "" || raw == null) return;

        if (field === "nombre")      { nombre = String(raw).trim(); return; }
        if (field === "apellido")    { apellido = String(raw).trim(); return; }
        if (field === "name")        { player.name = String(raw).trim(); return; }
        if (DATE_FIELDS.has(field))  { const iso = excelDateToISO(raw); if (iso) player[field] = iso; return; }
        if (NUMERIC_FIELDS.has(field)) {
          const n = Number(String(raw).replace(",", "."));
          if (!isNaN(n)) player[field] = n;
          return;
        }
        player[field] = String(raw).trim();
      });

      if (!player.name && (nombre || apellido)) player.name = `${nombre} ${apellido}`.trim();
      if (!player.age && player.fecha_nacimiento) player.age = ageFromBirthdate(player.fecha_nacimiento);

      return player;
    })
    .filter(p => p.name);

  if (players.length === 0) {
    return { ok: false, error: "No se encontró ninguna fila con nombre de jugador." };
  }

  return { ok: true, players };
}
