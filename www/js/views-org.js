// Organiser tools (scorers + SportsComm admins)
import { store } from './store.js';
import { ui } from './ui.js';
import { html, raw, dayKey, todayKey, timeOf, toast, whenLabel, istIso, parseCsv, fmtNum, dayLabel } from './util.js';
import { icon, kicker, pageHead, emptyState, statusPill, matchRow } from './components.js';
import {
  STAGES, stageLabel, initialDetail, patchFromDetail, addScore, nextPeriod, addSetPoint, endSet, setsNeeded, setsWon,
  startInnings, cricketBall, cricketInfo, defaultOvers, periodName, decideWinner, ballsToOvers,
} from './scoring.js';

const CFG = window.SHAURYA_CONFIG || {};

function guard(adminOnly) {
  if (!store.user) return html`${pageHead('Organisers', '', '#/')}<div class="stack"><p class="soft">Sign in with the account SportsComm added for you.</p><a class="btn primary" href="#/login">Sign in</a></div>`;
  if (adminOnly ? !store.isAdmin : !store.isStaff) {
    return html`${pageHead('Organisers', '', '#/')}${emptyState(adminOnly ? 'Only SportsComm admins can open this page.' : 'Your account doesn’t have organiser access. Ask a SportsComm admin to add your email as a scorer.')}`;
  }
  return null;
}

async function run(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r ?? true;
  } catch (e) {
    console.error(e);
    toast(e.message || String(e), 'error');
    return false;
  }
}

// =====================================================================
// DESK
// =====================================================================
export function desk() {
  return {
    live: true,
    render() {
      const g = guard(false);
      if (g) return g;
      const mine = store.matches.filter((m) => store.canScore(m));
      const now = Date.now();
      const t = todayKey();
      const live = mine.filter((m) => m.status === 'live');
      const today = mine.filter((m) => m.status === 'scheduled' && dayKey(m.starts_at) === t);
      const later = mine.filter((m) => (m.status === 'scheduled' || m.status === 'postponed') && dayKey(m.starts_at) > t).slice(0, 12);
      const done = mine.filter((m) => m.status === 'completed').slice(-8).reverse();
      const late = mine.filter((m) => m.status === 'scheduled' && m.starts_at && new Date(m.starts_at).getTime() < now - 15 * 60000 && dayKey(m.starts_at) === t);
      const stale = live.filter((m) => m.updated_at && now - new Date(m.updated_at).getTime() > 20 * 60000);
      const roleLine = store.isAdmin ? 'Admin · all sports' : `Scorer · ${store.scorerSports.map((id) => store.sport(id)?.name).join(', ') || 'assigned matches'}`;
      const anns = store.announcements.filter((a) => a.active);
      return html`
        <div class="row between" style="padding-top:10px"><span class="org-head">ORGANISER MODE</span><a href="#/" class="small" style="font-weight:700;padding:10px 0">Fan view →</a></div>
        ${pageHead('Organiser desk', roleLine, '')}
        ${late.map((m) => html`<div class="banner warning">${icon('alert', 18)}<div class="grow"><b>${kicker(m)}</b> was due at ${timeOf(m.starts_at)} and hasn’t started.</div><a class="btn small" href="#/org/score/${m.id}">Start</a></div>`)}
        ${stale.map((m) => html`<div class="banner warning">${icon('alert', 18)}<div class="grow"><b>${store.teamShort(m.team_a_id)} vs ${store.teamShort(m.team_b_id)}</b> is live but hasn’t been updated for 20+ min.</div><a class="btn small" href="#/org/score/${m.id}">Open</a></div>`)}

        ${section('Live now', live, true)}
        ${section('Today', today)}
        ${section('Coming up', later)}
        ${section('Recently finished', done)}
        ${!mine.length ? emptyState(store.isAdmin ? 'No fixtures yet. Add them under Fixtures.' : 'No matches for your sports yet.') : ''}

        ${store.isAdmin ? html`
          <div class="section-title"><h2>Manage</h2></div>
          <div class="grid two wide3">
            ${tile('#/org/fixtures', 'calendar', 'Fixtures', 'Add, reschedule, set courts, bulk CSV')}
            ${tile('#/org/teams', 'users', 'Colleges & teams', 'Import registrations, squads')}
            ${tile('#/org/venues', 'pin', 'Venues & courts', 'Map pins and court names')}
            ${tile('#/org/staff', 'shield', 'Staff & roles', 'Add scorers and admins by email')}
            ${tile('#/org/sports', 'trophy', 'Sports settings', 'Points, periods, qualifiers')}
          </div>
          <div class="section-title"><h2>Announcements</h2></div>
          <form class="card stack" data-form="announce">
            <div class="field"><label for="ann-msg">Message shown on everyone’s home screen</label><textarea id="ann-msg" class="input" name="message" required maxlength="280" style="font-family:var(--font);font-size:15px;min-height:80px" placeholder="e.g. Football QF moved to 15:00"></textarea></div>
            <div class="row between"><label class="check"><input type="checkbox" name="warning"> Mark as important</label><button class="btn primary small" type="submit">${icon('megaphone', 16)} Post</button></div>
          </form>
          ${anns.map((a) => html`<div class="banner ${a.level}">${icon(a.level === 'warning' ? 'alert' : 'info', 18)}<div class="grow">${a.message}<div class="tiny" style="opacity:.75">${whenLabel(a.created_at)}</div></div><button class="btn small ghost" type="button" data-act="hideAnn" data-id="${a.id}">Hide</button></div>`)}
        ` : html`<div class="section-title"><h2>Manage</h2></div><div class="grid two">${tile('#/org/teams', 'users', 'Squads', 'Edit rosters for your sports')}</div>`}`;
    },
    actions: {
      async hideAnn(el) {
        const a = store.announcements.find((x) => x.id === el.dataset.id);
        if (a) await run(() => store.save('announcements', { ...a, active: false }), 'Announcement hidden');
      },
    },
    forms: {
      async announce(fd, form) {
        const ok = await run(() => store.save('announcements', { message: String(fd.get('message')).trim(), level: fd.get('warning') ? 'warning' : 'info', active: true }), 'Posted to everyone');
        if (ok) form.reset();
      },
    },
  };
}

function section(title, list, isLive) {
  if (!list.length) return '';
  return html`<div class="section-title"><h2>${isLive ? html`<span class="dot pulse"></span>` : ''}${title}</h2><span class="small muted">${list.length}</span></div>
    <div class="grid two">${list.map((m) => orgCard(m))}</div>`;
}

function orgCard(m) {
  const s = store.sport(m.sport_id);
  const title = s?.scoring === 'ranking' ? m.title || 'Event' : `${store.teamShort(m.team_a_id, m.team_a_label)} vs ${store.teamShort(m.team_b_id, m.team_b_label)}`;
  const primary = m.status === 'live' ? ['Open scoring pad', 'primary'] : m.status === 'completed' ? ['Correct result', ''] : ['Start match', ''];
  return html`<div class="card stack">
    <div class="row between"><span class="mc-kicker">${timeOf(m.starts_at)} · ${s?.name} ${m.category} · ${store.court(m.court_id)?.name || store.venue(m.venue_id)?.name || ''}</span>${statusPill(m)}</div>
    <div class="row between"><b style="font-size:16px">${title}</b>${m.status !== 'scheduled' && s?.scoring !== 'ranking' ? html`<span class="display" style="font-size:22px">${fmtNum(m.score_a)}–${fmtNum(m.score_b)}</span>` : ''}</div>
    <div class="row"><a class="btn small grow ${primary[1]}" href="#/org/score/${m.id}">${primary[0]}</a>${store.isAdmin ? html`<a class="btn small" href="#/org/fixture/${m.id}">Edit</a>` : ''}</div>
  </div>`;
}

function tile(href, ic, title, sub) {
  return html`<a class="card stack" href="${href}" style="color:var(--text);gap:6px"><span style="color:var(--accent)">${icon(ic, 22)}</span><b>${title}</b><span class="small muted">${sub}</span></a>`;
}

