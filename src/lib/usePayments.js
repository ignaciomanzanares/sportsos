import { useState, useEffect, useCallback } from "react";
import { getPayments, createPayment } from "./db";
import { supabase } from "./supabase";

// DB status ('pending'|'paid'|'failed') -> estado que leen los componentes ('pagado'|'pendiente'|'rechazado')
function paymentToUI(p) {
  return {
    id: p.id,
    playerId: p.player_id,
    playerName: p.players?.name || "",
    amount: Number(p.amount),
    method: p.method,
    date: p.paid_at || p.due_date,
    estado: p.status === "paid" ? "pagado" : p.status === "failed" ? "rechazado" : "pendiente",
  };
}

/**
 * Carga cuotas/pagos reales desde Supabase.
 * Sin clubId devuelve [] (App.jsx usa MOCK_PAYMENTS como vitrina de demo).
 */
export function usePayments(clubId) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!clubId) { setPayments([]); return; }
    setLoading(true);
    try {
      const data = await getPayments(clubId);
      setPayments(data.map(paymentToUI));
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  // Usado por JugadorView (MiCuota) al pagar: escribe la cuota real (pagada) y recarga.
  // No hay pasarela de pago real integrada hoy — se registra directo como pagada.
  const addPayment = async ({ playerId, amount, method }) => {
    if (!clubId) return;
    const created = await createPayment({ clubId, playerId, amount, currency: "CLP", method, dueDate: new Date().toISOString().split("T")[0] });
    await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", created.id);
    await load();
  };

  return { payments, loading, addPayment, reload: load, setPayments };
}
