// Sincronización diaria del fixture para todos los clubes activos.
//
// Estaba roto por tres motivos a la vez: usaba SUPABASE_DB_URL (que apuntaba
// al proyecto Supabase viejo y ya se borró), raspaba arusa.cl (que cierra la
// conexión desde Vercel) y exigía un arusa_club_id que ya no se necesita —
// ahora el club se reconoce por su nombre contra los equipos del torneo.
//
// Va contra api.leverade.com, que responde desde cualquier lado y trae todas
// las categorías: adulta, juveniles y menores.
//
// Escribe con la clave de servicio porque no hay sesión de usuario en un cron.
// Si no está configurada, se dice: un cron que falla en silencio es peor que
// uno que no corre, porque nadie se entera de que los partidos quedaron viejos.
import { createClient } from "@supabase/supabase-js";
import { obtenerFixtureTemporada } from "../_lib/leveradeFixture.js";
import { partidosDelClub } from "../_lib/arusaDesdeCache.js";

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "no autorizado" });
    }
  }

  const url = process.env.VITE_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servicio) {
    return res.status(500).json({
      error: "falta SUPABASE_SERVICE_ROLE_KEY: el cron no puede escribir sin sesión de usuario",
    });
  }

  const supabase = createClient(url, servicio, { auth: { persistSession: false } });

  try {
    const { partidos, fallidos } = await obtenerFixtureTemporada();
    if (partidos.length === 0) {
      return res.status(502).json({ error: "leverade no devolvió partidos", fallidos });
    }

    const { data: clubes, error: clubErr } = await supabase
      .from("clubs").select("id, name").eq("suspended", false);
    if (clubErr) throw clubErr;

    const resultados = [];
    for (const club of clubes || []) {
      const filas = partidosDelClub(partidos, club.name)
        .map(p => ({ ...p, club_id: club.id, external_source: "arusa" }));
      // Un club que no juega el torneo simplemente no aparece; no es un error.
      if (filas.length === 0) continue;

      const { error } = await supabase
        .from("matches").upsert(filas, { onConflict: "club_id,external_source,external_id" });
      // Dejar constancia de que esto corrió. Sin esto, la pantalla de Mi Club
      // solo sabía cuándo alguien había apretado el botón a mano, y mostraba
      // esa fecha como si fuera la de la última importación: el fixture estaba
      // al día y el cartel decía que no se sincronizaba hacía veinte días.
      if (!error) {
        await supabase.from("clubs")
          .update({ arusa_last_sync: new Date().toISOString() }).eq("id", club.id);
      }
      resultados.push({ club: club.name, ok: !error, partidos: filas.length, error: error?.message });
    }

    return res.status(200).json({ clubesConPartidos: resultados.length, torneosSinDatos: fallidos, resultados });
  } catch (err) {
    console.error("[cron/sync-arusa]", err);
    return res.status(500).json({ error: err.message });
  }
}