// =====================================================================
// SCORING PAD
// =====================================================================
export function score({ params }) {
  const id = params[0];
  let events = null;
  let busy = false;
  const loadEvents = async () => { try { events = await store.events(id); } catch (e) { events = []; } ui.refresh(); };

  const push = async (patch, text, team) => {
    if (!patch || busy) return;
    if (patch.error) { toast(patch.error, 'error'); return; }
    busy = true;
    const m = store.match(id);
    await run(() => store.score(m, patch, text, team));
    busy = false;
    loadEvents();
  };
  const sh = (m, side) => store.teamShort(side === 'a' ? m.team_a_id : m.team_b_id, side === 'a' ? m.team_a_label : m.team_b_label);

  return {
    live: true,
    mount() { loadEvents(); },
    onStore(reason, detail) { if (reason === 'match' && detail === id && !busy) loadEvents(); },
    render() {
      const g = guard(false);
      if (g) return g;
      const m = store.match(id);
      if (!m) return html`${pageHead('Scoring pad', '', '#/org')}${emptyState('Match not found.')}`;
      if (!store.canScore(m)) return html`${pageHead('Scoring pad', '', '#/org')}${emptyState('You are not assigned to score this sport.')}`;
      const s = store.sport(m.sport_id);
      const head = pageHead('Scoring pad', `${kicker(m)} · ${store.placeOf(m)}`, '#/org', html`<a class="icon-btn" href="#/match/${m.id}" aria-label="View as fan">${icon('users', 18)}</a>`);
      let body;
      if (m.status === 'scheduled' || m.status === 'postponed') body = startPanel(m, s);
      else if (s.scoring === 'cricket') body = cricketPad(m, s);
      else if (s.scoring === 'ranking') body = rankingPad(m, s);
      else if (s.scoring === 'sets') body = setsPad(m, s);
      else body = pointsPad(m, s);
      return html`${head}
        <div class="cols">
          <div class="stack">${body}</div>
          <div class="stack">
            ${m.status !== 'scheduled' ? html`<div class="row between"><h2 class="tiny muted" style="letter-spacing:.1em;font-weight:800">EVENT LOG</h2>
              <button class="btn small" type="button" data-act="undo">${icon('undo', 16)} Undo last</button></div>` : ''}
            ${events === null ? html`<div class="loading"><div class="spinner"></div></div>` : events.slice(0, 8).map((e) => html`<div class="timeline-row ${e.team === 'b' ? 'b' : ''}"><span class="tm num">${timeOf(e.created_at)}</span><span class="tx">${e.text}</span></div>`)}
            ${finishPanel(m, s)}
          </div>
        </div>`;
    },
    actions: {
      async start(el) {
        const m = store.match(id), s = store.sport(m.sport_id);
        if (s.scoring === 'cricket') {
          const overs = Number(document.getElementById('overs')?.value) || defaultOvers(s);
          const bat = el.dataset.bat;
          const p = startInnings(s, { ...m, detail: initialDetail(s, { overs }) }, bat, overs);
          await push({ ...p, status: 'live' }, `Match started · ${sh(m, bat)} batting (${overs} overs)`);
          return;
        }
        const p = patchFromDetail(s, m, initialDetail(s), { status: 'live' });
        await push(p, 'Match started');
      },
      async add(el) {
        const m = store.match(id), s = store.sport(m.sport_id);
        const side = el.dataset.side, n = Number(el.dataset.n);
        const p = s.scoring === 'sets' ? addSetPoint(s, m, side, n) : addScore(s, m, side, n);
        const txt = n > 0 ? `${sh(m, side)} +${fmtNum(n)}` : `${sh(m, side)} ${fmtNum(n)} (correction)`;
        await push(p, `${txt} · ${s.scoring === 'sets' ? curSetText(p.detail) : `${fmtNum(p.score_a)}–${fmtNum(p.score_b)}`}`, side);
      },
      async period() {
        const m = store.match(id), s = store.sport(m.sport_id);
        const before = periodName(s, m.detail?.period || 1);
        const p = nextPeriod(s, m);
        await push(p, `End of ${before} · ${fmtNum(m.score_a)}–${fmtNum(m.score_b)}`);
      },
      async endset() {
        const m = store.match(id), s = store.sport(m.sport_id);
        const i = m.detail?.current ?? 0;
        const cur = m.detail?.sets?.[i] || [0, 0];
        const p = endSet(s, m);
        if (p.error) { toast(p.error, 'error'); return; }
        const w = cur[0] > cur[1] ? 'a' : 'b';
        await push(p, `${s.period_label} ${i + 1} to ${sh(m, w)} ${fmtNum(cur[0])}–${fmtNum(cur[1])} · ${p.score_a}–${p.score_b}`, w);
      },
      async ball(el) {
        const m = store.match(id), s = store.sport(m.sport_id);
        const runs = Number(el.dataset.runs || 0);
        const wicket = el.dataset.w === '1';
        const extra = el.dataset.extra || null;
        const p = cricketBall(s, m, { runs, wicket, extra });
        if (p.error) { toast(p.error, 'error'); return; }
        const inn = p.detail.innings[p.detail.current];
        const bat = inn.bat;
        const what = wicket ? 'WICKET' : extra === 'wd' ? 'Wide' : extra === 'nb' ? 'No ball' + (runs ? ` +${runs}` : '') : extra === 'b' ? `${runs} bye${runs === 1 ? '' : 's'}` : extra === 'lb' ? `${runs} leg bye${runs === 1 ? '' : 's'}` : runs === 4 ? 'FOUR' : runs === 6 ? 'SIX' : `${runs} run${runs === 1 ? '' : 's'}`;
        await push(p, `${sh(m, bat)} ${what} · ${inn.runs}/${inn.wkts} (${ballsToOvers(inn.balls)})`, bat);
      },
      async innings() {
        const m = store.match(id), s = store.sport(m.sport_id);
        const d = m.detail || {};
        const cur = d.innings?.[d.current ?? 0];
        if (!cur) return;
        if ((d.innings || []).length >= 2) { toast('Both innings are done — end the match', 'error'); return; }
        const next = cur.bat === 'a' ? 'b' : 'a';
        const p = startInnings(s, m, next, d.overs);
        await push(p, `Innings break · ${sh(m, cur.bat)} ${cur.runs}/${cur.wkts} · target ${cur.runs + 1}`);
      },
      async finish() {
        const m = store.match(id), s = store.sport(m.sport_id);
        if (!confirmSafe('End the match and publish the final result?')) return;
        const p = patchFromDetail(s, m, m.detail || {}, { status: 'completed' });
        const res = s.scoring === 'ranking' ? 'Results published' : p.winner === 'draw' ? `Final · drawn ${fmtNum(p.score_a)}–${fmtNum(p.score_b)}` : `Final · ${sh(m, p.winner)} win ${fmtNum(p.score_a)}–${fmtNum(p.score_b)}${p.result_note ? ' · ' + p.result_note : ''}`;
        await push(p, res);
      },
      async reopen() {
        const m = store.match(id), s = store.sport(m.sport_id);
        await push({ status: 'live', winner: null, status_text: patchFromDetail(s, { ...m, status: 'live' }, m.detail || {}).status_text }, 'Match reopened for corrections');
      },
      async undo() {
        const m = store.match(id);
        busy = true;
        await run(() => store.undo(m), 'Undone');
        busy = false;
        loadEvents();
      },
      async status(el) {
        const st = el.dataset.status;
        if (!confirmSafe(`Mark this match as ${st}?`)) return;
        await push({ status: st }, `Match ${st}`);
      },
      async removeResult(el) {
        const m = store.match(id), s = store.sport(m.sport_id);
        const d = JSON.parse(JSON.stringify(m.detail || {}));
        d.results = (d.results || []).filter((_, i) => i !== Number(el.dataset.i));
        await push(patchFromDetail(s, m, d), 'Result removed');
      },
    },
    forms: {
      async override(fd) {
        const w = fd.get('winner') || null;
        const note = String(fd.get('note') || '').trim() || null;
        await push({ winner: w, result_note: note }, `Result set: ${w === 'draw' ? 'draw' : w ? sh(store.match(id), w) + ' win' : 'no winner'}${note ? ' · ' + note : ''}`);
      },
      async statusText(fd) {
        await push({ status_text: String(fd.get('st') || '').trim() || null }, null);
        toast('Status updated');
      },
      async result(fd, form) {
        const m = store.match(id), s = store.sport(m.sport_id);
        const d = JSON.parse(JSON.stringify(m.detail || {}));
        d.results = d.results || [];
        const row = { team_id: fd.get('team'), athlete: String(fd.get('athlete') || '').trim(), mark: String(fd.get('mark') || '').trim(), position: Number(fd.get('position')) || d.results.length + 1 };
        if (!row.team_id) { toast('Pick a college', 'error'); return; }
        d.results.push(row);
        d.results.sort((a, b) => a.position - b.position);
        await push(patchFromDetail(s, m, d), `${row.position}. ${store.teamShort(row.team_id)}${row.athlete ? ' — ' + row.athlete : ''}${row.mark ? ' · ' + row.mark : ''}`);
        form.reset();
      },
    },
  };
}

