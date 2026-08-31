// Vercel serverless function: crea una preferencia de pago real en Mercado
// Pago para un jugador de un club. Usa SUPABASE_DB_URL (conexión directa a
// Postgres, nunca expuesta al cliente) para leer el access_token del club
// y para registrar el pago pendiente.
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { club_id, player_id } = req.body || {};
  if (!club_id || !player_id) {
    return res.status(400).json({ error: "faltan club_id o player_id" });
  }

  // ── Quién llama ────────────────────────────────────────────────────────
  //
  // Esto no estaba, y era el agujero: el endpoint aceptaba cualquier POST con
  // un club_id y un player_id. Sin sesión, sin pertenecer al club, sin nada.
  // Cualquiera que conociera dos UUID podía sembrarle filas de cuota
  // "pendiente" al club entero, o generarle a otro jugador un cobro a su
  // nombre. No cobraba de más —el monto se lee del servidor— pero ensuciar
  // las finanzas de un club ajeno ya es suficiente.
  //
  // Se valida con el token del propio usuario, igual que sync-arusa: se le
  // pregunta a Supabase quién es y de qué club, y tiene que ser el mismo club
  // que dice el cuerpo del pedido.
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "no autenticado" });

  const comoUsuario = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: userData, error: userErr } = await comoUsuario.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "sesión inválida" });

  // El perfil se lee con la sesión del usuario, así que RLS ya garantiza que
  // solo puede ver el suyo.
  const { data: perfil } = await comoUsuario
    .from("profiles").select("club_id").eq("id", userData.user.id).limit(1);
  if (perfil?.[0]?.club_id !== club_id) {
    return res.status(403).json({ error: "no perteneces a ese club" });
  }

  // Y la ficha tiene que ser del mismo club. Sin esto, un socio podría
  // generarle un cobro a un jugador de otro club pasando su id.
  const { data: ficha } = await comoUsuario
    .from("plantel_publico").select("id").eq("id", player_id).eq("club_id", club_id).limit(1);
  if (!ficha?.[0]) return res.status(403).json({ error: "esa ficha no es de tu club" });

  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    const { rows: settingsRows } = await client.query(
      "select mercadopago_access_token, cuota_mensual from club_payment_settings where club_id = $1",
      [club_id]
    );
    const accessToken = settingsRows[0]?.mercadopago_access_token;
    if (!accessToken) {
      return res.status(400).json({ error: "Este club no tiene Mercado Pago configurado." });
    }
    // El monto se calcula acá, en el servidor, a partir de lo que el admin
    // configuró — nunca se confía en un "amount" enviado por el cliente,
    // que podría manipularse desde las devtools para pagar menos.
    const amount = settingsRows[0]?.cuota_mensual;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Este club no configuró el monto de la cuota mensual." });
    }

    const { rows: playerRows } = await client.query("select name from players where id = $1", [player_id]);
    const playerName = playerRows[0]?.name || "Jugador";

    const { rows: paymentRows } = await client.query(
      // El periodo se escribe acá y no se deja en null: es la columna con la
      // que la app decide de qué mes es la cuota, y el índice único que
      // impide cobrar dos veces el mismo mes no agarra las filas con null.
      // Se calcula en hora de Chile — un pago del 31 a las 22:00 en UTC ya
      // es del mes siguiente.
      `insert into payments (club_id, player_id, amount, currency, method, status, due_date, periodo)
       values ($1, $2, $3, 'CLP', 'Mercado Pago', 'pending', current_date,
               to_char(now() at time zone 'America/Santiago', 'YYYY-MM'))
       returning id`,
      [club_id, player_id, amount]
    );
    const paymentId = paymentRows[0].id;

    const origin = `https://${req.headers.host}`;
    const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: `Cuota mensual — ${playerName}`, quantity: 1, unit_price: Number(amount), currency_id: "CLP" }],
        back_urls: { success: origin, failure: origin, pending: origin },
        auto_return: "approved",
        notification_url: `${origin}/api/mercadopago-webhook?payment_id=${paymentId}`,
      }),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      return res.status(502).json({ error: "Error de Mercado Pago", detail: mpData });
    }

    return res.status(200).json({ init_point: mpData.init_point || mpData.sandbox_init_point, payment_id: paymentId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    await client.end();
  }
}
