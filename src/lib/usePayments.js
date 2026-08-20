import { useState, useEffect, useCallback } from "react";
import { getPayments, createPayment, saveNotification } from "./db";
import { supabase } from "./supabase";
import { periodoDe, periodoDePago } from "./periodo";


/**
 * supabase-js no lanza cuando la base rechaza: devuelve { error }. Un
 * `await supabase.from(...).update(...)` suelto, sin mirar ese campo, se ve
 * idéntico tanto si guardó como si RLS lo bloqueó — la app avisaba "listo" y
 * la plata nunca se registraba. Acá se convierte en una excepción, que es lo
 * que el llamador ya sabe atrapar para mostrar el error.
 */
function lanzarSiFalla({ error }) {
  if (error) throw error;
}

// DB status ('pending'|'declarado'|'paid'|'failed') -> estado que leen los componentes
function paymentToUI(p) {
  return {
    id: p.id,
    playerId: p.player_id,
    playerName: p.players?.name || "",
    amount: Number(p.amount),
    method: p.method,
    date: p.paid_at || p.due_date,
    periodo: p.periodo || "",
    status: p.status,
    estado: p.status === "paid" ? "pagado" : p.status === "declarado" ? "declarado" : p.status === "failed" ? "rechazado" : "pendiente",
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

  // El jugador declara que transfirió (transferencia manual) — queda
  // "declarado" hasta que el admin lo confirme, no se marca pagado solo.
  const declarePayment = async ({ playerId, amount, method, periodo }) => {
    if (!clubId) return;
    const mes = periodo || periodoDe();
    const created = await createPayment({ clubId, playerId, amount, currency: "CLP", method, dueDate: new Date().toISOString().split("T")[0], periodo: mes });
    lanzarSiFalla(await supabase.from("payments").update({ status: "declarado" }).eq("id", created.id));
    await load();
  };

  // Acciones del admin sobre una declaración de pago
  const confirmPayment = async (paymentId, playerId) => {
    const pago = payments.find(p => p.id === paymentId);
    lanzarSiFalla(await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", paymentId));
    if (playerId) lanzarSiFalla(await supabase.from("players").update({ cuota_status: "ok" }).eq("id", playerId));
    if (clubId) {
      saveNotification({ clubId, type:"pago", title:"Pago confirmado",
        body:`Cuota de ${pago?.playerName || "un jugador"} confirmada${pago?.amount ? ` — $${pago.amount.toLocaleString()}` : ""}` }).catch(()=>{});
    }
    await load();
  };

  const rejectPayment = async (paymentId) => {
    lanzarSiFalla(await supabase.from("payments").update({ status: "failed" }).eq("id", paymentId));
    await load();
  };

  /**
   * El admin registra una cuota que se pagó fuera de la app.
   *
   * La mitad del club paga en efectivo el día del partido o transfiere sin
   * entrar nunca a SportOS. Sin esto, esa plata no existía para el sistema y
   * el jugador figuraba debiendo el mes.
   */
  const registrarPagoManual = async ({ playerId, amount, method = "Efectivo", periodo }) => {
    if (!clubId) return;
    const mes = periodo || periodoDe();
    const created = await createPayment({ clubId, playerId, amount, currency: "CLP", method, dueDate: new Date().toISOString().split("T")[0], periodo: mes });
    lanzarSiFalla(await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", created.id));
    lanzarSiFalla(await supabase.from("players").update({ cuota_status: "ok" }).eq("id", playerId));
    await load();
  };

  /** Deshace una cuota registrada por error (solo admin, por RLS). */
  const borrarPago = async (paymentId) => {
    lanzarSiFalla(await supabase.from("payments").delete().eq("id", paymentId));
    await load();
  };

  // addPayment ya no existe: escribía la cuota como pagada de una, sin pasar
  // por el admin. Ninguna pantalla lo llamaba —MiCuota usa declarePayment— y
  // las políticas de la base lo habrían rechazado igual: un jugador no puede
  // marcarse su propia cuota como cobrada. Se llevó consigo la prop que
  // viajaba de App a JugadorView y de ahí a MiCuota sin que nadie la usara.
  return { payments, loading, declarePayment, confirmPayment, rejectPayment,
           registrarPagoManual, borrarPago, reload: load, setPayments };
}

/**
 * Cómo está cada jugador en un mes dado.
 *
 * Devuelve un Map playerId -> "pagado" | "declarado" | "debe". Se mira el mes
 * y no players.cuota_status porque esa columna no se resetea nunca: decía "al
 * día" en diciembre por una cuota de marzo.
 */
export function estadoPorJugador(payments, periodo) {
  const mapa = new Map();
  for (const p of payments) {
    if (periodoDePago(p) !== periodo) continue;
    const previo = mapa.get(p.playerId);
    // Un mes puede tener varias filas (declaró, se rechazó, volvió a declarar).
    // Manda la mejor: confirmada > declarada > nada.
    if (p.estado === "pagado") mapa.set(p.playerId, "pagado");
    else if (p.estado === "declarado" && previo !== "pagado") mapa.set(p.playerId, "declarado");
  }
  return mapa;
}
