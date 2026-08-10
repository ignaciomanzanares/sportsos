// Sincroniza los partidos de un club con ARUSA. Requiere que quien llama
// esté autenticado y sea admin/entrenador/preparador de ese club — si no,
// cualquiera podría disparar una sincronización (y una escritura en la
// base de datos) para un club ajeno con solo conocer su id.
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { sincronizarDesdeCache } from "./_lib/arusaDesdeCache.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { club_id } = req.body || {};
  if (!club_id) return res.status(400).json({ error: "falta club_id" });

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "no autenticado" });

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "sesión inválida" });

  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    const { rows: profileRows } = await client.query(
      "select rol, club_id from profiles where id = $1",
      [userData.user.id]
    );
    const profile = profileRows[0];
    const autorizado = profile && profile.club_id === club_id && ["admin", "entrenador", "preparador"].includes(profile.rol);
    if (!autorizado) return res.status(403).json({ error: "no autorizado para este club" });

    const { rows: clubRows } = await client.query("select name from clubs where id = $1", [club_id]);
    const club = clubRows[0];
    if (!club) return res.status(404).json({ error: "club_no_encontrado" });

    // Ya no se pide el calendario a arusa: se lee del caché del torneo que
    // llena rugby-chile. Por eso tampoco hace falta el arusa_club_id — el club
    // se identifica por nombre contra los equipos del torneo.
    const resumen = await sincronizarDesdeCache(client, { clubId: club_id, clubName: club.name });
    if (resumen.cacheVacio) {
      return res.status(503).json({
        error: "Todavía no hay datos del torneo sincronizados. Reintenta en unos minutos.",
      });
    }
    return res.status(200).json(resumen);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
}
