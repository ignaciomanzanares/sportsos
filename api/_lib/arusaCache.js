// Caché durable de lo que viene de arusa.cl (posiciones, estadísticas).
//
// arusa.cl solo responde a ratos: se cae, o bloquea por rate limit. Si SportOS
// dependiera de que esté arriba justo cuando un entrenador abre la tabla, la
// tabla estaría vacía la mitad de las veces. Así que cada lectura exitosa se
// guarda acá, y cuando la lectura falla se devuelve la última buena.
//
// La diferencia con un caché en memoria: las funciones de Vercel se apagan
// entre invocaciones. Un Map se pierde; esto no.
//
// La tabla se crea sola, así que no hace falta correr una migración a mano
// antes de que esto funcione.
import pg from "pg";

let tablaLista = null;

async function conectar() {
  const client = new pg.Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function asegurarTabla(client) {
  if (tablaLista) return tablaLista;
  tablaLista = client
    .query(`
      create table if not exists arusa_cache (
        key        text primary key,
        data       jsonb not null,
        updated_at timestamptz not null default now()
      )
    `)
    .then(() => true)
    .catch((err) => {
      console.error("[arusaCache] no se pudo crear la tabla:", err.message);
      tablaLista = null; // que el próximo intento lo vuelva a probar
      throw err;
    });
  return tablaLista;
}

/** Última copia buena, o null si nunca se guardó uno. */
export async function leerCache(key) {
  let client;
  try {
    client = await conectar();
    await asegurarTabla(client);
    const { rows } = await client.query("select data from arusa_cache where key = $1", [key]);
    return rows[0]?.data ?? null;
  } catch (err) {
    console.error(`[arusaCache] leerCache(${key}) falló:`, err.message);
    return null;
  } finally {
    await client?.end().catch(() => {});
  }
}

/**
 * Guarda una copia buena. No lanza: que falle el caché nunca debe tumbar la
 * petición que sí consiguió los datos.
 */
export async function escribirCache(key, data) {
  let client;
  try {
    client = await conectar();
    await asegurarTabla(client);
    await client.query(
      `insert into arusa_cache (key, data, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (key) do update set data = excluded.data, updated_at = now()`,
      [key, JSON.stringify(data)],
    );
  } catch (err) {
    console.error(`[arusaCache] escribirCache(${key}) falló:`, err.message);
  } finally {
    await client?.end().catch(() => {});
  }
}

/** Cuándo se guardó por última vez (para poder decirle al usuario qué tan viejo es el dato). */
export async function edadCache(key) {
  let client;
  try {
    client = await conectar();
    await asegurarTabla(client);
    const { rows } = await client.query("select updated_at from arusa_cache where key = $1", [key]);
    return rows[0]?.updated_at ?? null;
  } catch {
    return null;
  } finally {
    await client?.end().catch(() => {});
  }
}
