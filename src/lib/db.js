/**
 * Funciones de acceso a la base de datos Supabase.
 * Cada función reemplaza los mock data del frontend.
 */
import { supabase } from "./supabase";

// ─── JUGADORES ────────────────────────────────────────────────────────────────

export async function getPlayers(clubId) {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("club_id", clubId)
    .order("number");
  if (error) throw error;
  return data;
}

export async function upsertPlayer(player) {
  const { data, error } = await supabase
    .from("players")
    .upsert(player)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(playerId) {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) throw error;
}

// ─── ASISTENCIA ───────────────────────────────────────────────────────────────

export async function getAttendance(clubId, date) {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("club_id", clubId)
    .eq("date", date);
  if (error) throw error;
  return data;
}

export async function markAttendance({ clubId, playerId, date, present }) {
  const { data, error } = await supabase
    .from("attendance")
    .upsert({ club_id: clubId, player_id: playerId, date, present })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── GYM LOGS ─────────────────────────────────────────────────────────────────

export async function getGymLogs(playerId, weekStart) {
  const { data, error } = await supabase
    .from("gym_logs")
    .select("*")
    .eq("player_id", playerId)
    .eq("week_start", weekStart);
  if (error) throw error;
  return data;
}

export async function getGymHistory(playerId) {
  const { data, error } = await supabase
    .from("gym_logs")
    .select("exercise, set_index, weight_kg, reps, rpe, one_rm_kg, volume_kg, week_start")
    .eq("player_id", playerId);
  if (error) throw error;
  return data;
}

export async function saveGymSet({ playerId, exercise, setIndex, weight, reps, rpe, weekStart }) {
  // one_rm_kg y volume_kg son columnas generadas por Postgres — no se envían,
  // se calculan solas a partir de weight_kg/reps.
  const { data, error } = await supabase
    .from("gym_logs")
    .upsert({
      player_id: playerId,
      exercise,
      set_index: setIndex,
      weight_kg: weight,
      reps,
      rpe,
      week_start: weekStart,
      logged_at: new Date().toISOString(),
    }, { onConflict: "player_id,exercise,set_index,week_start" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── PLAN DE GIMNASIO (microciclo) ──────────────────────────────────────────

export async function getGymPlan(clubId) {
  const { data, error } = await supabase
    .from("gym_plans")
    .select("*")
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveGymPlan({ clubId, weekLabel, coachName, sessions, published }) {
  const { data, error } = await supabase
    .from("gym_plans")
    .upsert({
      club_id: clubId,
      week_label: weekLabel,
      coach_name: coachName,
      sessions,
      published,
      updated_at: new Date().toISOString(),
    }, { onConflict: "club_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Lunes de la semana ISO que contiene `d` (por defecto, hoy), en formato YYYY-MM-DD.
export function getWeekStart(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0=domingo..6=sábado
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().split("T")[0];
}

const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Formatea un lunes (YYYY-MM-DD) como "13–19 Mayo" (o "29 Jun – 5 Jul" si cruza de mes).
export function formatWeekLabel(weekStartStr) {
  const start = new Date(weekStartStr + "T12:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MESES_ES[start.getMonth()]}`;
  }
  return `${start.getDate()} ${MESES_ES[start.getMonth()].slice(0,3)} – ${end.getDate()} ${MESES_ES[end.getMonth()].slice(0,3)}`;
}

// ─── CUOTAS / PAGOS ───────────────────────────────────────────────────────────

export async function getPayments(clubId) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, players(name, number)")
    .eq("club_id", clubId)
    .order("due_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPayment({ clubId, playerId, amount, currency, method, dueDate }) {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      club_id: clubId,
      player_id: playerId,
      amount,
      currency,
      method,
      due_date: dueDate,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── POSTS (el Muro) ─────────────────────────────────────────────────────────

export async function getPosts(clubId) {
  const { data, error } = await supabase
    .from("posts")
    .select("*, profiles(nombre, rol)")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function createPost({ clubId, authorId, text, type }) {
  const { data, error } = await supabase
    .from("posts")
    .insert({ club_id: clubId, author_id: authorId, text, type })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function likePost(postId, userId) {
  const { error } = await supabase
    .from("post_likes")
    .upsert({ post_id: postId, user_id: userId });
  if (error) throw error;
}

// ─── NÓMINAS ─────────────────────────────────────────────────────────────────

export async function getLineups(clubId, teamId) {
  const { data, error } = await supabase
    .from("lineups")
    .select("*")
    .eq("club_id", clubId)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data[0] ?? null;
}

export async function saveLineup({ clubId, teamId, formation, slots, bench }) {
  const { data, error } = await supabase
    .from("lineups")
    .upsert({
      club_id: clubId,
      team_id: teamId,
      formation,
      slots,
      bench,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── PARTIDOS ─────────────────────────────────────────────────────────────────

export async function getMatches(clubId) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("club_id", clubId)
    .order("match_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveMatch(clubId, partido) {
  const { data, error } = await supabase
    .from("matches")
    .insert({
      club_id:    clubId,
      rival:      partido.rival,
      match_date: partido.fecha,
      location:   partido.lugar,
      result:     partido.resultado || null,
      score_home: partido.golesLocal  != null ? Number(partido.golesLocal)  : null,
      score_away: partido.golesVisita != null ? Number(partido.golesVisita) : null,
      notes:      partido.resumen    || null,
      hora:       partido.hora       || null,
      estado:     partido.estado     || "programado",
      equipo:     partido.equipo     || "A",
      cat:        partido.cat        || null,
      destacados: partido.destacados || [],
      autor:      partido.autor      || null,
      tarjetas:   partido.tarjetas   || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Convierte fila de matches a objeto partido del app
export function matchToPartido(m) {
  return {
    id:          m.id,
    cat:         m.cat         || "Primer Equipo",
    equipo:      m.equipo      || "A",
    rival:       m.rival,
    fecha:       m.match_date,
    hora:        m.hora        || "00:00",
    lugar:       m.location    || "Local",
    estado:      m.estado      || "programado",
    golesLocal:  m.score_home,
    golesVisita: m.score_away,
    resultado:   m.result,
    autor:       m.autor       || "Entrenador",
    resumen:     m.notes       || "",
    destacados:  m.destacados  || [],
    tarjetas:    m.tarjetas    || [],
    videoUrl: null, aiAnalysis: null, aiStatus: null,
  };
}

// ─── NOTIFICACIONES ───────────────────────────────────────────────────────────

export async function saveNotification({ clubId, type = "general", title, body = "", data = {} }) {
  const { error } = await supabase
    .from("notifications")
    .insert({ club_id: clubId, type, title, body, data });
  if (error) throw error;
}

export async function getNotifications(clubId, limit = 20) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
