// Vercel serverless function: Mercado Pago llama acá cuando cambia el
// estado de un pago. Usamos el payment_id (nuestro, propio) que va en la
// query string del notification_url para saber a qué club/pago corresponde
// ANTES de necesitar ningún token — así sabemos qué access_token usar para
// preguntarle a Mercado Pago el estado real del pago.
import pg from "pg";

export default async function handler(req, res) {
  const ourPaymentId = req.query?.payment_id;
  const mpPaymentId = req.query?.["data.id"] || req.query?.id || req.body?.data?.id;

  if (!ourPaymentId || !mpPaymentId) return res.status(200).json({ ok: true }); // notificación irrelevante, no reintentar

  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    const { rows: paymentRows } = await client.query(
      "select id, club_id, player_id, status from payments where id = $1",
      [ourPaymentId]
    );
    const payment = paymentRows[0];
    if (!payment || payment.status === "paid") return res.status(200).json({ ok: true });

    const { rows: settingsRows } = await client.query(
      "select mercadopago_access_token from club_payment_settings where club_id = $1",
      [payment.club_id]
    );
    const accessToken = settingsRows[0]?.mercadopago_access_token;
    if (!accessToken) return res.status(200).json({ ok: true });

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mpData = await mpResp.json();
    if (!mpResp.ok) return res.status(200).json({ ok: true });

    if (mpData.status === "approved") {
      await client.query(
        "update payments set status = 'paid', paid_at = now(), mercadopago_payment_id = $1 where id = $2",
        [String(mpPaymentId), ourPaymentId]
      );
      await client.query("update players set cuota_status = 'ok' where id = $1", [payment.player_id]);
    } else if (mpData.status === "rejected" || mpData.status === "cancelled") {
      await client.query(
        "update payments set status = 'failed', mercadopago_payment_id = $1 where id = $2",
        [String(mpPaymentId), ourPaymentId]
      );
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(200).json({ ok: true }); // siempre 200 para que MP no reintente en loop
  } finally {
    await client.end();
  }
}
