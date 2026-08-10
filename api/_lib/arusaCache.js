// Caché durable de lo que viene de arusa.cl (posiciones, estadísticas, fixture).
//
// arusa.cl solo responde a ratos y bloquea por IP, así que SportOS no rasca:
// lee de acá. Las funciones de Vercel se apagan entre invocaciones, o sea que
// un Map en memoria no sirve — esto tiene que estar en la base.
//
// Se lee por PostgREST con la anon key, no por conexión directa con
// SUPABASE_DB_URL. Dos razones: esa variable quedó apuntando a un proyecto
// Supabase viejo que ya no existe (por eso el endpoint devolvía vacío aunque
// las filas estuvieran guardadas), y la tabla es de lectura pública, así que
// la anon key alcanza y no hace falta abrir una conexión de Postgres por
// petición.
//
// Escribir es otra cosa: lo hace rugby-chile llamando a guardar_arusa_cache,
// que exige un secreto propio. SportOS no escribe acá.
const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;

async function consultar(key, campos) {
  if (!URL || !ANON) return null;
  const qs = `arusa_cache?key=eq.${encodeURIComponent(key)}&select=${campos}`;
  const res = await fetch(`${URL}/rest/v1/${qs}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) throw new Error(`arusa_cache ${res.status}`);
  const filas = await res.json();
  return filas[0] ?? null;
}

/** Última copia buena, o null si nunca se guardó una. */
export async function leerCache(key) {
  try {
    return (await consultar(key, "data"))?.data ?? null;
  } catch (err) {
    console.error(`[arusaCache] leerCache(${key}) falló:`, err.message);
    return null;
  }
}

/** Cuándo se guardó, para poder decir "datos de hace X" en vez de aparentar frescura. */
export async function edadCache(key) {
  try {
    return (await consultar(key, "updated_at"))?.updated_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Guarda una copia buena. Solo funciona con el secreto del escritor, que
 * SportOS no tiene en producción a propósito — está acá para poder sembrar el
 * caché a mano cuando haga falta. Nunca lanza: que falle el caché no puede
 * tumbar la petición que sí consiguió los datos.
 */
export async function escribirCache(key, data) {
  const secreto = process.env.ARUSA_WRITER_SECRET;
  if (!URL || !ANON || !secreto) return;
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/guardar_arusa_cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_clave: key, p_datos: data, p_secreto: secreto }),
    });
    if (!res.ok) console.error(`[arusaCache] escribirCache(${key}):`, res.status, (await res.text()).slice(0, 160));
  } catch (err) {
    console.error(`[arusaCache] escribirCache(${key}) falló:`, err.message);
  }
}
