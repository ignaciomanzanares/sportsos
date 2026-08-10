// Endpoint de solo lectura sobre el cliente de Leverade.
//
//   GET /api/leverade?tipo=posiciones&division=PRIMERA
//   GET /api/leverade?tipo=estadisticas&division=INTERMEDIA
//
// No pide autenticación: son datos públicos del torneo, los mismos que
// cualquiera ve en arusa.cl. Lo que sí hace es no dejar que el navegador
// golpee arusa directo — pasa por el caché, que es lo que sostiene la vista
// cuando arusa se cae.
import { obtenerPosiciones, obtenerEstadisticas, DIVISIONES,
         normalizarPosicion, normalizarJugador } from "./_lib/leverade.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const tipo = String(req.query.tipo || "posiciones");
  const division = String(req.query.division || "PRIMERA").toUpperCase();

  if (!DIVISIONES.includes(division)) {
    return res.status(400).json({ error: "division_invalida", validas: DIVISIONES });
  }

  try {
    const esEstadisticas = tipo === "estadisticas";
    const { filas, desdeCache, motivo } =
      esEstadisticas ? await obtenerEstadisticas(division) : await obtenerPosiciones(division);
    // Se traduce acá y no en la vista: quien escribe el caché puede cambiar sus
    // nombres de campo, pero el contrato de esta API no.
    const normalizadas = (filas || []).map(esEstadisticas ? normalizarJugador : normalizarPosicion);

    // Un minuto de caché en el borde: arusa no cambia más rápido que eso, y
    // así una tabla abierta por veinte personas no son veinte raspados.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    // desdeCache le permite a la vista decir "datos de la última sincronización"
    // en vez de mostrarlos como si fueran de este segundo.
    return res.status(200).json({ division, tipo, desdeCache, motivo: motivo ?? null, filas: normalizadas });
  } catch (err) {
    console.error("[api/leverade]", err);
    return res.status(500).json({ error: "error_inesperado" });
  }
}
