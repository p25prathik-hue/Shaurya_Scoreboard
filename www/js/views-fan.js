// Fan-facing screens
import { store, isNative } from './store.js';
import { ui } from './ui.js';
import { html, raw, dayKey, todayKey, weekday, dayNum, timeOf, relTime, toast, qs, whenLabel, fmtNum } from './util.js';
import { icon, matchCard, matchRow, scoreboard, teamBadge, kicker, pageHead, emptyState, mapsLink, statusPill } from './components.js';
import {
  isTableMatch, groupTeams, computeTable, playedResults, whatIf, qualStatus, trackSummary, nextRoundName,
  allowsDraw, marginOptions, marginLabel, defaultMargin, tiebreakName, medalTally, stageLabel,
} from './scoring.js';

const CFG = window.SHAURYA_CONFIG || {};

function allDays() {
  const set = new Set(CFG.FEST_DAYS || []);
  store.matches.forEach((m) => m.starts_at && set.add(dayKey(m.starts_at)));
  return [...set].sort();
}
function defaultDay(days) {
  const t = todayKey();
  if (days.includes(t)) return t;
  const liveDay = store.matches.find((m) => m.status === 'live');
  if (liveDay) return dayKey(liveDay.starts_at);
  return days.find((d) => d >= t) || days[days.length - 1] || t;
}

// =====================================================================
// HOME
// =====================================================================
const homeState = { day: null, sport: 'all' };

export function home() {
  return {
    live: true,
    render() {
      const days = allDays();
      if (!homeState.day || !days.includes(homeState.day)) homeState.day = defaultDay(days);
      const following = store.follows;
      const filt = (m) => {
        if (homeState.sport === 'all') return true;
        if (homeState.sport === 'mine') return following.has(m.team_a_id) || following.has(m.team_b_id) || (m.detail?.results || []).some((r) => following.has(r.team_id));
        return m.sport_id === homeState.sport;
      };
      const sportsWithMatches = store.sports.filter((s) => store.matches.some((m) => m.sport_id === s.id));
      const chips = [{ id: 'all', label: 'All' }];
      if (following.size) chips.push({ id: 'mine', label: '★ My teams' });
      sportsWithMatches.forEach((s) => chips.push({ id: s.id, label: s.name }));

      const liveM = store.matches.filter((m) => m.status === 'live' && filt(m));
      const dayM = store.matches.filter((m) => m.starts_at && dayKey(m.starts_at) === homeState.day && filt(m));
      const upcoming = dayM.filter((m) => m.status === 'scheduled' || m.status === 'postponed');
      const results = dayM.filter((m) => m.status === 'completed').reverse();
      const anns = store.announcements.filter((a) => a.active).slice(-3).reverse();
      const t = todayKey();

      return html`
        ${anns.map((a) => html`<div class="banner ${a.level}" role="status">${icon(a.level === 'warning' ? 'alert' : 'info', 18)}<div class="grow"><div>${a.message}</div><div class="tiny" style="opacity:.75;margin-top:2px">${relTime(a.created_at)}</div></div></div>`)}
        <div class="days" role="group" aria-label="Fest day">
          ${days.map((d, i) => html`<button type="button" class="day" data-act="day" data-day="${d}" aria-pressed="${d === homeState.day}">
            <span>${weekday(d)}${d === t ? ' · Today' : i === days.length - 1 && days.length > 1 ? ' · Finals' : ''}</span><b>${dayNum(d)}</b></button>`)}
        </div>
        <div class="chips" role="group" aria-label="Filter by sport">
          ${chips.map((c) => html`<button type="button" class="chip" data-act="sport" data-sport="${c.id}" aria-pressed="${homeState.sport === c.id}">${c.label}</button>`)}
        </div>

        <div class="section-title"><h2><span class="dot pulse"></span>Live now</h2><span class="small muted">${liveM.length} match${liveM.length === 1 ? '' : 'es'}</span></div>
        ${liveM.length ? html`<div class="grid two wide3">${liveM.map((m) => matchCard(m))}</div>` : emptyState(homeState.sport === 'all' ? 'Nothing live right now — see what’s up next below.' : 'Nothing live in this filter right now.')}

        ${whatIfCta()}

        <div class="section-title"><h2>Up next</h2><a href="#/venues" class="small" style="font-weight:700">By venue</a></div>
        ${upcoming.length ? html`<div class="grid two">${upcoming.map((m) => html`<div>${matchRow(m)}</div>`)}</div>` : emptyState('Nothing else scheduled for this day.')}

        ${results.length ? html`<div class="section-title"><h2>Results</h2><span class="small muted">${results.length}</span></div>
          <div class="grid two">${results.map((m) => html`<div>${matchRow(m)}</div>`)}</div>` : ''}
        <p class="footer-note">IIMA SportsComm · Shaurya’26 · ${store.mode === 'demo' ? 'Demo data' : 'Scores update live'}</p>
      `;
    },
    actions: {
      day(el) { homeState.day = el.dataset.day; ui.refresh(); },
      sport(el) { homeState.sport = el.dataset.sport; ui.refresh(); },
    },
  };
}

function whatIfCta() {
  // Find a followed team in a group that still has games to play
  let target = null;
  for (const tid of store.follows) {
    const t = store.team(tid);
    if (!t || !t.group_name) continue;
    const open = store.matches.some((m) => m.sport_id === t.sport_id && m.category === t.category && isTableMatch(m) && (m.group_name || '') === t.group_name && m.status !== 'completed');
    if (open) { target = t; break; }
  }
  const href = target
    ? '#/standings' + qs({ sport: target.sport_id, cat: target.category, group: target.group_name, track: target.id })
    : '#/standings';
  const head = target ? `Can ${store.college(target.college_id)?.short_name} still make it?` : 'Can your college still qualify?';
  const sub = target ? `Play out the last ${store.sport(target.sport_id)?.name} Group ${target.group_name} games in the what-if calculator` : 'Pick results for the games left and see who goes through';
  return html`<a class="card accent row mt" href="${href}" style="gap:14px;color:var(--text)">
    <span class="pin" style="width:44px;height:44px;border-radius:12px">${icon('chart', 22)}</span>
    <span class="grow stack tight"><b style="font-size:16px">${head}</b><span class="small" style="color:#e6cfc4">${sub}</span></span>
    ${icon('chev', 20)}
  </a>`;
}

