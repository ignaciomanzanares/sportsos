// Sincroniza los partidos de un club con ARUSA. Requiere que quien llama
// esté autenticado y sea admin/entrenador/preparador de ese club — si no,
// cualquiera podría disparar una sincronización (y una escritura en la
// base de datos) para un club ajeno con solo conocer su id.
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { syncClubWithArusa } from "./_lib/arusaSync.js";

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

    const { rows: clubRows } = await client.query("select name, arusa_club_id from clubs where id = $1", [club_id]);
    const club = clubRows[0];
    if (!club?.arusa_club_id) {
      return res.status(400).json({ error: "Este club no tiene configurado su ID de ARUSA." });
    }

    const resumen = await syncClubWithArusa(client, { clubId: club_id, clubName: club.name, arusaClubId: club.arusa_club_id });
    return res.status(200).json(resumen);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
}