function confirmSafe(msg) {
  try { return window.confirm(msg); } catch (e) { return true; }
}

function curSetText(d) {
  const i = d.current ?? 0;
  const c = d.sets?.[i] || [0, 0];
  return `${fmtNum(c[0])}–${fmtNum(c[1])}`;
}

function startPanel(m, s) {
  const a = store.teamShort(m.team_a_id, m.team_a_label), b = store.teamShort(m.team_b_id, m.team_b_label);
  if (!m.team_a_id && s.scoring !== 'ranking') return html`<div class="card warn">Teams for this match aren’t set yet. ${store.isAdmin ? html`<a href="#/org/fixture/${m.id}">Set them in the fixture</a>.` : 'Ask an admin to set them.'}</div>`;
  if (s.scoring === 'cricket') {
    return html`<div class="card stack"><b style="font-size:17px">Toss done? Who bats first?</b>
      <div class="field" style="max-width:200px"><label for="overs">Overs per innings</label><input id="overs" class="input" type="number" min="1" max="50" value="${defaultOvers(s)}"></div>
      <div class="pick-row"><button class="btn primary" type="button" data-act="start" data-bat="a">${a} bat first</button><button class="btn primary" type="button" data-act="start" data-bat="b">${b} bat first</button></div></div>`;
  }
  return html`<div class="card stack">
    <div class="row between"><span class="soft">${whenLabel(m.starts_at)}</span>${statusPill(m)}</div>
    <b style="font-size:18px">${s.scoring === 'ranking' ? m.title || 'Event' : `${a} vs ${b}`}</b>
    <button class="btn primary block" type="button" data-act="start">${icon('play', 16)} Start match — go live</button>
    <div class="row"><button class="btn small grow" type="button" data-act="status" data-status="postponed">Postpone</button><button class="btn small grow danger" type="button" data-act="status" data-status="cancelled">Cancel</button></div>
  </div>`;
}

function teamPadCard(m, s, side, scoreText, buttons) {
  const label = store.teamShort(side === 'a' ? m.team_a_id : m.team_b_id, side === 'a' ? m.team_a_label : m.team_b_label);
  return html`<div class="card pad-team">
    <span class="code" style="color:${side === 'a' ? 'var(--accent-hover)' : 'var(--team-b)'}">${label}</span>
    <span class="big" aria-live="polite">${scoreText}</span>
    <div class="pad-btns">${buttons.map((n) => html`<button class="pad-btn ${side}" type="button" data-act="add" data-side="${side}" data-n="${n}" aria-label="Add ${fmtNum(n)} to ${label}">+${fmtNum(n)}</button>`)}</div>
    <button class="pad-btn minus" type="button" data-act="add" data-side="${side}" data-n="-1" aria-label="Take 1 off ${label}" style="width:100%;height:40px">−1</button>
  </div>`;
}

function pointsPad(m, s) {
  const inc = (s.increments || [1]).map(Number);
  const done = m.status === 'completed';
  const d = m.detail || {};
  const per = d.period || 1;
  const atEnd = per >= s.periods;
  return html`
    <div class="pad-teams">${teamPadCard(m, s, 'a', fmtNum(m.score_a), inc)}${teamPadCard(m, s, 'b', fmtNum(m.score_b), inc)}</div>
    ${!done ? html`<div class="card row" style="gap:10px">
      <span class="display" style="font-size:26px">${periodName(s, per)}</span>
      <span class="grow small muted">${s.periods > 1 ? `${s.periods} ${s.period_label.toLowerCase()}s` : ''}</span>
      ${s.periods > 1 || per > 1 ? html`<button class="btn small" type="button" data-act="period">${atEnd ? 'Extra period' : 'End ' + periodName(s, per)}</button>` : ''}
    </div>` : ''}
    ${statusTextForm(m)}`;
}

function setsPad(m, s) {
  const d = m.detail || {};
  const i = d.current ?? 0;
  const cur = d.sets?.[i] || [0, 0];
  const [wa, wb] = setsWon(d);
  const need = setsNeeded(s);
  const decided = wa >= need || wb >= need;
  const label = s.period_label || 'Set';
  return html`
    <div class="card row between"><span class="display" style="font-size:22px">${label} ${i + 1}</span>
      <span class="soft">${label}s won <b class="display" style="font-size:22px">${wa}–${wb}</b> · first to ${need}</span></div>
    <div class="pad-teams">${teamPadCard(m, s, 'a', fmtNum(cur[0]), [1])}${teamPadCard(m, s, 'b', fmtNum(cur[1]), [1])}</div>
    ${m.status !== 'completed' ? html`<button class="btn block" type="button" data-act="endset" ${cur[0] === cur[1] ? raw('disabled') : ''}>End ${label.toLowerCase()} ${i + 1} (${fmtNum(cur[0])}–${fmtNum(cur[1])})</button>` : ''}
    ${decided && m.status !== 'completed' ? html`<div class="banner info">${icon('info', 18)}<div>${store.teamShort(wa > wb ? m.team_a_id : m.team_b_id)} has won ${need} ${label.toLowerCase()}s — end the match to publish the result.</div></div>` : ''}
    ${label === 'Rubber' || label === 'Match' || label === 'Map' ? html`<div class="tiny muted">Use + for each game/point won inside the current ${label.toLowerCase()}, then end it.</div>` : ''}`;
}

function cricketPad(m, s) {
  const info = cricketInfo(m, s);
  const cur = info.current;
  if (!cur) return startPanel({ ...m, status: 'scheduled' }, s);
  const bat = store.teamShort(cur.bat === 'a' ? m.team_a_id : m.team_b_id);
  const done = m.status === 'completed';
  const btn = (label, attrs, cls = '') => html`<button class="ball ${cls}" type="button" data-act="ball" ${raw(attrs)}>${label}</button>`;
  return html`
    <div class="card stack">
      <div class="row between"><span class="tiny muted" style="font-weight:800;letter-spacing:.1em">${info.innings.length === 1 ? '1ST' : '2ND'} INNINGS · ${bat} BATTING</span><span class="small muted">${info.overs} overs</span></div>
      <div class="row" style="align-items:baseline;gap:12px"><span class="display" style="font-size:64px;line-height:.9">${cur.runs}/${cur.wkts}</span><span class="soft" style="font-size:18px">(${ballsToOvers(cur.balls)})</span></div>
      ${info.need ? html`<div class="soft">Target ${info.target} · need <b>${info.need.runs}</b> off ${info.need.balls} balls</div>` : info.rr ? html`<div class="small muted">Run rate ${info.rr} · extras ${cur.extras || 0}</div>` : ''}
    </div>
    ${!done ? html`<div class="ball-grid">
      ${btn('0', 'data-runs="0"')}${btn('1', 'data-runs="1"')}${btn('2', 'data-runs="2"')}${btn('3', 'data-runs="3"')}
      ${btn('4', 'data-runs="4"', 'four')}${btn('6', 'data-runs="6"', 'six')}${btn('W', 'data-w="1"', 'w')}${btn('Wd', 'data-extra="wd"', 'x')}
      ${btn('Nb', 'data-extra="nb"', 'x')}${btn('Nb+4', 'data-extra="nb" data-runs="4"', 'x')}${btn('Bye', 'data-extra="b" data-runs="1"', 'x')}${btn('Lb', 'data-extra="lb" data-runs="1"', 'x')}
    </div>
    ${info.innings.length < 2 ? html`<button class="btn block" type="button" data-act="innings">End innings — ${store.teamShort(cur.bat === 'a' ? m.team_b_id : m.team_a_id)} to bat</button>` : ''}` : ''}`;
}

