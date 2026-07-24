// Vercel serverless function: crea una preferencia de pago real en Mercado
// Pago para un jugador de un club. Usa SUPABASE_DB_URL (conexión directa a
// Postgres, nunca expuesta al cliente) para leer el access_token del club
// y para registrar el pago pendiente.
import pg from "pg";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { club_id, player_id } = req.body || {};
  if (!club_id || !player_id) {
    return res.status(400).json({ error: "faltan club_id o player_id" });
  }

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
      `insert into payments (club_id, player_id, amount, currency, method, status, due_date)
       values ($1, $2, $3, 'CLP', 'Mercado Pago', 'pending', current_date)
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
