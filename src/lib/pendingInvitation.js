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

/**
 * Igual que arriba, pero para el que entró con el código del club.
 *
 * Mismo motivo: con "Confirm email" activado, signUp no deja sesión, así que
 * unirme_con_codigo() no tiene a quién asignarle el club. El código queda
 * guardado en el user_metadata y se canjea en el primer login de verdad.
 */
export async function redeemPendingCode(user) {
  const codigo = user?.user_metadata?.codigo_club;
  if (!codigo) return null;

  const { data, error } = await supabase.rpc("unirme_con_codigo", { p_codigo: codigo });

  // Se limpia pase lo que pase: si el código ya no sirve, dejarlo ahí haría
  // que cada login volviera a chocar con el mismo error.
  await supabase.auth.updateUser({ data: { codigo_club: null } });

  if (error || !data?.[0]) return null;
  const c = data[0];
  return { rol: "jugador", club_id: c.club_id, club_name: c.club_name,
           sport: c.sport, cats: "", player_id: c.player_id };
}