function rankingPad(m, s) {
  const res = (m.detail?.results || []).slice().sort((a, b) => a.position - b.position);
  const entrants = store.teams.filter((t) => t.sport_id === m.sport_id && t.category === m.category);
  const teams = entrants.length ? entrants : store.teams.filter((t) => t.sport_id === m.sport_id);
  return html`
    <div class="card stack"><b style="font-size:17px">${m.title || 'Event'} — results</b>
      ${res.length ? res.map((r) => html`<div class="player-row" style="grid-template-columns:36px minmax(0,1fr) auto 44px"><span class="no">${r.position}</span><span><b>${store.teamShort(r.team_id)}</b>${r.athlete ? ' · ' + r.athlete : ''}</span><span class="small soft">${r.mark || ''}</span>
        <button class="icon-btn" type="button" data-act="removeResult" data-i="${(m.detail?.results || []).indexOf(r)}" aria-label="Remove result" style="width:40px;height:40px">${icon('trash', 16)}</button></div>`) : html`<div class="small muted">No results yet.</div>`}
    </div>
    ${m.status !== 'completed' ? html`<form class="card form-grid" data-form="result">
      <div class="field"><label for="r-pos">Position</label><input id="r-pos" class="input" name="position" type="number" min="1" value="${res.length + 1}"></div>
      <div class="field"><label for="r-team">College</label><select id="r-team" class="input" name="team" required><option value="">Choose…</option>${teams.map((t) => html`<option value="${t.id}">${store.college(t.college_id)?.short_name} · ${t.category}</option>`)}</select></div>
      <div class="field"><label for="r-ath">Athlete</label><input id="r-ath" class="input" name="athlete" placeholder="Name"></div>
      <div class="field"><label for="r-mark">Time / distance / weight</label><input id="r-mark" class="input" name="mark" placeholder="e.g. 12.41 s"></div>
      <button class="btn primary full" type="submit">${icon('plus', 16)} Add result</button>
    </form>` : ''}`;
}

function statusTextForm(m) {
  if (m.status !== 'live') return '';
  return html`<form class="inline-form" data-form="statusText"><div class="field"><label for="st-text">Status shown to fans (optional — clock, “Timeout”, “Super over”)</label><input id="st-text" class="input" name="st" maxlength="40" value="${m.status_text || ''}"></div><button class="btn small" type="submit">Update</button></form>`;
}

function finishPanel(m, s) {
  const res = s.scoring !== 'ranking' ? html`<details class="details card">
      <summary>Set result manually (walkover, tie-break, correction)</summary>
      <form class="stack" data-form="override">
        <div class="field"><label for="ov-w">Winner</label><select id="ov-w" class="input" name="winner">
          <option value="">— automatic from score —</option>
          <option value="a" ${m.winner === 'a' ? raw('selected') : ''}>${store.teamShort(m.team_a_id, m.team_a_label)}</option>
          <option value="b" ${m.winner === 'b' ? raw('selected') : ''}>${store.teamShort(m.team_b_id, m.team_b_label)}</option>
          <option value="draw" ${m.winner === 'draw' ? raw('selected') : ''}>Draw / tie</option></select></div>
        <div class="field"><label for="ov-note">Result note</label><input id="ov-note" class="input" name="note" value="${m.result_note || ''}" placeholder="e.g. won on penalties 4–3, walkover"></div>
        <button class="btn small" type="submit">Save result</button>
      </form></details>` : '';
  if (m.status === 'completed') {
    return html`<div class="card stack"><b>Final result published</b><span class="small muted">${m.result_note || ''}</span>
      <button class="btn small" type="button" data-act="reopen">Reopen for corrections</button></div>${res}`;
  }
  if (m.status !== 'live') return '';
  return html`<button class="btn danger block" type="button" data-act="finish">End match & publish final result</button>${res}`;
}

// =====================================================================
// FIXTURES (admin)
// =====================================================================
const fxState = { sport: '', day: '' };
export function fixtures() {
  return {
    live: true,
    render() {
      const g = guard(true);
      if (g) return g;
      const days = [...new Set([...(CFG.FEST_DAYS || []), ...store.matches.map((m) => dayKey(m.starts_at)).filter(Boolean)])].sort();
      const list = store.matches.filter((m) => (!fxState.sport || m.sport_id === fxState.sport) && (!fxState.day || dayKey(m.starts_at) === fxState.day));
      return html`
        ${pageHead('Fixtures', `${store.matches.length} total`, '#/org', html`<a class="btn small primary" href="#/org/fixture/new">${icon('plus', 16)} New</a>`)}
        <div class="form-grid" style="margin-bottom:8px">
          <div class="field"><label for="fx-s">Sport</label><select id="fx-s" class="input" data-change="sport"><option value="">All sports</option>${store.sports.map((s) => html`<option value="${s.id}" ${s.id === fxState.sport ? raw('selected') : ''}>${s.name}</option>`)}</select></div>
          <div class="field"><label for="fx-d">Day</label><select id="fx-d" class="input" data-change="day"><option value="">All days</option>${days.map((d) => html`<option value="${d}" ${d === fxState.day ? raw('selected') : ''}>${dayLabel(d)}</option>`)}</select></div>
        </div>
        ${list.length ? html`<div class="grid two">${list.map((m) => html`<div>${matchRow(m, '#/org/fixture/' + m.id)}</div>`)}</div>` : emptyState('No fixtures match.')}
        <details class="details card mt">
          <summary>${icon('upload', 16)} Bulk add fixtures from CSV</summary>
          <form class="stack" data-form="csv">
            <div class="small muted">One fixture per line. Columns: <code>sport, category, stage, group, match_no, team_a, team_b, date, time, venue, court</code>. Teams by college short name (e.g. IIMA). Stage: group, quarterfinal, semifinal, final, third_place, round, event. Date as YYYY-MM-DD, time as HH:MM (IST). A header row is ignored.</div>
            <textarea class="input" name="csv" placeholder="basketball,Men,group,A,1,IIMA,XLRI,2026-11-20,11:00,Indoor Sports Complex,Court 1"></textarea>
            <button class="btn primary" type="submit">Import fixtures</button>
          </form>
        </details>`;
    },
    change: {
      sport(el) { fxState.sport = el.value; ui.refresh(); },
      day(el) { fxState.day = el.value; ui.refresh(); },
    },
    forms: {
      async csv(fd) {
        const rows = parseCsv(String(fd.get('csv') || ''));
        const out = [];
        const errs = [];
        rows.forEach((r, i) => {
          if (i === 0 && /sport/i.test(r[0])) return;
          const [sp, cat, stage, grp, no, ta, tb, date, time, venue, court] = r;
          const sport = store.sports.find((s) => s.id === (sp || '').toLowerCase() || s.name.toLowerCase() === (sp || '').toLowerCase());
          if (!sport) { errs.push(`Line ${i + 1}: unknown sport “${sp}”`); return; }
          const category = (cat || sport.categories?.[0] || 'Men').replace(/^./, (c) => c.toUpperCase());
          const findTeam = (short) => {
            if (!short) return null;
            const col = store.colleges.find((c) => c.short_name.toLowerCase() === short.toLowerCase() || c.name.toLowerCase() === short.toLowerCase());
            return col ? store.teams.find((t) => t.college_id === col.id && t.sport_id === sport.id && t.category === category) : null;
          };
          const A = findTeam(ta), B = findTeam(tb);
          const v = store.venues.find((x) => x.name.toLowerCase() === (venue || '').toLowerCase());
          const k = v ? store.courts.find((c) => c.venue_id === v.id && c.name.toLowerCase() === (court || '').toLowerCase()) : null;
          const st = STAGES.find(([key]) => key === (stage || 'group').toLowerCase())?.[0] || 'group';
          out.push({
            sport_id: sport.id, category, stage: st, group_name: grp || null, match_no: no || null,
            team_a_id: A?.id || null, team_b_id: B?.id || null, team_a_label: A ? null : ta || null, team_b_label: B ? null : tb || null,
            title: st === 'event' ? ta || null : null,
            starts_at: istIso(date, time), venue_id: v?.id || null, court_id: k?.id || null,
          });
        });
        if (errs.length) { toast(errs.slice(0, 2).join(' · '), 'error'); return; }
        if (!out.length) { toast('Nothing to import', 'error'); return; }
        if (await run(() => store.saveMany('matches', out), `${out.length} fixture${out.length === 1 ? '' : 's'} added`)) ui.refresh();
      },
    },
  };
}

