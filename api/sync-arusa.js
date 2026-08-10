// Sincroniza los partidos del club con el fixture del torneo.
//
// Ya no se le pide nada a arusa.cl: se lee el fixture completo del caché
// (matches:ALL, que llena rugby-chile) y se filtra por club. Así el botón
// "Sincronizar ahora" no puede fallar por culpa de un tercero, es instantáneo
// y se puede apretar las veces que uno quiera — antes era una petición a
// arusa por club y a demanda, o sea una estampida esperando a ocurrir.
//
// Se escribe con la sesión de quien llama (supabase-js con su token), no con
// una conexión privilegiada: así las políticas de RLS siguen aplicando y un
// entrenador no puede tocar los partidos de otro club aunque adivine su id.
// De paso deja de depender de SUPABASE_DB_URL, que apuntaba al proyecto
// Supabase viejo.
import { createClient } from "@supabase/supabase-js";
import { sincronizarDesdeCache } from "./_lib/arusaDesdeCache.js";
import { obtenerFixtureTemporada } from "./_lib/leveradeFixture.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { club_id } = req.body || {};
  if (!club_id) return res.status(400).json({ error: "falta club_id" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "no autenticado" });

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "sesión inválida" });

  try {
    const { data: perfil } = await supabase
      .from("profiles").select("rol, club_id").eq("id", userData.user.id).single();

    const autorizado =
      perfil?.rol === "superadmin" ||
      (perfil?.club_id === club_id && ["admin", "entrenador", "preparador"].includes(perfil?.rol));
    if (!autorizado) return res.status(403).json({ error: "no autorizado para este club" });

    const { data: club } = await supabase.from("clubs").select("name").eq("id", club_id).single();
    if (!club) return res.status(404).json({ error: "club_no_encontrado" });

    // El fixture se pide a api.leverade.com, no a arusa.cl: Leverade responde
    // desde cualquier lado y trae TODAS las categorías, incluidas M13–M18, que
    // viven en torneos aparte. Si falla, se cae al caché, que solo tiene
    // adulta.
    let todos = null, fallidos = [];
    try {
      const fx = await obtenerFixtureTemporada();
      todos = fx.partidos; fallidos = fx.fallidos;
    } catch (e) {
      console.error("[sync-arusa] Leverade falló, se usa el caché:", e.message);
    }

    const resumen = await sincronizarDesdeCache(supabase, { clubId: club_id, clubName: club.name, todos });
    if (fallidos.length) resumen.torneosSinDatos = fallidos;
    if (resumen.cacheVacio) {
      return res.status(503).json({
        error: "Todavía no hay fixture del torneo sincronizado. Reintenta en unos minutos.",
      });
    }
    return res.status(200).json(resumen);
  } catch (err) {
    console.error("[sync-arusa]", err);
    return res.status(500).json({ error: err.message });
  }
}
