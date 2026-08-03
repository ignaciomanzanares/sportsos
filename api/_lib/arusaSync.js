// Sincronización de partidos desde ARUSA (arusa.cl), que corre sobre
// Leverade/Clupik. No existe una API pública documentada para
// competiciones/partidos (requiere autenticación), pero el sitio expone un
// endpoint HTML que usa su propio filtro público de "Calendario" por club
// — el mismo que usaría cualquier visitante sin iniciar sesión. Lo leemos
// tal cual.
//
// Convención observada: el equipo listado PRIMERO en cada fila es el local
// (no hay una etiqueta explícita "Local/Visita" en el sitio, pero es la
// convención estándar de fixtures y coincide con la sede mostrada).

const ENTITIES = { "&nbsp;": " ", "&ndash;": "–", "&dash;": "‐", "&amp;": "&" };
function decodeEntities(s = "") {
  return s.replace(/&(nbsp|ndash|dash|amp);/g, m => ENTITIES[m] || m);
}

function isNumeric(s) {
  return /^\d+$/.test((s || "").trim());
}

// Parsea el fragmento HTML devuelto por /es/ajax/calendar en una lista de partidos.
export function parseArusaCalendarHtml(html, clubName) {
  const tbodyStart = html.indexOf("<tbody");
  if (tbodyStart === -1) return [];
  const tbody = html.slice(tbodyStart);
  const rows = tbody.split("<tr>").slice(1);
  const clubNameLower = clubName.trim().toLowerCase();

  const partidos = [];
  for (const rawRow of rows) {
    const row = rawRow.split("</tr>")[0];
    const idMatch = row.match(/tournament\/(\d+)\/match\/(\d+)\/results/);
    if (!idMatch) continue; // fila vacía de relleno (paginación fija de 25)
    const [, tournamentId, matchId] = idMatch;

    const [, equipoCell = "", parcialesCell = ""] = row.split(/<td class="colstyle-/);

    const catMatch = equipoCell.match(/<span class="ellipsis strong" title="([^"]*)"/);
    const category = catMatch ? decodeEntities(catMatch[1]) : null;

    const teamMatches = [...equipoCell.matchAll(/<span class="ellipsis" title="([^"]*)">/g)];
    if (teamMatches.length < 2) continue;
    const teamHome = decodeEntities(teamMatches[0][1]);
    const teamAway = decodeEntities(teamMatches[1][1]);

    const dateTimeMatch = equipoCell.match(/<span class="ellipsis text-light-gray" title="([^"]*)"/);
    const roundLabel = dateTimeMatch ? decodeEntities(dateTimeMatch[1]).split("–").pop().trim() : null;

    const isoMatch = parcialesCell.match(/data-sort="0 (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
    if (!isoMatch) continue;
    const [, isoDate, isoTime] = isoMatch;

    const statusMatch = parcialesCell.match(/<span class="label label-\w+">([^<]*)<\/span>/);
    const statusText = statusMatch ? decodeEntities(statusMatch[1]).trim() : "";
    if (/suspend|cancel/i.test(statusText)) continue; // no importamos partidos suspendidos/cancelados

    const scoreMatch = parcialesCell.match(
      /<span class="vertical-result"><span class="partial-result strong">([^<]*)<\/span><span class="partial-result strong">([^<]*)<\/span><\/span>/
    );
    const scoreHomeRaw = scoreMatch ? decodeEntities(scoreMatch[1]).trim() : null;
    const scoreAwayRaw = scoreMatch ? decodeEntities(scoreMatch[2]).trim() : null;
    const jugado = isNumeric(scoreHomeRaw) && isNumeric(scoreAwayRaw);

    const venueMatches = [...parcialesCell.matchAll(/<span class="ellipsis" title="([^"]*)">/g)];
    const venue = venueMatches.length ? decodeEntities(venueMatches[venueMatches.length - 1][1]) : null;

    const clubEsHome = teamHome.trim().toLowerCase() === clubNameLower;
    const clubEsAway = teamAway.trim().toLowerCase() === clubNameLower;
    if (!clubEsHome && !clubEsAway) continue; // no se pudo identificar al club en la fila — se omite

    const rival = clubEsHome ? teamAway : teamHome;
    const scoreHome = jugado ? Number(scoreHomeRaw) : null;
    const scoreAway = jugado ? Number(scoreAwayRaw) : null;
    let resultado = null;
    if (jugado) {
      const scoreClub = clubEsHome ? scoreHome : scoreAway;
      const scoreRival = clubEsHome ? scoreAway : scoreHome;
      resultado = scoreClub > scoreRival ? "victoria" : scoreClub < scoreRival ? "derrota" : "empate";
    }

    // location guarda "Local"/"Visita" (así lo usa el resto de la app vía
    // db.js matchToPartido/saveMatch) — no la dirección de la cancha, que
    // en cambio va como contexto adicional dentro de notes.
    partidos.push({
      external_id: matchId,
      external_source: "arusa",
      rival,
      match_date: isoDate,
      hora: isoTime.slice(0, 5),
      location: clubEsHome ? "Local" : "Visita",
      estado: jugado ? "jugado" : "programado",
      score_home: scoreHome,
      score_away: scoreAway,
      result: resultado,
      cat: category,
      notes: [roundLabel, venue].filter(Boolean).join(" · ") || null,
    });
  }
  return partidos;
}

export async function fetchArusaCalendar(arusaClubId, fromDate, toDate) {
  const fmt = d => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const url = `https://arusa.cl/es/ajax/calendar?fct=null&fsd=${encodeURIComponent(fmt(fromDate))}&fed=${encodeURIComponent(fmt(toDate))}&fc=null&fmc=${encodeURIComponent(arusaClubId)}`;
  const resp = await fetch(url, { headers: { "X-Requested-With": "XMLHttpRequest" } });
  if (!resp.ok) throw new Error(`ARUSA respondió ${resp.status}`);
  const data = await resp.json();
  if (data.code !== 0 || typeof data.content !== "string") throw new Error("Respuesta inesperada de ARUSA");
  return data.content;
}

// Sincroniza los partidos de un club contra ARUSA usando un cliente `pg` ya conectado.
export async function syncClubWithArusa(client, { clubId, clubName, arusaClubId }) {
  const today = new Date();
  const from = new Date(today.getTime() - 14 * 24 * 3600 * 1000); // 2 semanas atrás, por si hay resultados recientes
  const to = new Date(today.getTime() + 120 * 24 * 3600 * 1000); // 4 meses adelante
  const html = await fetchArusaCalendar(arusaClubId, from, to);
  const partidos = parseArusaCalendarHtml(html, clubName);

  let creados = 0, actualizados = 0;
  for (const p of partidos) {
    const { rows } = await client.query(
      `insert into matches (club_id, rival, match_date, hora, location, result, score_home, score_away, estado, cat, notes, external_source, external_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'arusa',$12)
       on conflict (club_id, external_source, external_id) where external_source is not null
       do update set rival=excluded.rival, match_date=excluded.match_date, hora=excluded.hora,
         location=excluded.location, result=excluded.result, score_home=excluded.score_home,
         score_away=excluded.score_away, estado=excluded.estado, cat=excluded.cat, notes=excluded.notes
       returning (xmax = 0) as inserted`,
      [clubId, p.rival, p.match_date, p.hora, p.location, p.result, p.score_home, p.score_away, p.estado, p.cat, p.notes, p.external_id]
    );
    if (rows[0]?.inserted) creados++; else actualizados++;
  }

  await client.query("update clubs set arusa_last_sync = now() where id = $1", [clubId]);
  return { total: partidos.length, creados, actualizados };
}