// =====================================================================
// FIXTURE FORM (admin)
// =====================================================================
export function fixture({ params }) {
  const isNew = params[0] === 'new';
  let draft = null;
  let scorers = null;
  const init = () => {
    if (draft) return;
    const m = isNew ? null : store.match(params[0]);
    if (!isNew && !m) return;
    const s0 = store.sports[0];
    draft = m ? { ...m, _date: dayKey(m.starts_at), _time: timeOf(m.starts_at) } : {
      sport_id: s0?.id || '', category: s0?.categories?.[0] || 'Men', stage: 'group', group_name: '', match_no: '', title: '',
      team_a_id: '', team_b_id: '', team_a_label: '', team_b_label: '', venue_id: '', court_id: '', stream_url: '', scorer_id: '',
      status: 'scheduled', _date: (CFG.FEST_DAYS || [])[0] || todayKey(), _time: '10:00',
    };
  };
  return {
    live: false,
    mount() {
      if (store.isAdmin) store.listStaff().then((r) => { scorers = r.staff.filter((p) => p.role === 'scorer' || p.role === 'admin'); ui.refresh(); }).catch(() => { scorers = []; });
    },
    render() {
      const g = guard(true);
      if (g) return g;
      init();
      if (!draft) return html`${pageHead('Fixture', '', '#/org/fixtures')}${emptyState('Fixture not found.')}`;
      const s = store.sport(draft.sport_id) || store.sports[0];
      const cats = s?.categories || ['Men'];
      const teamOpts = store.teams.filter((t) => t.sport_id === draft.sport_id && t.category === draft.category);
      const courts = store.courts.filter((c) => c.venue_id === draft.venue_id);
      const days = [...new Set([...(CFG.FEST_DAYS || []), draft._date].filter(Boolean))].sort();
      const ranking = s?.scoring === 'ranking';
      const sel = (v, x) => (String(v || '') === String(x || '') ? raw('selected') : '');
      const teamSelect = (side) => html`<div class="field"><label for="t-${side}">Team ${side.toUpperCase()}</label>
        <select id="t-${side}" class="input" data-change="f" name="team_${side}_id"><option value="">— not decided yet —</option>${teamOpts.map((t) => html`<option value="${t.id}" ${sel(draft['team_' + side + '_id'], t.id)}>${store.college(t.college_id)?.name}${t.group_name ? ' (Grp ' + t.group_name + ')' : ''}</option>`)}</select>
        ${!draft['team_' + side + '_id'] ? html`<input class="input" data-input="f" name="team_${side}_label" placeholder="Placeholder, e.g. Group A winner" value="${draft['team_' + side + '_label'] || ''}">` : ''}</div>`;
      return html`
        ${pageHead(isNew ? 'New fixture' : 'Edit fixture', isNew ? '' : kicker(draft), isNew ? '#/org/fixtures' : '#/org/fixtures')}
        <form class="stack" data-form="save" style="max-width:720px">
          <div class="form-grid">
            <div class="field"><label for="f-sport">Sport</label><select id="f-sport" class="input" name="sport_id" data-change="sport">${store.sports.map((x) => html`<option value="${x.id}" ${sel(draft.sport_id, x.id)}>${x.name}</option>`)}</select></div>
            <div class="field"><label for="f-cat">Category</label><select id="f-cat" class="input" name="category" data-change="cat">${cats.map((c) => html`<option ${sel(draft.category, c)}>${c}</option>`)}</select></div>
            <div class="field"><label for="f-stage">Stage</label><select id="f-stage" class="input" name="stage" data-change="f">${STAGES.map(([k, l]) => html`<option value="${k}" ${sel(draft.stage, k)}>${l}</option>`)}</select></div>
            <div class="field"><label for="f-group">${draft.stage === 'group' || draft.stage === 'league' ? 'Group' : 'Match no.'}</label>
              ${draft.stage === 'group' || draft.stage === 'league'
                ? html`<input id="f-group" class="input" name="group_name" data-input="f" value="${draft.group_name || ''}" placeholder="A">`
                : html`<input id="f-group" class="input" name="match_no" data-input="f" value="${draft.match_no || ''}" placeholder="1">`}</div>
            ${ranking || draft.stage === 'event' ? html`<div class="field full"><label for="f-title">Event title</label><input id="f-title" class="input" name="title" data-input="f" value="${draft.title || ''}" placeholder="e.g. 100 m sprint final"></div>` : ''}
            ${!ranking ? html`${teamSelect('a')}${teamSelect('b')}` : ''}
            <div class="field"><label for="f-date">Day</label><select id="f-date" class="input" name="_date" data-change="f">${days.map((d) => html`<option value="${d}" ${sel(draft._date, d)}>${dayLabel(d)}</option>`)}</select></div>
            <div class="field"><label for="f-time">Start time (IST)</label><input id="f-time" class="input" type="time" name="_time" data-input="f" value="${draft._time || ''}" required></div>
            <div class="field"><label for="f-venue">Venue</label><select id="f-venue" class="input" name="venue_id" data-change="venue"><option value="">— choose —</option>${store.venues.map((v) => html`<option value="${v.id}" ${sel(draft.venue_id, v.id)}>${v.name}</option>`)}</select></div>
            <div class="field"><label for="f-court">Court</label><select id="f-court" class="input" name="court_id" data-change="f"><option value="">—</option>${courts.map((c) => html`<option value="${c.id}" ${sel(draft.court_id, c.id)}>${c.name}</option>`)}</select></div>
            <div class="field"><label for="f-scorer">Assigned scorer (optional)</label><select id="f-scorer" class="input" name="scorer_id" data-change="f"><option value="">Anyone scoring this sport</option>${(scorers || []).map((p) => html`<option value="${p.id}" ${sel(draft.scorer_id, p.id)}>${p.full_name || p.email}</option>`)}</select></div>
            <div class="field"><label for="f-status">Status</label><select id="f-status" class="input" name="status" data-change="f">${['scheduled', 'live', 'completed', 'postponed', 'cancelled'].map((x) => html`<option value="${x}" ${sel(draft.status, x)}>${x}</option>`)}</select></div>
            <div class="field full"><label for="f-stream">Live stream link (optional — Phase 2)</label><input id="f-stream" class="input" type="url" name="stream_url" data-input="f" value="${draft.stream_url || ''}" placeholder="https://youtube.com/live/…"></div>
          </div>
          ${!venuesOk() ? html`<div class="small muted">Add venues and courts under <a href="#/org/venues">Venues</a> first.</div>` : ''}
          ${!teamOpts.length && !ranking ? html`<div class="small muted">No ${s?.name} ${draft.category} teams yet — add them under <a href="#/org/teams">Colleges & teams</a>, or use placeholders.</div>` : ''}
          <div class="row wrap"><button class="btn primary grow" type="submit">Save fixture</button>
            ${!isNew ? html`<a class="btn" href="#/org/score/${draft.id}">Scoring pad</a><button class="btn danger" type="button" data-act="del">${icon('trash', 16)} Delete</button>` : ''}</div>
        </form>`;
    },
    change: {
      f(el) { draft[el.name] = el.value; ui.refresh(); },
      sport(el) {
        draft.sport_id = el.value;
        const s = store.sport(el.value);
        if (!s.categories.includes(draft.category)) draft.category = s.categories[0];
        if (s.scoring === 'ranking') draft.stage = 'event';
        draft.team_a_id = ''; draft.team_b_id = '';
        ui.refresh();
      },
      cat(el) { draft.category = el.value; draft.team_a_id = ''; draft.team_b_id = ''; ui.refresh(); },
      venue(el) { draft.venue_id = el.value; draft.court_id = ''; ui.refresh(); },
    },
    input: { f(el) { draft[el.name] = el.value; } },
    actions: {
      async del() {
        if (!confirmSafe('Delete this fixture and its timeline?')) return;
        if (await run(() => store.remove('matches', draft.id), 'Fixture deleted')) ui.go('#/org/fixtures');
      },
    },
    forms: {
      async save() {
        const row = {
          sport_id: draft.sport_id, category: draft.category, stage: draft.stage,
          group_name: draft.group_name || null, match_no: draft.match_no || null, title: draft.title || null,
          team_a_id: draft.team_a_id || null, team_b_id: draft.team_b_id || null,
          team_a_label: draft.team_a_id ? null : draft.team_a_label || null, team_b_label: draft.team_b_id ? null : draft.team_b_label || null,
          starts_at: istIso(draft._date, draft._time), venue_id: draft.venue_id || null, court_id: draft.court_id || null,
          scorer_id: draft.scorer_id || null, status: draft.status || 'scheduled', stream_url: draft.stream_url || null,
        };
        if (!isNew) row.id = draft.id;
        if (row.team_a_id && row.team_a_id === row.team_b_id) { toast('Pick two different teams', 'error'); return; }
        const saved = await run(() => store.save('matches', row), 'Fixture saved');
        if (saved) ui.go('#/org/fixtures');
      },
    },
  };
}
function venuesOk() { return store.venues.length > 0; }