// =====================================================================
// MATCH CENTRE
// =====================================================================
const matchTabs = new Map();

export function match({ params }) {
  const id = params[0];
  let events = null;
  let players = null;
  let loading = false;
  const loadEvents = async () => {
    if (loading) return;
    loading = true;
    try { events = await store.events(id); } catch (e) { events = []; }
    loading = false;
    ui.refresh();
  };
  const loadPlayers = async (m) => {
    try { players = await store.players([m.team_a_id, m.team_b_id].filter(Boolean)); } catch (e) { players = {}; }
    ui.refresh();
  };
  return {
    live: true,
    mount() { loadEvents(); },
    onStore(reason, detail) { if (reason === 'match' && detail === id) loadEvents(); },
    render() {
      const m = store.match(id);
      if (!m) return html`${pageHead('Match', '', '#/')}${emptyState(store.ready ? 'This match no longer exists.' : 'Loading…')}`;
      const s = store.sport(m.sport_id);
      const tab = matchTabs.get(id) || (s?.scoring === 'ranking' ? 'venue' : 'timeline');
      const tabs = s?.scoring === 'ranking' ? [['venue', 'Venue']] : [['timeline', 'Timeline'], ['lineups', 'Lineups'], ['venue', 'Venue']];
      if (tab === 'lineups' && players === null) loadPlayers(m);
      const v = store.venue(m.venue_id), c = store.court(m.court_id);
      const nextHere = store.matches.filter((x) => x.id !== m.id && x.court_id && x.court_id === m.court_id && x.status === 'scheduled').slice(0, 3);
      const canScore = store.canScore(m);
      return html`
        ${pageHead(`${s?.name || ''} · ${m.category}`, s?.scoring === 'ranking' ? (m.title || '') : stageLabel(m) + (m.match_no && m.stage === 'group' ? ` · Match ${m.match_no}` : ''), '#/', html`<button class="icon-btn" type="button" data-act="share" aria-label="Share match">${icon('share', 20)}</button>`)}
        <div class="cols">
          <div class="stack">
            ${scoreboard(m)}
            ${m.stream_url ? html`<a class="card row" href="${m.stream_url}" target="_blank" rel="noopener" style="gap:14px;color:var(--text)"><span class="pin" style="width:44px;height:44px;border-radius:22px">${icon('play', 18)}</span><span class="grow"><b>Watch live</b><div class="small muted">Opens the stream</div></span>${icon('chev', 18)}</a>` : ''}
            ${canScore || store.isAdmin ? html`<div class="row wrap">
              ${canScore ? html`<a class="btn blue grow" href="#/org/score/${m.id}">${icon('radio', 18)} Open scoring pad</a>` : ''}
              ${store.isAdmin ? html`<a class="btn small" href="#/org/fixture/${m.id}">${icon('edit', 16)} Edit fixture</a>` : ''}
            </div>` : ''}
          </div>
          <div>
            <div class="tabs" role="tablist">${tabs.map(([k, l]) => html`<button type="button" role="tab" data-act="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`)}</div>
            <div style="padding-top:8px">
              ${tab === 'timeline' ? timeline(m, events) : ''}
              ${tab === 'lineups' ? lineups(m, players) : ''}
              ${tab === 'venue' ? html`<div class="stack" style="padding-top:8px">
                <div class="stack tight"><b style="font-size:17px">${v?.name || 'Venue to be confirmed'}${c ? ' · ' + c.name : ''}</b>
                  ${v?.description ? html`<span class="small muted">${v.description}</span>` : ''}
                  <span class="small soft">${whenLabel(m.starts_at)}</span></div>
                ${v ? html`<a class="btn primary" href="${mapsLink(v)}" target="_blank" rel="noopener">${icon('nav', 18)} Directions</a>` : ''}
                ${nextHere.length ? html`<div class="small muted mt-s">Next on this court</div>${nextHere.map((x) => matchRow(x))}` : ''}
              </div>` : ''}
            </div>
          </div>
        </div>`;
    },
    actions: {
      tab(el) { matchTabs.set(id, el.dataset.tab); ui.refresh(); },
      async share() {
        const m = store.match(id);
        const text = `${kicker(m)}: ${store.teamShort(m.team_a_id, m.team_a_label)} vs ${store.teamShort(m.team_b_id, m.team_b_label)}`;
        const url = location.href;
        try {
          if (navigator.share) await navigator.share({ title: 'Shaurya Live', text, url });
          else { await navigator.clipboard.writeText(url); toast('Link copied'); }
        } catch (e) { /* cancelled */ }
      },
    },
  };
}

function timeline(m, events) {
  if (events === null) return html`<div class="loading"><div class="spinner"></div>Loading timeline…</div>`;
  if (!events.length) return emptyState(m.status === 'scheduled' ? 'The timeline starts when the match goes live.' : 'No updates logged for this match.');
  return html`<div>${events.map((e) => html`<div class="timeline-row ${e.team === 'b' ? 'b' : ''}"><span class="tm num">${timeOf(e.created_at)}</span><span class="tx">${e.text}</span></div>`)}</div>`;
}

function lineups(m, players) {
  if (players === null) return html`<div class="loading"><div class="spinner"></div>Loading squads…</div>`;
  const side = (id, label) => {
    const list = players[id] || [];
    return html`<div class="stack tight"><span class="tiny muted" style="font-weight:700;letter-spacing:.06em">${store.teamShort(id, label)} · SQUAD</span>
      ${list.length ? list.map((p) => html`<div class="player-row" style="grid-template-columns:32px minmax(0,1fr)"><span class="no">${p.jersey || ''}</span><span>${p.name}${p.role ? html` <span class="muted small">· ${p.role}</span>` : ''}</span></div>`) : html`<span class="small muted">Squad not added yet</span>`}</div>`;
  };
  return html`<div class="grid two" style="grid-template-columns:repeat(2,minmax(0,1fr))">${side(m.team_a_id, m.team_a_label)}${side(m.team_b_id, m.team_b_label)}</div>`;
}

// =====================================================================
// STANDINGS + WHAT-IF
// =====================================================================
const wiState = new Map(); // groupKey -> { picks, track, qualify }

function tableSports() {
  return store.sports.filter((s) => store.matches.some((m) => m.sport_id === s.id) || store.teams.some((t) => t.sport_id === s.id));
}

export function standings({ query }) {
  return {
    live: true,
    render() {
      const sports = tableSports();
      if (!sports.length) return html`${pageHead('Standings', '', '')}${emptyState('Standings appear once organisers add fixtures.')}`;
      const tab = query.tab || 'groups';
      let sportId = query.sport;
      if (!sportId || !store.sport(sportId)) {
        const followed = [...store.follows].map((id) => store.team(id)).find((t) => t && t.group_name);
        sportId = followed?.sport_id || (sports.find((s) => store.matches.some((m) => m.sport_id === s.id && isTableMatch(m))) || sports[0]).id;
      }
      const sport = store.sport(sportId);
      const cats = sport.categories?.length ? sport.categories : ['Men'];
      const usedCats = cats.filter((c) => store.matches.some((m) => m.sport_id === sportId && m.category === c) || store.teams.some((t) => t.sport_id === sportId && t.category === c));
      const catList = usedCats.length ? usedCats : cats;
      const cat = catList.includes(query.cat) ? query.cat : catList[0];
      const link = (o) => '#/standings' + qs({ sport: sportId, cat, tab, ...o });

      const header = html`
        ${pageHead('Standings', 'Groups, knockouts and the medal tally', '')}
        <div class="tabs" role="tablist" style="margin-bottom:10px">
          ${[['groups', 'Groups'], ['knockouts', 'Knockouts'], ['medals', 'Medal tally']].map(([k, l]) => html`<button type="button" role="tab" data-act="go" data-href="${'#/standings' + qs({ sport: sportId, cat, tab: k })}" aria-selected="${tab === k}">${l}</button>`)}
        </div>
        ${tab !== 'medals' ? html`<div class="form-grid" style="margin-bottom:6px">
          <div class="field"><label for="st-sport">Sport</label><select id="st-sport" class="input" data-change="sport">${sports.map((s) => html`<option value="${s.id}" ${s.id === sportId ? raw('selected') : ''}>${s.name}</option>`)}</select></div>
          <div class="field"><span class="lbl">Category</span><div class="row wrap">${catList.map((c) => html`<a class="chip small ${c === cat ? 'on' : ''}" href="${link({ cat: c, group: '' })}" aria-current="${c === cat ? 'true' : 'false'}">${c}</a>`)}</div></div>
        </div>` : ''}`;

      if (tab === 'medals') return html`${header}${medalsView()}`;
      if (tab === 'knockouts' || sport.scoring === 'ranking') return html`${header}${knockoutsView(sportId, cat, sport)}`;
      return html`${header}${groupsView(sportId, cat, sport, query, link)}`;
    },
    actions: {
      go(el) { ui.go(el.dataset.href); },
      pick(el) {
        const st = wiState.get(el.dataset.key);
        const cur = st.picks[el.dataset.fx];
        if (cur && cur.w === el.dataset.w) delete st.picks[el.dataset.fx];
        else st.picks[el.dataset.fx] = { w: el.dataset.w, m: cur?.m ?? Number(el.dataset.dm) };
        ui.refresh();
      },
      margin(el) {
        const st = wiState.get(el.dataset.key);
        const p = st.picks[el.dataset.fx];
        if (p) p.m = Number(el.dataset.m);
        ui.refresh();
      },
      track(el) { wiState.get(el.dataset.key).track = el.dataset.team; ui.refresh(); },
      qualify(el) { wiState.get(el.dataset.key).qualify = Number(el.dataset.q); ui.refresh(); },
      reset(el) { wiState.get(el.dataset.key).picks = {}; ui.refresh(); },
    },
    change: {
      sport(el) { ui.go('#/standings' + qs({ sport: el.value, tab: query.tab })); },
    },
  };
}

function groupsView(sportId, cat, sport, query, link) {
  const groupNames = new Set();
  store.teams.forEach((t) => t.sport_id === sportId && t.category === cat && t.group_name && groupNames.add(t.group_name));
  store.matches.forEach((m) => m.sport_id === sportId && m.category === cat && isTableMatch(m) && m.group_name && groupNames.add(m.group_name));
  const groups = [...groupNames].sort();
  if (!groups.length) return emptyState('No group stage for this event — see the Knockouts tab.');
  const group = groups.includes(query.group) ? query.group : groups[0];
  const key = `${sportId}|${cat}|${group}`;
  const gm = store.matches.filter((m) => m.sport_id === sportId && m.category === cat && isTableMatch(m) && (m.group_name || '') === group);
  const teamIds = groupTeams(store.teams, store.matches, sportId, cat, group);
  if (!wiState.has(key)) {
    const followed = teamIds.find((id) => store.follows.has(id));
    wiState.set(key, { picks: {}, track: query.track && teamIds.includes(query.track) ? query.track : followed || teamIds[0], qualify: sport.qualify_per_group ?? 2 });
  }
  const st = wiState.get(key);
  if (query.track && teamIds.includes(query.track) && !st._trackApplied) { st.track = query.track; st._trackApplied = true; }
  const played = playedResults(gm);
  const remaining = gm.filter((m) => m.status !== 'completed' && m.team_a_id && m.team_b_id);
  Object.keys(st.picks).forEach((fx) => { if (!remaining.find((m) => m.id === fx)) delete st.picks[fx]; });
  const nameOf = (id) => store.teamShort(id);
  const wi = whatIf({ teamIds, played, remaining, sport, picks: st.picks, qualify: st.qualify, nameOf });
  const finished = remaining.length === 0;
  const pickedCount = Object.keys(st.picks).length;
  const roundName = nextRoundName(store.matches, sportId, cat);
  const draws = allowsDraw(sport);
  const showD = draws;

  const table = html`<section class="card" aria-label="Group ${group} table">
    <div class="row between" style="padding-bottom:6px"><h2 class="display" style="font-size:20px">Group ${group}</h2>
      <span class="small muted">${pickedCount ? `Projected with your ${pickedCount} pick${pickedCount === 1 ? '' : 's'}` : `${played.length} of ${played.length + remaining.length} played`}</span></div>
    <div class="table-wrap"><table class="std">
      <thead><tr><th class="l">#</th><th class="l">Team</th><th>P</th><th>W</th>${showD ? html`<th>D</th>` : ''}<th>L</th><th title="${tiebreakName(sport)}">+/−</th><th>Pts</th><th>Status</th></tr></thead>
      <tbody>${wi.projected.map((r, i) => {
        const q = qualStatus(wi.counts ? wi.counts[r.id] : null, wi.n, finished && !pickedCount);
        return html`<tr class="${r.id === st.track ? 'me' : ''} ${i === st.qualify - 1 && wi.projected.length > st.qualify ? 'cut' : ''}">
          <td class="l muted">${i + 1}</td>
          <td class="l"><a class="tm" href="#/team/${r.id}" style="color:${r.id === st.track ? 'var(--accent-hover)' : 'var(--text)'}"><b>${store.teamShort(r.id)}</b><small>${store.teamName(r.id)}</small></a></td>
          <td>${r.p}</td><td>${r.w}</td>${showD ? html`<td>${r.d}</td>` : ''}<td>${r.l}</td><td class="num">${r.diff > 0 ? '+' : ''}${fmtNum(r.diff)}</td>
          <td class="pts">${fmtNum(r.pts)}</td><td><span class="pill ${q.key}">${q.label}</span></td></tr>`;
      })}</tbody></table></div>
    <div class="tiny muted" style="padding-top:8px">Win ${fmtNum(sport.win_points)} pts${draws ? ` · draw ${fmtNum(sport.draw_points)}` : ''} · ties broken by ${tiebreakName(sport)}, then ${sport.scoring === 'goals' ? 'goals' : 'points'} scored. Dashed line = qualification cut-off.</div>
  </section>`;

  const groupChips = groups.length > 1 ? html`<div class="chips" style="margin-bottom:8px">${groups.map((g) => html`<a class="chip small ${g === group ? 'on' : ''}" href="${link({ group: g })}">Group ${g}</a>`)}</div>` : '';

  // ---- calculator ----
  let calc;
  if (!teamIds.length) calc = '';
  else if (finished) {
    calc = html`<div class="card dashed small muted">All group games are done — the table above is final.</div>`;
  } else {
    const track = st.track;
    const sum = trackSummary(wi, track, store.teamShort(track), roundName);
    const tieNote = wi.tooMany ? '' : wi.tieAtCut
      ? `Some outcomes finish level on points at the cut-off, so ${tiebreakName(sport)} decides — try changing the winning margins.`
      : 'Points alone settle the qualifiers in every outcome left.';
    const dm = defaultMargin(sport);
    calc = html`<section aria-label="What-if calculator" class="stack">
      <div class="stack tight"><h2 class="display" style="font-size:24px">What-if calculator</h2>
        <span class="small muted">Pick results for the games left. The table and every team’s chances update instantly.</span></div>
      <div class="row wrap"><span class="small muted" style="font-weight:600">Track</span>
        ${teamIds.map((id) => html`<button type="button" class="chip small light" data-act="track" data-key="${key}" data-team="${id}" aria-pressed="${id === track}">${store.teamShort(id)}</button>`)}</div>
      <div class="row wrap"><span class="small muted" style="font-weight:600">Top</span>
        ${[1, 2, 3, 4].filter((n) => n < teamIds.length).map((n) => html`<button type="button" class="chip small light" data-act="qualify" data-key="${key}" data-q="${n}" aria-pressed="${n === st.qualify}">${n}</button>`)}
        <span class="small muted">go through</span></div>
      <div class="card accent verdict" aria-live="polite">
        <span class="kick">Tracking ${store.teamName(track)}</span>
        <span class="head">${sum.headline}</span>
        <span class="sub">${sum.sub}</span>
        ${tieNote ? html`<span class="note">${tieNote}</span>` : ''}
      </div>
      ${remaining.map((f) => {
        const p = st.picks[f.id];
        const sl = f.status === 'live' ? `LIVE ${fmtNum(f.score_a)}–${fmtNum(f.score_b)}${f.status_text ? ' · ' + f.status_text : ''}` : '';
        const btn = (w, label) => html`<button type="button" class="pick" data-act="pick" data-key="${key}" data-fx="${f.id}" data-w="${w}" data-dm="${dm}" aria-pressed="${p?.w === w}">${label}</button>`;
        return html`<div class="card fixture">
          <div class="row between small muted"><span>${whenLabel(f.starts_at)} · ${store.court(f.court_id)?.name || store.venue(f.venue_id)?.name || ''}</span>${sl ? html`<span class="live-tag"><span class="dot"></span>${sl}</span>` : ''}</div>
          <div class="pick-row ${draws ? 'three' : ''}">${btn('a', `${store.teamShort(f.team_a_id)} wins`)}${draws ? btn('draw', 'Draw') : ''}${btn('b', `${store.teamShort(f.team_b_id)} wins`)}</div>
          ${p && p.w !== 'draw' ? html`<div class="margins"><span class="small muted">Margin</span>
            ${marginOptions(sport).map((mg) => html`<button type="button" class="margin" data-act="margin" data-key="${key}" data-fx="${f.id}" data-m="${mg}" aria-pressed="${Number(p.m) === mg}">${marginLabel(sport, mg)}</button>`)}</div>` : ''}
        </div>`;
      })}
      <div class="row between"><span class="small muted">Unpicked games are played out every possible way${sport.scoring !== 'sets' ? `, with a ${marginLabel(sport, dm).replace('by ', '')}-${sport.scoring === 'cricket' ? 'run' : 'point'} margin` : ''}.</span>
        <button type="button" class="btn small ghost" data-act="reset" data-key="${key}">Reset</button></div>
      ${sport.scoring === 'cricket' ? html`<div class="tiny muted">Cricket tie-breaks use run difference here; the official table may use net run rate.</div>` : ''}
    </section>`;
  }

  return html`${groupChips}<div class="cols">${table}${calc}</div>`;
}

const STAGE_ORDER = { round: 1, quarterfinal: 2, semifinal: 3, third_place: 4, final: 5, event: 6 };
function knockoutsView(sportId, cat, sport) {
  const ko = store.matches
    .filter((m) => m.sport_id === sportId && m.category === cat && !isTableMatch(m))
    .sort((a, b) => (STAGE_ORDER[a.stage] || 9) - (STAGE_ORDER[b.stage] || 9) || String(a.starts_at).localeCompare(String(b.starts_at)));
  if (!ko.length) return emptyState(sport.scoring === 'ranking' ? 'No events scheduled yet.' : 'Knockout fixtures will appear here once they are scheduled.');
  const groups = [];
  ko.forEach((m) => {
    const label = sport.scoring === 'ranking' ? 'Events' : { round: 'Rounds', quarterfinal: 'Quarter-finals', semifinal: 'Semi-finals', third_place: '3rd place', final: 'Final', event: 'Events' }[m.stage] || m.stage;
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, list: [] }));
    g.list.push(m);
  });
  return html`${groups.map((g) => html`<div class="section-title"><h2>${g.label}</h2></div><div class="grid two">${g.list.map((m) => matchCard(m))}</div>`)}`;
}

function medalsView() {
  const tally = medalTally(store.matches, store.teamsById, store.sportsById);
  if (!tally.length) return emptyState('Medals are awarded from finals, 3rd-place matches and ranking events as results come in.');
  return html`<section class="card"><div class="table-wrap"><table class="std">
    <thead><tr><th class="l">#</th><th class="l">College</th><th><span class="medal g">G</span></th><th><span class="medal s">S</span></th><th><span class="medal b">B</span></th><th>Total</th></tr></thead>
    <tbody>${tally.map((r, i) => {
      const c = store.college(r.college_id);
      return html`<tr><td class="l muted">${i + 1}</td><td class="l"><span class="tm"><b>${c?.short_name || '?'}</b><small>${c?.name || ''}</small></span></td>
        <td class="pts">${r.gold}</td><td class="pts">${r.silver}</td><td class="pts">${r.bronze}</td><td class="num">${r.gold + r.silver + r.bronze}</td></tr>`;
    })}</tbody></table></div>
    <div class="tiny muted" style="padding-top:8px">From completed finals (gold & silver), 3rd-place matches (bronze) and ranking-event finals.</div></section>`;
}

// =====================================================================
// VENUES
// =====================================================================
const venueState = { q: '', filter: 'all' };
export function venues() {
  return {
    live: true,
    render() {
      const q = venueState.q.trim().toLowerCase();
      const list = store.venues.filter((v) => {
        if (venueState.filter === 'indoor' && !v.indoor) return false;
        if (venueState.filter === 'outdoor' && v.indoor) return false;
        const vm = store.matches.filter((m) => m.venue_id === v.id);
        if (venueState.filter === 'live' && !vm.some((m) => m.status === 'live')) return false;
        if (!q) return true;
        const hay = [v.name, v.description, ...store.courts.filter((c) => c.venue_id === v.id).map((c) => c.name), ...vm.map((m) => store.sport(m.sport_id)?.name)].join(' ').toLowerCase();
        return hay.includes(q);
      });
      return html`
        ${pageHead('Venues & courts', `${store.venues.length} venue${store.venues.length === 1 ? '' : 's'} on campus`, '')}
        <div class="field" style="margin:6px 0 8px"><label class="sr-only" for="vsearch">Search venues</label>
          <input id="vsearch" class="input" type="search" placeholder="Search a venue, court or sport" value="${venueState.q}" data-input="q"></div>
        <div class="chips">${[['all', 'All'], ['live', 'Live now'], ['indoor', 'Indoor'], ['outdoor', 'Outdoor']].map(([k, l]) => html`<button type="button" class="chip small" data-act="filter" data-f="${k}" aria-pressed="${venueState.filter === k}">${l}</button>`)}</div>
        ${list.length ? html`<div class="grid two mt-s">${list.map((v, i) => venueCard(v, i))}</div>` : emptyState(store.venues.length ? 'No venue matches that search.' : 'Organisers haven’t added venues yet.')}`;
    },
    actions: { filter(el) { venueState.filter = el.dataset.f; ui.refresh(); } },
    input: { q(el) { venueState.q = el.value; ui.refresh({ keepFocus: true }); } },
  };
}

function venueCard(v, i) {
  const courts = store.courts.filter((c) => c.venue_id === v.id);
  const vm = store.matches.filter((m) => m.venue_id === v.id);
  const anyLive = vm.some((m) => m.status === 'live');
  const sportsHere = [...new Set(vm.map((m) => store.sport(m.sport_id)?.name).filter(Boolean))];
  const rows = [];
  const courtList = courts.length ? courts : [{ id: null, name: '—' }];
  courtList.forEach((c) => {
    const cm = vm.filter((m) => (c.id ? m.court_id === c.id : true));
    const live = cm.filter((m) => m.status === 'live');
    const next = cm.filter((m) => m.status === 'scheduled' && m.starts_at && new Date(m.starts_at) > new Date(Date.now() - 3 * 3600e3));
    live.forEach((m) => rows.push({ c, m, tag: 'LIVE', color: 'var(--live-text)' }));
    if (next[0]) rows.push({ c, m: next[0], tag: 'NEXT', color: 'var(--muted)' });
  });
  return html`<div class="card stack">
    <div class="row" style="align-items:flex-start;gap:12px">
      <span class="pin ${anyLive ? '' : 'idle'}">${i + 1}</span>
      <span class="grow stack tight"><b style="font-size:16px">${v.name}</b><span class="small muted">${v.description || sportsHere.join(' · ') || (v.indoor ? 'Indoor' : 'Outdoor')}</span></span>
      <a class="icon-btn" href="${mapsLink(v)}" target="_blank" rel="noopener" aria-label="Directions to ${v.name}" style="border-radius:12px">${icon('nav', 18)}</a>
    </div>
    ${rows.length ? html`<div>${rows.map((r) => html`<a class="court-row" href="#/match/${r.m.id}"><span class="soft" style="font-weight:600">${r.c.name}</span><span class="tag" style="color:${r.color}">${r.tag}</span>
      <span class="ellipsis">${r.tag === 'NEXT' ? timeOf(r.m.starts_at) + ' · ' : ''}${store.sport(r.m.sport_id)?.name} ${r.m.category[0]} · ${store.sport(r.m.sport_id)?.scoring === 'ranking' ? r.m.title || '' : `${store.teamShort(r.m.team_a_id, r.m.team_a_label)} ${r.tag === 'LIVE' ? `${fmtNum(r.m.score_a)}–${fmtNum(r.m.score_b)}` : 'vs'} ${store.teamShort(r.m.team_b_id, r.m.team_b_label)}`}</span></a>`)}</div>`
      : html`<div class="small muted">Nothing scheduled here right now.</div>`}
  </div>`;
}

// =====================================================================
// TEAMS
// =====================================================================
const teamsState = { q: '', sport: '' };
export function teams() {
  return {
    live: false,
    render() {
      const q = teamsState.q.trim().toLowerCase();
      const cols = store.colleges.filter((c) => {
        const ts = store.teams.filter((t) => t.college_id === c.id && (!teamsState.sport || t.sport_id === teamsState.sport));
        if (!ts.length) return false;
        return !q || (c.name + ' ' + c.short_name + ' ' + (c.city || '')).toLowerCase().includes(q);
      });
      return html`
        ${pageHead('Teams', `${store.colleges.length} colleges · ${store.teams.length} teams`, '')}
        <div class="form-grid collapse" style="margin:6px 0 10px">
          <div class="field"><label for="tsearch">College</label><input id="tsearch" class="input" type="search" placeholder="Search colleges" value="${teamsState.q}" data-input="q"></div>
          <div class="field"><label for="tsport">Sport</label><select id="tsport" class="input" data-change="sport"><option value="">All sports</option>${store.sports.map((s) => html`<option value="${s.id}" ${s.id === teamsState.sport ? raw('selected') : ''}>${s.name}</option>`)}</select></div>
        </div>
        ${cols.length ? html`<div class="grid two">${cols.map((c) => {
          const ts = store.teams.filter((t) => t.college_id === c.id && (!teamsState.sport || t.sport_id === teamsState.sport))
            .sort((a, b) => (store.sport(a.sport_id)?.sort_order || 0) - (store.sport(b.sport_id)?.sort_order || 0));
          return html`<div class="card stack">
            <div class="row" style="gap:12px">${teamBadge(ts[0].id, c.short_name, 'sm')}<span class="grow"><b>${c.name}</b><div class="small muted">${c.city || ''}</div></span></div>
            <div class="row wrap">${ts.map((t) => html`<a class="chip small" href="#/team/${t.id}">${store.follows.has(t.id) ? '★ ' : ''}${store.sport(t.sport_id)?.name} ${t.category === 'Mixed' ? '' : t.category[0]}</a>`)}</div>
          </div>`;
        })}</div>` : emptyState(store.teams.length ? 'No college matches that search.' : 'Teams appear once organisers import registrations.')}`;
    },
    input: { q(el) { teamsState.q = el.value; ui.refresh({ keepFocus: true }); } },
    change: { sport(el) { teamsState.sport = el.value; ui.refresh(); } },
  };
}

export function team({ params }) {
  const id = params[0];
  let squad = null;
  return {
    live: true,
    mount() {
      store.players([id]).then((p) => { squad = p[id]; ui.refresh(); }).catch(() => { squad = []; ui.refresh(); });
    },
    render() {
      const t = store.team(id);
      if (!t) return html`${pageHead('Team', '', '#/teams')}${emptyState('Team not found.')}`;
      const c = store.college(t.college_id);
      const s = store.sport(t.sport_id);
      const tm = store.matches.filter((m) => m.team_a_id === id || m.team_b_id === id || (m.detail?.results || []).some((r) => r.team_id === id));
      let w = 0, l = 0, d = 0;
      tm.filter((m) => m.status === 'completed' && m.team_a_id && m.team_b_id).forEach((m) => {
        const side = m.team_a_id === id ? 'a' : 'b';
        const win = m.winner || (Number(m.score_a) === Number(m.score_b) ? 'draw' : Number(m.score_a) > Number(m.score_b) ? 'a' : 'b');
        if (win === 'draw') d++; else if (win === side) w++; else l++;
      });
      let pos = '—';
      if (t.group_name) {
        const ids = groupTeams(store.teams, store.matches, t.sport_id, t.category, t.group_name);
        const gm = store.matches.filter((m) => m.sport_id === t.sport_id && m.category === t.category && isTableMatch(m) && (m.group_name || '') === t.group_name);
        const tbl = computeTable(ids, playedResults(gm), s, (x) => store.teamShort(x));
        const i = tbl.findIndex((r) => r.id === id);
        if (i >= 0) pos = ['1st', '2nd', '3rd'][i] || `${i + 1}th`;
      }
      const others = store.teams.filter((x) => x.college_id === t.college_id && x.id !== id);
      const following = store.follows.has(id);
      return html`
        ${pageHead('', '', '#/teams')}
        <div class="row" style="gap:14px;margin-top:-6px">${teamBadge(id, c?.short_name)}
          <div class="grow"><h1 class="display" style="font-size:28px;line-height:1">${c?.name || 'Team'}</h1>
          <div class="small muted">${s?.name} · ${t.category}${t.group_name ? ' · Group ' + t.group_name : ''}</div></div></div>
        <button type="button" class="btn block mt" data-act="follow" aria-pressed="${following}" style="${following ? 'border-color:var(--accent);color:var(--accent-hover)' : ''}">
          ${icon(following ? 'check' : 'star', 18)} ${following ? 'Following — shown under “My teams”' : 'Follow this team'}</button>
        <div class="kv mt">
          <div class="card"><span class="k">Record</span><span class="v">${w}–${l}${d ? '–' + d : ''}</span></div>
          <div class="card"><span class="k">Group</span><span class="v">${pos}</span></div>
          ${t.group_name ? html`<a class="card accent" style="color:var(--text)" href="${'#/standings' + qs({ sport: t.sport_id, cat: t.category, group: t.group_name, track: id })}"><span class="k" style="color:#ffb08a">Qualify?</span><span class="v" style="font-size:20px">What-if →</span></a>` : html`<div class="card"><span class="k">Matches</span><span class="v">${tm.length}</span></div>`}
        </div>
        <div class="cols">
          <div><div class="section-title"><h2>Fixtures</h2></div>
            ${tm.length ? tm.map((m) => matchRow(m)) : emptyState('No fixtures yet.')}</div>
          <div><div class="section-title"><h2>Squad</h2><span class="small muted">${squad ? squad.length + ' players' : ''}</span></div>
            ${squad === null ? html`<div class="loading"><div class="spinner"></div></div>` : squad.length ? squad.map((p) => html`<div class="player-row"><span class="no">${p.jersey || ''}</span><span style="font-weight:600">${p.name}</span><span class="small muted">${p.role || ''}</span></div>`) : emptyState('Squad not added yet.')}
            ${store.canManageTeam(t) ? html`<a class="btn small blue mt-s" href="#/org/team/${id}">${icon('edit', 16)} Edit squad</a>` : ''}
          </div>
        </div>
        ${others.length ? html`<div class="section-title"><h2 style="font-size:16px">${c?.short_name} also plays</h2></div>
          <div class="row wrap">${others.map((x) => html`<a class="chip small" href="#/team/${x.id}">${store.sport(x.sport_id)?.name} ${x.category === 'Mixed' ? '' : x.category[0]}</a>`)}</div>` : ''}`;
    },
    actions: {
      async follow() {
        if (!store.user) { toast('Sign in to follow teams'); ui.go('#/login'); return; }
        try { const on = await store.toggleFollow(id); toast(on ? 'Following — find it under “My teams”' : 'Unfollowed'); } catch (e) { toast(e.message, 'error'); }
      },
    },
  };
}

// =====================================================================
// LOGIN / ACCOUNT
// =====================================================================
const loginState = { step: 'start', email: '', busy: false, msg: '' };
export function login() {
  return {
    live: false,
    render() {
      if (store.user) { setTimeout(() => ui.go(store.isStaff ? '#/org' : '#/me'), 0); return html`<div class="loading"><div class="spinner"></div>Signed in</div>`; }
      const demo = store.mode === 'demo';
      return html`<div style="max-width:440px;margin:0 auto">
        <div class="hero-login">
          <span class="tag-pill">IIMA SPORTSCOMM · 20–22 NOV</span>
          <h1>SHAURYA<br><span>’26 LIVE</span></h1>
          <p class="soft" style="margin:0;font-size:16px">Sign in to follow your college and see your teams first. Scores are public — you don’t need an account to watch.</p>
        </div>
        ${demo ? html`<div class="stack mt">
            <div class="banner info">${icon('info', 18)}<div>Demo mode: Supabase isn’t connected yet, so pick a demo account to try each role.</div></div>
            <button class="btn primary" type="button" data-act="demo" data-kind="fan">Continue as demo fan</button>
            <button class="btn blue" type="button" data-act="demo" data-kind="scorer">Demo scorer (basketball & volleyball)</button>
            <button class="btn" type="button" data-act="demo" data-kind="admin">Demo admin (SportsComm)</button>
          </div>`
        : html`<div class="stack mt">
          <button class="btn light" type="button" data-act="google" ${loginState.busy ? raw('disabled') : ''}>${icon('google', 20)} Continue with Google</button>
          <div class="divider">or get a sign-in code by email</div>
          ${loginState.step === 'start' ? html`<form class="stack" data-form="send">
              <div class="field"><label for="login-email">Email</label><input id="login-email" class="input" type="email" name="email" required autocomplete="email" placeholder="you@college.edu" value="${loginState.email}"></div>
              <button class="btn primary" type="submit" ${loginState.busy ? raw('disabled') : ''}>Send code</button></form>`
            : html`<form class="stack" data-form="verify">
              <div class="small soft">We sent a code to <b>${loginState.email}</b>. It can take a minute — check spam too.</div>
              <div class="field"><label for="login-code">Code from the email</label><input id="login-code" class="input num" name="code" inputmode="numeric" autocomplete="one-time-code" required pattern="[0-9]{6,10}" placeholder="6-digit code" style="font-size:22px;letter-spacing:.2em"></div>
              <button class="btn primary" type="submit" ${loginState.busy ? raw('disabled') : ''}>Verify and sign in</button>
              <button class="linkish" type="button" data-act="restart">Use a different email</button></form>`}
          ${loginState.msg ? html`<div class="small" role="alert" style="color:#ffb3ba">${loginState.msg}</div>` : ''}
        </div>`}
        <a class="btn ghost block mt" href="#/">Just browsing — continue as guest</a>
        <div class="card row mt" style="align-items:flex-start;gap:14px">
          <span class="pin" style="background:var(--surface-2);color:var(--accent);border-radius:10px;width:40px;height:40px">${icon('shield', 20)}</span>
          <span class="stack tight"><b>Organiser or scorer?</b><span class="small muted">Sign in with the email SportsComm added for you. Scoring and fixture tools unlock for your assigned sports.</span></span>
        </div>
        <p class="footer-note">Sign-in is handled by Supabase Auth. We only store your name and email.</p>
      </div>`;
    },
    actions: {
      async demo(el) { await store.signInDemo(el.dataset.kind); toast('Signed in as demo ' + el.dataset.kind); },
      async google() {
        loginState.busy = true; loginState.msg = ''; ui.refresh();
        try { await store.signInGoogle(); } catch (e) { loginState.msg = e.message || String(e); }
        loginState.busy = false; ui.refresh();
      },
      restart() { loginState.step = 'start'; loginState.msg = ''; ui.refresh(); },
    },
    forms: {
      async send(fd) {
        loginState.email = String(fd.get('email') || '').trim();
        loginState.busy = true; loginState.msg = ''; ui.refresh();
        try { await store.sendEmailCode(loginState.email); loginState.step = 'code'; } catch (e) { loginState.msg = friendlyAuthError(e); }
        loginState.busy = false; ui.refresh();
      },
      async verify(fd) {
        loginState.busy = true; loginState.msg = ''; ui.refresh();
        try {
          await store.verifyEmailCode(loginState.email, String(fd.get('code') || '').trim());
          loginState.step = 'start';
        } catch (e) { loginState.msg = friendlyAuthError(e); }
        loginState.busy = false; ui.refresh();
      },
    },
  };
}

function friendlyAuthError(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/rate limit/i.test(m)) return 'Too many emails sent just now. Wait a few minutes, or use Google sign-in.';
  if (/expired|invalid/i.test(m)) return 'That code is wrong or has expired. Request a new one.';
  return m;
}

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

export function me() {
  return {
    live: false,
    render() {
      if (!store.user) return html`${pageHead('Account', '', '')}<div class="stack"><p class="soft">You’re browsing as a guest. Sign in to follow teams.</p><a class="btn primary" href="#/login">Sign in</a></div>${installCard()}`;
      const p = store.profile || {};
      const roleLabel = { admin: 'Admin · SportsComm', scorer: 'Scorer', fan: 'Fan' }[store.role] || store.role;
      const followed = [...store.follows].map((id) => store.team(id)).filter(Boolean);
      return html`
        ${pageHead('Account', '', '')}
        <div class="card stack">
          <div class="row" style="gap:12px"><span class="badge sm" style="background:var(--surface-3)">${(p.full_name || store.user.email || '?').slice(0, 1).toUpperCase()}</span>
            <span class="grow"><b>${p.full_name || 'No name set'}</b><div class="small muted">${store.user.email || ''}</div></span>
            <span class="pill ${store.isStaff ? 'org' : 'final'}">${roleLabel}</span></div>
          ${store.role === 'scorer' ? html`<div class="small soft">Scoring: ${store.scorerSports.map((id) => store.sport(id)?.name).join(', ') || 'matches assigned to you'}</div>` : ''}
          <form class="inline-form" data-form="name"><div class="field"><label for="me-name">Display name</label><input id="me-name" class="input" name="name" value="${p.full_name || ''}" maxlength="60"></div><button class="btn small" type="submit">Save</button></form>
        </div>
        ${store.isStaff ? html`<a class="btn blue block mt" href="#/org">${icon('shield', 18)} Open organiser tools</a>` : ''}
        <div class="section-title"><h2>Following</h2><span class="small muted">${followed.length}</span></div>
        ${followed.length ? followed.map((t) => html`<a class="list-row" href="#/team/${t.id}">${teamBadge(t.id, '', 'sm')}<span class="grow"><b>${store.college(t.college_id)?.name}</b><div class="small muted">${store.sport(t.sport_id)?.name} · ${t.category}</div></span>${icon('chev', 18)}</a>`) : emptyState('Follow teams from their team page to see them under “My teams”.')}
        ${installCard()}
        <button class="btn danger block mt" type="button" data-act="signout">${icon('logout', 18)} Sign out</button>`;
    },
    actions: {
      async signout() { await store.signOut(); toast('Signed out'); ui.go('#/'); },
      async install() {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        ui.refresh();
      },
    },
    forms: {
      async name(fd) {
        try { await store.updateMyName(String(fd.get('name') || '').trim()); toast('Name saved'); } catch (e) { toast(e.message, 'error'); }
      },
    },
  };
}

function installCard() {
  if (isNative()) return '';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return html`<div class="card stack mt">
    <b>Get the app</b>
    ${installPrompt ? html`<button class="btn primary" type="button" data-act="install">${icon('download', 18)} Install Shaurya Live</button>` : ''}
    <div class="small soft">${ios ? raw('<b>iPhone / iPad:</b> tap Share, then <b>Add to Home Screen</b>.') : raw('<b>Windows / Chrome:</b> use the install icon in the address bar. <b>iPhone:</b> Share → Add to Home Screen.')}</div>
    ${CFG.APK_URL ? html`<a class="btn small" href="${CFG.APK_URL}" target="_blank" rel="noopener">${icon('download', 16)} Android app (APK)</a>` : ''}
  </div>`;
}
