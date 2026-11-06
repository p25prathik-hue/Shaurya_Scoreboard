// Reusable UI pieces
import { store } from './store.js';
import { html, raw, esc, timeOf, initials, badgeColor, whenLabel, fmtNum } from './util.js';
import { stageLabel, scoreLine, breakdown } from './scoring.js';

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  radio: '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  nav: '<path d="M3 11l18-8-8 18-2-8z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H4"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
  google: '',
};

export function icon(name, size = 20, extra = '') {
  if (name === 'google') {
    return raw(`<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`);
  }
  const fill = name === 'play' || extra === 'fill' ? 'currentColor' : 'none';
  return raw(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
}

export function teamBadge(teamId, label, cls = '') {
  const c = store.teamCollege(teamId);
  const txt = c ? c.short_name : initials(label || '?');
  const bg = c ? badgeColor(c.id) : '#3A3031';
  const ink = bg === '#FF6A2B' ? '#160C08' : '#fff';
  return html`<span class="badge ${cls}" style="background:${raw(bg)};color:${raw(ink)}">${txt.slice(0, 6)}</span>`;
}

export function kicker(m) {
  const s = store.sport(m.sport_id);
  if (m.stage === 'event') return `${s?.name || m.sport_id} · ${m.category} · ${m.title || 'Event'}`;
  return `${s?.name || m.sport_id} · ${m.category} · ${stageLabel(m)}`;
}

export function statusPill(m) {
  if (m.status === 'live') return html`<span class="live-tag"><span class="dot pulse"></span>LIVE${m.status_text ? ' · ' + m.status_text : ''}</span>`;
  if (m.status === 'completed') return html`<span class="pill final">Final</span>`;
  if (m.status === 'cancelled') return html`<span class="pill out">Cancelled</span>`;
  if (m.status === 'postponed') return html`<span class="pill warn">Postponed</span>`;
  return html`<span class="pill soon">${whenLabel(m.starts_at)}</span>`;
}

function rankingSummary(m) {
  const res = (m.detail?.results || []).slice().sort((a, b) => (Number(a.position) || 99) - (Number(b.position) || 99));
  if (!res.length) return html`<div class="muted small">Results not in yet</div>`;
  return html`<div class="stack tight">${res.slice(0, 3).map((r) => html`<div class="mc-team"><span class="nm">${r.position}. ${store.teamShort(r.team_id)}${r.athlete ? ' — ' + r.athlete : ''}</span><span class="small soft nowrap">${r.mark || ''}</span></div>`)}</div>`;
}

// Large card used on Home and lists
export function matchCard(m, opts = {}) {
  const s = store.sport(m.sport_id);
  const sl = scoreLine(m, s);
  const done = m.status === 'completed';
  const loseA = done && m.winner === 'b';
  const loseB = done && m.winner === 'a';
  const href = opts.href || `#/match/${m.id}`;
  const body = s?.scoring === 'ranking'
    ? rankingSummary(m)
    : html`<div class="stack tight">
        <div class="mc-team ${loseA ? 'lose' : ''}"><span class="nm">${store.teamName(m.team_a_id, m.team_a_label)}</span><span class="sc">${sl.a}</span></div>
        <div class="mc-team ${loseB ? 'lose' : ''}"><span class="nm">${store.teamName(m.team_b_id, m.team_b_label)}</span><span class="sc">${sl.b}</span></div>
      </div>`;
  const right = sl.overs ? `${sl.overs} ov${sl.note ? ' · ' + sl.note : ''}` : sl.note || (done && m.result_note ? m.result_note : '');
  return html`<a class="card match-card" href="${href}">
    <div class="mc-top"><span class="mc-kicker">${kicker(m)}</span>${statusPill(m)}</div>
    ${body}
    <div class="mc-foot">${icon('pin', 14)}<span class="ellipsis">${store.placeOf(m)}</span><span class="right">${right}</span></div>
  </a>`;
}

// Compact row for schedules
export function matchRow(m, href) {
  const done = m.status === 'completed';
  const s = store.sport(m.sport_id);
  const sl = scoreLine(m, s);
  const title = s?.scoring === 'ranking' ? (m.title || 'Event') : `${store.teamShort(m.team_a_id, m.team_a_label)} vs ${store.teamShort(m.team_b_id, m.team_b_label)}`;
  return html`<a class="list-row" href="${href || '#/match/' + m.id}">
    <span class="time">${m.status === 'live' ? html`<span class="live-tag"><span class="dot pulse"></span>LIVE</span>` : timeOf(m.starts_at)}</span>
    <span class="grow stack tight">
      <span class="k ellipsis">${kicker(m)}</span>
      <span class="t ellipsis">${title}${done && s?.scoring !== 'ranking' ? html` <span class="soft">· ${sl.a}–${sl.b}</span>` : ''}</span>
      <span class="small muted ellipsis">${store.placeOf(m)}</span>
    </span>
    <span class="chev">${icon('chev', 18)}</span>
  </a>`;
}

export function scoreboard(m) {
  const s = store.sport(m.sport_id);
  const sl = scoreLine(m, s);
  const done = m.status === 'completed';
  const notStarted = m.status === 'scheduled' || m.status === 'postponed' || m.status === 'cancelled';
  const bd = breakdown(m, s);
  const teamEl = (side) => {
    const id = side === 'a' ? m.team_a_id : m.team_b_id;
    const label = side === 'a' ? m.team_a_label : m.team_b_label;
    const inner = html`${teamBadge(id, label)}<span class="nm">${store.teamName(id, label)}</span>`;
    return id ? html`<a class="sb-team" href="#/team/${id}">${inner}</a>` : html`<div class="sb-team">${inner}</div>`;
  };
  if (s?.scoring === 'ranking') {
    return html`<section class="card scoreboard" aria-label="Results">
      <div class="row between"><span class="display" style="font-size:22px">${m.title || 'Event'}</span>${statusPill(m)}</div>
      ${rankingTable(m)}
    </section>`;
  }
  let center;
  if (notStarted) center = html`<div class="sb-score" style="font-size:26px;flex-direction:column;align-items:center;gap:4px"><span>${timeOf(m.starts_at)}</span><span class="small muted" style="font-family:var(--font);font-weight:600">${m.status === 'scheduled' ? 'Starts' : m.status}</span></div>`;
  else if (s?.scoring === 'cricket') center = html`<div class="sb-score cricket"><span>${sl.a}</span><span class="small muted" style="font-family:var(--font)">vs</span><span>${sl.b}</span></div>`;
  else center = html`<div class="sb-score"><span class="${done && m.winner === 'b' ? 'lose' : ''}">${sl.a}</span><span class="sep">–</span><span class="${done && m.winner === 'a' ? 'lose' : ''}">${sl.b}</span></div>`;
  return html`<section class="card scoreboard" aria-label="Scoreboard">
    <div class="row" style="justify-content:center">${m.status === 'live' ? html`<span class="pill live"><span class="dot pulse"></span>Live${m.status_text ? ' · ' + m.status_text : ''}</span>` : statusPill(m)}</div>
    <div class="sb-teams">${teamEl('a')}${center}${teamEl('b')}</div>
    ${done && m.result_note ? html`<div class="result-note">${m.winner === 'a' || m.winner === 'b' ? store.teamShort(m.winner === 'a' ? m.team_a_id : m.team_b_id, m.winner === 'a' ? m.team_a_label : m.team_b_label) + ' ' : ''}${m.result_note}</div>` : ''}
    ${s?.scoring === 'cricket' && !notStarted ? cricketLines(m, s) : ''}
    ${sl.note && s?.scoring !== 'cricket' ? html`<div class="result-note small">${sl.note}</div>` : ''}
    ${bd ? breakdownTable(m, bd) : ''}
  </section>`;
}

function cricketLines(m) {
  const d = m.detail || {};
  const inns = d.innings || [];
  if (!inns.length) return '';
  const target = inns.length >= 2 ? inns[0].runs + 1 : null;
  return html`<div class="stack tight small" style="border-top:1px solid var(--line);padding-top:10px">
    ${inns.map((inn, i) => html`<div class="row between"><span>${store.teamShort(inn.bat === 'a' ? m.team_a_id : m.team_b_id)} · ${i === 0 ? '1st' : '2nd'} innings</span><span class="num"><b>${inn.runs}/${inn.wkts}</b> <span class="muted">(${Math.floor(inn.balls / 6)}.${inn.balls % 6} / ${d.overs} ov)</span></span></div>`)}
    ${target && m.status === 'live' ? html`<div class="muted">Target ${target}</div>` : ''}
    ${scoreLine(m, store.sport(m.sport_id)).note && m.status === 'live' ? html`<div class="soft">${scoreLine(m, store.sport(m.sport_id)).note}</div>` : ''}
  </div>`;
}

function breakdownTable(m, bd) {
  return html`<table class="breakdown" style="border-top:1px solid var(--line)"><thead><tr><th></th>${bd.cols.map((c) => html`<th>${c.label}</th>`)}<th>${bd.totalLabel}</th></tr></thead>
    <tbody>
      <tr><td>${store.teamShort(m.team_a_id, m.team_a_label)}</td>${bd.cols.map((c) => html`<td class="${c.current ? 'cur' : ''}">${c.a === undefined ? '–' : fmtNum(c.a)}</td>`)}<td class="tot">${bd.totalA}</td></tr>
      <tr><td>${store.teamShort(m.team_b_id, m.team_b_label)}</td>${bd.cols.map((c) => html`<td class="${c.current ? 'cur' : ''}">${c.b === undefined ? '–' : fmtNum(c.b)}</td>`)}<td class="tot">${bd.totalB}</td></tr>
    </tbody></table>`;
}

export function rankingTable(m) {
  const res = (m.detail?.results || []).slice().sort((a, b) => (Number(a.position) || 99) - (Number(b.position) || 99));
  if (!res.length) return html`<div class="empty">Results will appear here once organisers enter them.</div>`;
  return html`<div class="table-wrap"><table class="std"><thead><tr><th class="l">#</th><th class="l">College</th><th class="l">Athlete</th><th>Mark</th></tr></thead><tbody>
    ${res.map((r) => html`<tr><td class="l">${r.position <= 3 ? html`<span class="medal ${['g', 's', 'b'][r.position - 1]}">${r.position}</span>` : r.position}</td><td class="l"><a href="#/team/${r.team_id}">${store.teamShort(r.team_id)}</a></td><td class="l">${r.athlete || ''}</td><td>${r.mark || ''}</td></tr>`)}
  </tbody></table></div>`;
}

export function pageHead(title, sub, backHref, right = '') {
  return html`<div class="page-head">
    ${backHref ? html`<a class="back" href="${backHref}" aria-label="Back">${icon('back', 22)}</a>` : ''}
    <div class="grow"><h1>${title}</h1>${sub ? html`<div class="sub">${sub}</div>` : ''}</div>${right}
  </div>`;
}

export function emptyState(text) {
  return html`<div class="empty">${text}</div>`;
}

export function mapsLink(v) {
  if (v && v.lat != null && v.lng != null) return `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((v?.name ? v.name + ', ' : '') + 'IIM Ahmedabad');
}

export function sportOptions(selected, { includeAll = false, filter } = {}) {
  const list = store.sports.filter((s) => !filter || filter(s));
  return html`${includeAll ? html`<option value="">All sports</option>` : ''}${list.map((s) => html`<option value="${s.id}" ${s.id === selected ? raw('selected') : ''}>${s.name}</option>`)}`;
}

export function collegeName(id) {
  return esc(store.college(id)?.name || '');
}