// =====================================================================
// COLLEGES & TEAMS
// =====================================================================
const tmState = { sport: '' };
export function teamsAdmin() {
  return {
    live: false,
    render() {
      const g = guard(false);
      if (g) return g;
      const admin = store.isAdmin;
      const visible = store.teams.filter((t) => (admin || store.scorerSports.includes(t.sport_id)) && (!tmState.sport || t.sport_id === tmState.sport));
      const bySport = new Map();
      visible.forEach((t) => {
        const k = `${t.sport_id}|${t.category}`;
        if (!bySport.has(k)) bySport.set(k, []);
        bySport.get(k).push(t);
      });
      const keys = [...bySport.keys()].sort((a, b) => (store.sport(a.split('|')[0])?.sort_order || 0) - (store.sport(b.split('|')[0])?.sort_order || 0));
      return html`
        ${pageHead(admin ? 'Colleges & teams' : 'Squads', `${store.colleges.length} colleges · ${store.teams.length} teams`, '#/org')}
        ${admin ? html`
          <div class="grid two">
            <form class="card stack" data-form="college">
              <b>Add college</b>
              <div class="form-grid"><div class="field full"><label for="c-name">Full name</label><input id="c-name" class="input" name="name" required placeholder="IIM Ahmedabad"></div>
                <div class="field"><label for="c-short">Short name</label><input id="c-short" class="input" name="short_name" required maxlength="8" placeholder="IIMA"></div>
                <div class="field"><label for="c-city">City</label><input id="c-city" class="input" name="city" placeholder="Ahmedabad"></div></div>
              <button class="btn small" type="submit">${icon('plus', 16)} Add college</button>
            </form>
            <form class="card stack" data-form="team">
              <b>Add team</b>
              <div class="form-grid">
                <div class="field full"><label for="t-col">College</label><select id="t-col" class="input" name="college_id" required><option value="">Choose…</option>${store.colleges.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></div>
                <div class="field"><label for="t-sp">Sport</label><select id="t-sp" class="input" name="sport_id" required>${store.sports.map((s) => html`<option value="${s.id}">${s.name}</option>`)}</select></div>
                <div class="field"><label for="t-cat">Category</label><select id="t-cat" class="input" name="category"><option>Men</option><option>Women</option><option>Mixed</option></select></div>
                <div class="field"><label for="t-grp">Group (optional)</label><input id="t-grp" class="input" name="group_name" placeholder="A"></div>
              </div>
              <button class="btn small" type="submit">${icon('plus', 16)} Add team</button>
            </form>
          </div>
          <details class="details card mt">
            <summary>${icon('upload', 16)} Import colleges & teams from CSV (e.g. a registration export)</summary>
            <form class="stack" data-form="csv">
              <div class="small muted">Columns: <code>college, short_name, sport, category, group</code>. Colleges are created if new. Sport can be the name or id (e.g. Basketball). Header row is ignored.</div>
              <textarea class="input" name="csv" placeholder="IIM Ahmedabad,IIMA,Basketball,Men,A&#10;XLRI Jamshedpur,XLRI,Basketball,Men,A"></textarea>
              <button class="btn primary" type="submit">Import</button>
            </form>
          </details>` : ''}
        <div class="field mt" style="max-width:320px"><label for="tm-s">Show sport</label><select id="tm-s" class="input" data-change="sport"><option value="">All</option>${store.sports.filter((s) => admin || store.scorerSports.includes(s.id)).map((s) => html`<option value="${s.id}" ${s.id === tmState.sport ? raw('selected') : ''}>${s.name}</option>`)}</select></div>
        ${keys.length ? keys.map((k) => {
          const [sp, cat] = k.split('|');
          return html`<div class="section-title"><h2 style="font-size:17px">${store.sport(sp)?.name} · ${cat}</h2><span class="small muted">${bySport.get(k).length}</span></div>
            <div class="grid two">${bySport.get(k).map((t) => html`<a class="list-row" href="#/org/team/${t.id}"><b class="grow">${store.college(t.college_id)?.name}</b><span class="small muted">${t.group_name ? 'Group ' + t.group_name : ''}</span>${icon('chev', 18)}</a>`)}</div>`;
        }) : emptyState('No teams yet.')}`;
    },
    change: { sport(el) { tmState.sport = el.value; ui.refresh(); } },
    forms: {
      async college(fd, form) {
        if (await run(() => store.save('colleges', { name: String(fd.get('name')).trim(), short_name: String(fd.get('short_name')).trim(), city: String(fd.get('city') || '').trim() || null }), 'College added')) { form.reset(); ui.refresh(); }
      },
      async team(fd, form) {
        const sp = store.sport(fd.get('sport_id'));
        const cat = String(fd.get('category'));
        if (sp && sp.categories && !sp.categories.includes(cat)) toast(`Note: ${sp.name} normally has ${sp.categories.join('/')} only`);
        if (await run(() => store.save('teams', { college_id: fd.get('college_id'), sport_id: fd.get('sport_id'), category: cat, group_name: String(fd.get('group_name') || '').trim() || null }), 'Team added')) { form.reset(); ui.refresh(); }
      },
      async csv(fd) {
        const rows = parseCsv(String(fd.get('csv') || ''));
        let addedC = 0, addedT = 0;
        const ok = await run(async () => {
          for (const [i, r] of rows.entries()) {
            if (i === 0 && /college/i.test(r[0])) continue;
            const [name, short, sp, cat, grp] = r;
            if (!name) continue;
            const sport = store.sports.find((s) => s.id === (sp || '').toLowerCase() || s.name.toLowerCase() === (sp || '').toLowerCase());
            let col = store.colleges.find((c) => c.name.toLowerCase() === name.toLowerCase());
            if (!col) { col = await store.save('colleges', { name, short_name: short || name.slice(0, 6), city: null }); addedC++; }
            if (!sport) continue;
            const category = (cat || sport.categories[0]).replace(/^./, (c) => c.toUpperCase());
            if (!store.teams.find((t) => t.college_id === col.id && t.sport_id === sport.id && t.category === category)) {
              await store.save('teams', { college_id: col.id, sport_id: sport.id, category, group_name: grp || null });
              addedT++;
            }
          }
        });
        if (ok) { toast(`Added ${addedC} college${addedC === 1 ? '' : 's'} and ${addedT} team${addedT === 1 ? '' : 's'}`); ui.refresh(); }
      },
    },
  };
}

// =====================================================================
// ROSTER (admins + scorers of that sport)
// =====================================================================
export function roster({ params }) {
  const id = params[0];
  let list = null;
  const load = async (force) => { const r = await store.players([id], force); list = r[id]; ui.refresh(); };
  return {
    live: false,
    mount() { load(true); },
    render() {
      const g = guard(false);
      if (g) return g;
      const t = store.team(id);
      if (!t) return html`${pageHead('Squad', '', '#/org/teams')}${emptyState('Team not found.')}`;
      if (!store.canManageTeam(t)) return html`${pageHead('Squad', '', '#/org/teams')}${emptyState('You can only edit squads for your sports.')}`;
      const s = store.sport(t.sport_id);
      return html`
        ${pageHead(store.college(t.college_id)?.name || 'Team', `${s?.name} · ${t.category}`, '#/org/teams', html`<a class="icon-btn" href="#/team/${id}" aria-label="View as fan">${icon('users', 18)}</a>`)}
        ${store.isAdmin ? html`<form class="inline-form card" data-form="group"><div class="field"><label for="g-name">Group</label><input id="g-name" class="input" name="group_name" value="${t.group_name || ''}" placeholder="A"></div>
          <button class="btn small" type="submit">Save group</button><button class="btn small danger" type="button" data-act="delTeam">${icon('trash', 16)} Delete team</button></form>` : ''}
        <div class="section-title"><h2>Squad</h2><span class="small muted">${list ? list.length : ''} players</span></div>
        ${list === null ? html`<div class="loading"><div class="spinner"></div></div>` : list.map((p) => html`<form class="player-row" data-form="player" data-id="${p.id}" style="grid-template-columns:64px minmax(0,1fr) minmax(0,.8fr) auto auto;gap:6px;padding:4px 0">
            <input class="input" name="jersey" value="${p.jersey || ''}" aria-label="Jersey number" style="min-height:42px;padding:6px 8px">
            <input class="input" name="name" value="${p.name}" required aria-label="Name" style="min-height:42px;padding:6px 10px">
            <input class="input" name="role" value="${p.role || ''}" aria-label="Role" placeholder="Role" style="min-height:42px;padding:6px 10px">
            <button class="icon-btn" type="submit" aria-label="Save ${p.name}" style="width:42px;height:42px">${icon('check', 16)}</button>
            <button class="icon-btn" type="button" data-act="delPlayer" data-id="${p.id}" aria-label="Remove ${p.name}" style="width:42px;height:42px">${icon('trash', 16)}</button>
          </form>`)}
        <form class="card form-grid mt" data-form="add">
          <div class="field"><label for="p-no">Jersey</label><input id="p-no" class="input" name="jersey" placeholder="7"></div>
          <div class="field"><label for="p-role">Role</label><input id="p-role" class="input" name="role" placeholder="Captain"></div>
          <div class="field full"><label for="p-name">Player name</label><input id="p-name" class="input" name="name" required></div>
          <button class="btn primary full" type="submit">${icon('plus', 16)} Add player</button>
        </form>
        <details class="details card mt"><summary>${icon('upload', 16)} Paste a squad (CSV)</summary>
          <form class="stack" data-form="csv"><div class="small muted">Columns: <code>jersey, name, role</code></div>
            <textarea class="input" name="csv" placeholder="7,Aarav S.,Captain&#10;11,Kabir M.,"></textarea><button class="btn primary" type="submit">Add players</button></form></details>`;
    },
    actions: {
      async delPlayer(el) { if (confirmSafe('Remove this player?') && (await run(() => store.remove('players', el.dataset.id), 'Removed'))) load(); },
      async delTeam() {
        if (!confirmSafe('Delete this team, its squad and its follows? Its fixtures keep a blank slot.')) return;
        if (await run(() => store.remove('teams', id), 'Team deleted')) ui.go('#/org/teams');
      },
    },
    forms: {
      async player(fd, form) {
        await run(() => store.save('players', { id: form.dataset.id, team_id: id, jersey: String(fd.get('jersey') || '').trim() || null, name: String(fd.get('name')).trim(), role: String(fd.get('role') || '').trim() || null }), 'Saved');
      },
      async add(fd, form) {
        if (await run(() => store.save('players', { team_id: id, jersey: String(fd.get('jersey') || '').trim() || null, name: String(fd.get('name')).trim(), role: String(fd.get('role') || '').trim() || null }), 'Player added')) { form.reset(); load(); }
      },
      async csv(fd) {
        const rows = parseCsv(String(fd.get('csv') || '')).filter((r) => r[1] && !/^name$/i.test(r[1]));
        if (!rows.length) { toast('Nothing to add', 'error'); return; }
        if (await run(() => store.saveMany('players', rows.map((r) => ({ team_id: id, jersey: r[0] || null, name: r[1], role: r[2] || null }))), `${rows.length} players added`)) load(true);
      },
      async group(fd) {
        const t = store.team(id);
        await run(() => store.save('teams', { ...t, group_name: String(fd.get('group_name') || '').trim() || null }), 'Group saved');
      },
    },
  };
}

// =====================================================================
// VENUES (admin)
// =====================================================================
export function venuesAdmin() {
  return {
    live: false,
    render() {
      const g = guard(true);
      if (g) return g;
      return html`
        ${pageHead('Venues & courts', 'Fans see these on the Venues tab with directions', '#/org')}
        <form class="card form-grid" data-form="venue">
          <div class="field full"><label for="v-name">New venue</label><input id="v-name" class="input" name="name" required placeholder="Indoor Sports Complex"></div>
          <div class="field full"><label for="v-desc">Description</label><input id="v-desc" class="input" name="description" placeholder="Basketball, badminton"></div>
          <div class="field"><label for="v-lat">Latitude</label><input id="v-lat" class="input" name="lat" inputmode="decimal" placeholder="23.0322"></div>
          <div class="field"><label for="v-lng">Longitude</label><input id="v-lng" class="input" name="lng" inputmode="decimal" placeholder="72.5369"></div>
          <label class="check full"><input type="checkbox" name="indoor"> Indoor venue</label>
          <div class="tiny muted full">Tip: in Google Maps, long-press the spot and copy the two numbers shown.</div>
          <button class="btn primary full" type="submit">${icon('plus', 16)} Add venue</button>
        </form>
        ${store.venues.map((v) => html`<div class="card stack mt">
          <form class="form-grid" data-form="editVenue" data-id="${v.id}">
            <div class="field full"><label>Name</label><input class="input" name="name" value="${v.name}" required></div>
            <div class="field full"><label>Description</label><input class="input" name="description" value="${v.description || ''}"></div>
            <div class="field"><label>Latitude</label><input class="input" name="lat" value="${v.lat ?? ''}" inputmode="decimal"></div>
            <div class="field"><label>Longitude</label><input class="input" name="lng" value="${v.lng ?? ''}" inputmode="decimal"></div>
            <label class="check"><input type="checkbox" name="indoor" ${v.indoor ? raw('checked') : ''}> Indoor</label>
            <div class="row" style="justify-content:flex-end"><button class="btn small" type="submit">Save</button><button class="btn small danger" type="button" data-act="delVenue" data-id="${v.id}" aria-label="Delete venue">${icon('trash', 16)}</button></div>
          </form>
          <div class="row wrap">${store.courts.filter((c) => c.venue_id === v.id).map((c) => html`<span class="chip small">${c.name}<button type="button" data-act="delCourt" data-id="${c.id}" aria-label="Remove ${c.name}" style="background:none;border:none;color:var(--muted);padding:0 0 0 4px">×</button></span>`)}</div>
          <form class="inline-form" data-form="court" data-venue="${v.id}"><div class="field"><label>Add court</label><input class="input" name="name" required placeholder="Court 1"></div><button class="btn small" type="submit">${icon('plus', 16)} Add</button></form>
        </div>`)}`;
    },
    actions: {
      async delVenue(el) { if (confirmSafe('Delete this venue and its courts?')) await run(() => store.remove('venues', el.dataset.id), 'Venue deleted'); },
      async delCourt(el) { await run(() => store.remove('courts', el.dataset.id), 'Court removed'); },
    },
    forms: {
      async venue(fd, form) {
        if (await run(() => store.save('venues', venueRow(fd)), 'Venue added')) form.reset();
      },
      async editVenue(fd, form) {
        await run(() => store.save('venues', { id: form.dataset.id, ...venueRow(fd) }), 'Saved');
      },
      async court(fd, form) {
        if (await run(() => store.save('courts', { venue_id: form.dataset.venue, name: String(fd.get('name')).trim() }), 'Court added')) form.reset();
      },
    },
  };
}
function venueRow(fd) {
  const num = (x) => (String(x || '').trim() === '' ? null : Number(x));
  return { name: String(fd.get('name')).trim(), description: String(fd.get('description') || '').trim() || null, lat: num(fd.get('lat')), lng: num(fd.get('lng')), indoor: !!fd.get('indoor') };
}

// =====================================================================
// STAFF (admin)
// =====================================================================
export function staff() {
  let data = null;
  const load = async () => {
    try { data = await store.listStaff(); } catch (e) { data = { staff: [], assignments: [], invites: [], error: e.message }; }
    ui.refresh();
  };
  return {
    live: false,
    mount() { load(); },
    render() {
      const g = guard(true);
      if (g) return g;
      const sportsOf = (uid) => (data?.assignments || []).filter((a) => a.user_id === uid).map((a) => store.sport(a.sport_id)?.name).join(', ');
      return html`
        ${pageHead('Staff & roles', 'Scorers update live scores for their sports. Admins control everything.', '#/org')}
        <form class="card stack" data-form="set">
          <b>Add or change a staff member</b>
          <div class="form-grid">
            <div class="field full"><label for="s-email">Email they sign in with</label><input id="s-email" class="input" type="email" name="email" required placeholder="volunteer@iima.ac.in"></div>
            <div class="field full"><label for="s-role">Role</label><select id="s-role" class="input" name="role"><option value="scorer">Scorer</option><option value="admin">Admin</option><option value="fan">Remove staff access</option></select></div>
          </div>
          <fieldset style="border:none;margin:0;padding:0"><legend class="small muted" style="font-weight:600;padding-bottom:6px">Sports they can score (scorers)</legend>
            <div class="row wrap">${store.sports.map((s) => html`<label class="chip small" style="gap:8px"><input type="checkbox" name="sports" value="${s.id}" style="accent-color:var(--accent)"> ${s.name}</label>`)}</div></fieldset>
          <button class="btn primary" type="submit">Save</button>
          <div class="tiny muted">If they haven’t signed in yet, the role is applied automatically on their first sign-in.</div>
        </form>
        ${data === null ? html`<div class="loading"><div class="spinner"></div></div>` : html`
          ${data.error ? html`<div class="banner warning">${data.error}</div>` : ''}
          <div class="section-title"><h2>Staff</h2><span class="small muted">${data.staff.length}</span></div>
          ${data.staff.length ? data.staff.map((p) => html`<div class="list-row"><span class="grow"><b>${p.full_name || p.email}</b><div class="small muted">${p.email}${p.role === 'scorer' ? ' · ' + (sportsOf(p.id) || 'no sports yet') : ''}</div></span><span class="pill ${p.role === 'admin' ? 'org' : 'final'}">${p.role}</span></div>`) : emptyState('No staff yet.')}
          ${data.invites.length ? html`<div class="section-title"><h2>Waiting for first sign-in</h2></div>
            ${data.invites.map((i) => html`<div class="list-row"><span class="grow"><b>${i.email}</b><div class="small muted">${i.role}${i.sports?.length ? ' · ' + i.sports.map((x) => store.sport(x)?.name).join(', ') : ''}</div></span><span class="pill warn">Invited</span></div>`)}` : ''}`}`;
    },
    forms: {
      async set(fd, form) {
        const email = String(fd.get('email')).trim();
        const role = String(fd.get('role'));
        const sports = fd.getAll('sports').map(String);
        if (role === 'scorer' && !sports.length) { toast('Pick at least one sport for a scorer', 'error'); return; }
        const r = await run(() => store.setStaff(email, role, sports));
        if (r) { toast(r === 'invited' ? 'Invite saved — applies on first sign-in' : r === 'removed' ? 'Access removed' : 'Role updated'); form.reset(); load(); }
      },
    },
  };
}

// =====================================================================
// SPORTS SETTINGS (admin)
// =====================================================================
export function sportsAdmin() {
  return {
    live: false,
    render() {
      const g = guard(true);
      if (g) return g;
      return html`
        ${pageHead('Sports settings', 'Points, periods and how many teams qualify from each group', '#/org')}
        <div class="grid two">${store.sports.map((s) => html`<form class="card stack" data-form="sport" data-id="${s.id}">
          <div class="row between"><b>${s.name}</b><span class="pill final">${s.scoring}</span></div>
          <div class="form-grid">
            <div class="field"><label>${s.scoring === 'sets' ? 'Best of' : 'Periods'}</label><input class="input" type="number" min="1" max="9" name="periods" value="${s.periods}"></div>
            <div class="field"><label>Period name</label><input class="input" name="period_label" value="${s.period_label}"></div>
            <div class="field"><label>Win pts</label><input class="input" type="number" step="0.5" name="win_points" value="${s.win_points}"></div>
            <div class="field"><label>Draw pts</label><input class="input" type="number" step="0.5" name="draw_points" value="${s.draw_points}"></div>
            <div class="field"><label>Qualify per group</label><input class="input" type="number" min="0" max="8" name="qualify_per_group" value="${s.qualify_per_group}"></div>
            <div class="field"><label>Score buttons</label><input class="input" name="increments" value="${(s.increments || []).join(', ')}"></div>
            <div class="field full"><label>Categories</label><input class="input" name="categories" value="${(s.categories || []).join(', ')}"></div>
          </div>
          <button class="btn small" type="submit">Save ${s.name}</button>
        </form>`)}</div>`;
    },
    forms: {
      async sport(fd, form) {
        const s = store.sport(form.dataset.id);
        const list = (k) => String(fd.get(k) || '').split(',').map((x) => x.trim()).filter(Boolean);
        await run(() => store.save('sports', {
          ...s,
          periods: Number(fd.get('periods')) || 1, period_label: String(fd.get('period_label')).trim() || s.period_label,
          win_points: Number(fd.get('win_points')), draw_points: Number(fd.get('draw_points')), qualify_per_group: Number(fd.get('qualify_per_group')),
          increments: list('increments').map(Number).filter((x) => x > 0), categories: list('categories'),
        }), `${s.name} saved`);
      },
    },
  };
}
