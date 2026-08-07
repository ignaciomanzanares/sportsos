import { supabase } from "./supabase";

/**
 * Canjea la invitación que quedó pendiente por la confirmación de correo.
 *
 * accept_invitation() necesita auth.uid(): con "Confirm email" activado,
 * signUp no deja sesión, así que en el momento del registro no hay nadie a
 * quien asignarle el rol. El token se guarda en el user_metadata y se canjea
 * acá, en el primer login con sesión real.
 *
 * Devuelve la asignación del servidor ({ rol, club_id, club_name, sport,
 * cats }) o null si no había nada pendiente. Un token inválido o ya usado
 * también devuelve null: no es motivo para dejar al usuario fuera, entra sin
 * club y la app le ofrece pedir uno nuevo.
 */
export async function redeemPendingInvitation(user) {
  const token = user?.user_metadata?.invitacion_token;
  if (!token) return null;

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });

  // Se limpia pase lo que pase: un token quemado no sirve para reintentar, y
  // dejarlo ahí haría que cada login volviera a chocar con el mismo error.
  await supabase.auth.updateUser({ data: { invitacion_token: null } });

  if (error || !data?.[0]) return null;
  return data[0];
}
