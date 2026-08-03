// Sincronización diaria automática (Vercel Cron) para todos los clubes que
// configuraron su ID de ARUSA en Mi Club. Protegido con CRON_SECRET: Vercel
// firma sus propias invocaciones de cron con este header automáticamente,
// así que cualquier llamada sin el secreto correcto se rechaza.
import pg from "pg";
import { syncClubWithArusa } from "../_lib/arusaSync.js";

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "no autorizado" });
    }
  }

  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  const resultados = [];

  try {
    await client.connect();
    const { rows: clubs } = await client.query(
      "select id, name, arusa_club_id from clubs where arusa_club_id is not null and coalesce(suspended,false) = false"
    );

    for (const club of clubs) {
      try {
        const resumen = await syncClubWithArusa(client, { clubId: club.id, clubName: club.name, arusaClubId: club.arusa_club_id });
        resultados.push({ club: club.name, ok: true, ...resumen });
      } catch (err) {
        resultados.push({ club: club.name, ok: false, error: err.message });
      }
    }

    return res.status(200).json({ clubes: resultados.length, resultados });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
}
