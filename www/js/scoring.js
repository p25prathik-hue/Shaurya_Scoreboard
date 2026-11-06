// Pure scoring / standings logic. No DOM, no network.
import { fmtNum } from './util.js';

const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
const other = (side) => (side === 'a' ? 'b' : 'a');

// ------------------------------------------------------------------
// Labels
// ------------------------------------------------------------------
export function stageLabel(m) {
  switch (m.stage) {
    case 'group': return m.group_name ? `Group ${m.group_name}` : 'Group stage';
    case 'league': return m.group_name ? `League ${m.group_name}` : 'League';
    case 'round': return m.match_no ? `Round ${m.match_no}` : 'Round';
    case 'quarterfinal': return m.match_no ? `QF ${m.match_no}` : 'Quarter-final';
    case 'semifinal': return m.match_no ? `SF ${m.match_no}` : 'Semi-final';
    case 'final': return 'Final';
    case 'third_place': return '3rd place';
    case 'event': return m.title || 'Event';
    default: return m.stage || '';
  }
}

export const STAGES = [
  ['group', 'Group'], ['league', 'League'], ['round', 'Round / heat'], ['quarterfinal', 'Quarter-final'],
  ['semifinal', 'Semi-final'], ['third_place', '3rd place'], ['final', 'Final'], ['event', 'Event (ranking)'],
];

export function periodName(sport, n) {
  const label = sport?.period_label || 'Period';
  const max = sport?.periods || 1;
  if (n > max && sport?.scoring !== 'sets') {
    return label === 'Quarter' || label === 'Half' ? `OT ${n - max}` : `${label} ${n}`;
  }
  switch (label) {
    case 'Quarter': return `Q${n}`;
    case 'Half': return n === 1 ? '1st half' : n === 2 ? '2nd half' : `Half ${n}`;
    case 'Game':
    case 'Round':
    case 'Event': return max > 1 ? `${label} ${n}` : label;
    default: return `${label} ${n}`;
  }
}

export function periodShort(sport, n) {
  const label = sport?.period_label || 'P';
  const max = sport?.periods || 1;
  if (n > max && sport?.scoring !== 'sets') return 'OT' + (n - max > 1 ? n - max : '');
  if (label === 'Quarter') return 'Q' + n;
  if (label === 'Half') return 'H' + n;
  return label[0] + n;
}

export function tiebreakName(sport) {
  switch (sport?.scoring) {
    case 'goals': return 'goal difference';
    case 'sets': return `${(sport.period_label || 'set').toLowerCase()} difference`;
    case 'cricket': return 'run difference';
    default: return 'score difference';
  }
}

export function allowsDraw(sport) {
  if (!sport) return false;
  if (sport.scoring === 'goals') return true;
  return (sport.increments || []).some((x) => Number(x) % 1 !== 0); // e.g. chess half points
}

// ------------------------------------------------------------------
// Score states. Each "apply" returns a patch for record_score:
// { status, score_a, score_b, detail, status_text, winner?, result_note? }
// ------------------------------------------------------------------
export function initialDetail(sport, opts = {}) {
  switch (sport.scoring) {
    case 'points':
    case 'goals': return { period: 1, periods: [[0, 0]] };
    case 'sets': return { current: 0, sets: [[0, 0]] };
    case 'cricket': return { overs: opts.overs || defaultOvers(sport), current: 0, innings: [] };
    case 'ranking': return { results: [] };
    default: return {};
  }
}

export function defaultOvers(sport) {
  return sport.id === 'boxcricket' ? 6 : 15;
}

function sumPeriods(periods) {
  let a = 0, b = 0;
  (periods || []).forEach(([x, y]) => { a += Number(x) || 0; b += Number(y) || 0; });
  return [round1(a), round1(b)];
}
const round1 = (x) => Math.round(x * 10) / 10;

export function setsWon(detail, includeCurrent = false) {
  let a = 0, b = 0;
  (detail.sets || []).forEach(([x, y], i) => {
    if (!includeCurrent && i >= (detail.current ?? 0)) return;
    if (x > y) a++; else if (y > x) b++;
  });
  return [a, b];
}

export function ballsToOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function cricketTotals(detail) {
  const t = { a: null, b: null };
  (detail.innings || []).forEach((inn) => {
    const cur = t[inn.bat] || { runs: 0, wkts: 0, balls: 0 };
    t[inn.bat] = { runs: cur.runs + inn.runs, wkts: inn.wkts, balls: cur.balls + inn.balls };
  });
  return t;
}

// Build a full patch from a detail object (scores + status text derived from it)
export function patchFromDetail(sport, match, detail, extra = {}) {
  const p = { detail, status: extra.status || (match.status === 'scheduled' ? 'live' : match.status) };
  if (sport.scoring === 'points' || sport.scoring === 'goals') {
    const [a, b] = sumPeriods(detail.periods);
    p.score_a = a; p.score_b = b;
    p.status_text = periodName(sport, detail.period || 1);
  } else if (sport.scoring === 'sets') {
    const [a, b] = setsWon(detail, p.status === 'completed');
    p.score_a = a; p.score_b = b;
    p.status_text = `${sport.period_label || 'Set'} ${(detail.current ?? 0) + 1}`;
  } else if (sport.scoring === 'cricket') {
    const t = cricketTotals(detail);
    p.score_a = t.a ? t.a.runs : 0; p.score_b = t.b ? t.b.runs : 0;
    const inn = detail.innings?.[detail.current ?? 0];
    p.status_text = inn ? `${ballsToOvers(inn.balls)} ov` : 'Toss';
  } else if (sport.scoring === 'ranking') {
    p.score_a = 0; p.score_b = 0;
    const n = (detail.results || []).length;
    p.status_text = n ? `${n} result${n === 1 ? '' : 's'}` : '';
  }
  if (p.status === 'completed') {
    p.status_text = 'Final';
    Object.assign(p, decideWinner(sport, { ...match, ...p }));
  }
  return Object.assign(p, extra);
}

export function decideWinner(sport, m) {
  if (sport.scoring === 'ranking') return { winner: null };
  if (sport.scoring === 'cricket') {
    const d = m.detail || {};
    const inns = d.innings || [];
    const a = Number(m.score_a), b = Number(m.score_b);
    if (a === b) return { winner: 'draw', result_note: 'Match tied' };
    const w = a > b ? 'a' : 'b';
    let note = '';
    if (inns.length >= 2) {
      const second = inns[inns.length - 1];
      if (second.bat === w) note = `won by ${10 - second.wkts} wicket${10 - second.wkts === 1 ? '' : 's'}`;
      else note = `won by ${Math.abs(a - b)} run${Math.abs(a - b) === 1 ? '' : 's'}`;
    }
    return { winner: w, result_note: note || null };
  }
  const a = Number(m.score_a), b = Number(m.score_b);
  if (a === b) return { winner: 'draw' };
  return { winner: a > b ? 'a' : 'b' };
}

// --- points / goals ---
export function addScore(sport, match, side, n) {
  const d = clone(match.detail);
  if (!d.periods) Object.assign(d, initialDetail(sport));
  const idx = (d.period || 1) - 1;
  while (d.periods.length <= idx) d.periods.push([0, 0]);
  const k = side === 'a' ? 0 : 1;
  d.periods[idx][k] = round1(Math.max(0, (Number(d.periods[idx][k]) || 0) + n));
  return patchFromDetail(sport, match, d);
}
export function nextPeriod(sport, match) {
  const d = clone(match.detail);
  if (!d.periods) Object.assign(d, initialDetail(sport));
  d.period = (d.period || 1) + 1;
  while (d.periods.length < d.period) d.periods.push([0, 0]);
  return patchFromDetail(sport, match, d);
}

// --- sets ---
export function addSetPoint(sport, match, side, n) {
  const d = clone(match.detail);
  if (!d.sets) Object.assign(d, initialDetail(sport));
  const i = d.current ?? 0;
  while (d.sets.length <= i) d.sets.push([0, 0]);
  const k = side === 'a' ? 0 : 1;
  d.sets[i][k] = Math.max(0, (Number(d.sets[i][k]) || 0) + n);
  return patchFromDetail(sport, match, d);
}
export function endSet(sport, match) {
  const d = clone(match.detail);
  const i = d.current ?? 0;
  const cur = d.sets?.[i] || [0, 0];
  if (cur[0] === cur[1]) return { error: `The ${(sport.period_label || 'set').toLowerCase()} can't end level` };
  d.current = i + 1;
  d.sets.push([0, 0]);
  return patchFromDetail(sport, match, d);
}
export function setsNeeded(sport) {
  return Math.floor((sport.periods || 3) / 2) + 1;
}

// --- cricket ---
export function startInnings(sport, match, batSide, overs) {
  const d = clone(match.detail);
  if (!d.innings) Object.assign(d, initialDetail(sport, { overs }));
  if (overs) d.overs = overs;
  d.innings.push({ bat: batSide, runs: 0, wkts: 0, balls: 0, extras: 0 });
  d.current = d.innings.length - 1;
  return patchFromDetail(sport, match, d);
}
export function cricketBall(sport, match, { runs = 0, wicket = false, extra = null }) {
  const d = clone(match.detail);
  const inn = d.innings?.[d.current ?? 0];
  if (!inn) return { error: 'Start an innings first' };
  const extraRun = extra === 'wd' || extra === 'nb' ? 1 : 0;
  inn.runs += runs + extraRun;
  if (extra) inn.extras = (inn.extras || 0) + extraRun + (extra === 'b' || extra === 'lb' ? runs : 0);
  if (wicket) inn.wkts = Math.min(10, inn.wkts + 1);
  if (extra !== 'wd' && extra !== 'nb') inn.balls += 1;
  return patchFromDetail(sport, match, d);
}
export function cricketInfo(match, sport) {
  const d = match.detail || {};
  const inns = d.innings || [];
  const cur = inns[d.current ?? 0];
  const info = { overs: d.overs, innings: inns, current: cur, target: null, need: null };
  if (inns.length >= 2 && cur === inns[inns.length - 1]) {
    const first = inns[0];
    info.target = first.runs + 1;
    const ballsLeft = (d.overs || 0) * 6 - cur.balls;
    info.need = { runs: Math.max(0, info.target - cur.runs), balls: Math.max(0, ballsLeft) };
  }
  if (cur && cur.balls > 0) info.rr = ((cur.runs / cur.balls) * 6).toFixed(2);
  return info;
}

// ------------------------------------------------------------------
// Display helpers
// ------------------------------------------------------------------
export function scoreLine(m, sport) {
  // returns { a, b, note } strings for compact cards
  if (!sport) return { a: fmtNum(m.score_a), b: fmtNum(m.score_b), note: '' };
  if (m.status === 'scheduled' || m.status === 'postponed' || m.status === 'cancelled') {
    return { a: '', b: '', note: '' };
  }
  if (sport.scoring === 'cricket') {
    const t = cricketTotals(m.detail || {});
    const f = (x) => (x ? `${x.runs}/${x.wkts}` : 'Yet to bat');
    const inn = (m.detail?.innings || [])[m.detail?.current ?? 0];
    const info = cricketInfo(m, sport);
    let note = '';
    if (m.status === 'live' && info.need && info.need.runs > 0) note = `Need ${info.need.runs} off ${info.need.balls}`;
    else if (m.status === 'live' && info.rr) note = `RR ${info.rr}`;
    return { a: f(t.a), b: f(t.b), note, overs: inn ? ballsToOvers(inn.balls) : '' };
  }
  if (sport.scoring === 'ranking') {
    return { a: '', b: '', note: '' };
  }
  if (sport.scoring === 'sets') {
    const won = m.status === 'completed' ? [m.score_a, m.score_b] : setsWon(m.detail || {}, false);
    const d = m.detail || {};
    const cur = d.sets?.[d.current ?? 0];
    const note = m.status === 'live' && cur ? `${sport.period_label} ${(d.current ?? 0) + 1}: ${fmtNum(cur[0])}–${fmtNum(cur[1])}` : '';
    return { a: fmtNum(won[0]), b: fmtNum(won[1]), note };
  }
  return { a: fmtNum(m.score_a), b: fmtNum(m.score_b), note: '' };
}

// Per-period / per-set breakdown table
export function breakdown(m, sport) {
  const d = m.detail || {};
  if (!sport) return null;
  if (sport.scoring === 'points' || sport.scoring === 'goals') {
    const periods = d.periods || [];
    if (!periods.length || (sport.periods <= 1 && periods.length <= 1)) return null;
    const n = Math.max(periods.length, sport.periods);
    const cols = [];
    for (let i = 0; i < n; i++) cols.push({ label: periodShort(sport, i + 1), a: periods[i]?.[0], b: periods[i]?.[1], current: m.status === 'live' && i === (d.period || 1) - 1 });
    return { cols, totalA: fmtNum(m.score_a), totalB: fmtNum(m.score_b), totalLabel: 'T' };
  }
  if (sport.scoring === 'sets') {
    const sets = d.sets || [];
    const shown = sets.filter((s, i) => i < (d.current ?? 0) || (m.status === 'live' && i === (d.current ?? 0)) || (s[0] + s[1] > 0));
    if (!shown.length) return null;
    const cols = shown.map((s, i) => ({ label: periodShort(sport, i + 1), a: s[0], b: s[1], current: m.status === 'live' && i === (d.current ?? 0) }));
    return { cols, totalA: fmtNum(m.score_a), totalB: fmtNum(m.score_b), totalLabel: sport.period_label === 'Set' ? 'Sets' : 'Won' };
  }
  return null;
}

export function isFinished(m) {
  return m.status === 'completed';
}

// ------------------------------------------------------------------
// Standings
// ------------------------------------------------------------------
export function isTableMatch(m) {
  return (m.stage === 'group' || m.stage === 'league') && m.status !== 'cancelled';
}

export function groupTeams(teams, matches, sportId, category, group) {
  const ids = new Set(
    teams.filter((t) => t.sport_id === sportId && t.category === category && (t.group_name || '') === (group || '')).map((t) => t.id),
  );
  matches.forEach((m) => {
    if (m.sport_id === sportId && m.category === category && isTableMatch(m) && (m.group_name || '') === (group || '')) {
      if (m.team_a_id) ids.add(m.team_a_id);
      if (m.team_b_id) ids.add(m.team_b_id);
    }
  });
  return [...ids];
}

function resultOf(m) {
  if (m.winner) return m.winner;
  const a = Number(m.score_a), b = Number(m.score_b);
  return a === b ? 'draw' : a > b ? 'a' : 'b';
}

// results: [{a, b, sa, sb, w}] where a/b are team ids
export function computeTable(teamIds, results, sport, nameOf) {
  const rows = new Map();
  teamIds.forEach((id) => rows.set(id, { id, p: 0, w: 0, d: 0, l: 0, sf: 0, sa: 0, pts: 0 }));
  const winP = Number(sport.win_points ?? 2), drawP = Number(sport.draw_points ?? 1), lossP = Number(sport.loss_points ?? 0);
  results.forEach((r) => {
    const A = rows.get(r.a), B = rows.get(r.b);
    if (!A || !B) return;
    A.p++; B.p++;
    A.sf += r.sa; A.sa += r.sb; B.sf += r.sb; B.sa += r.sa;
    if (r.w === 'draw') { A.d++; B.d++; A.pts += drawP; B.pts += drawP; }
    else if (r.w === 'a') { A.w++; B.l++; A.pts += winP; B.pts += lossP; }
    else { B.w++; A.l++; B.pts += winP; A.pts += lossP; }
  });
  const list = [...rows.values()];
  list.forEach((r) => { r.diff = round1(r.sf - r.sa); r.sf = round1(r.sf); r.sa = round1(r.sa); });
  list.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.sf - x.sf || String(nameOf(x.id)).localeCompare(String(nameOf(y.id))));
  return list;
}

export function playedResults(matches) {
  return matches
    .filter((m) => m.status === 'completed' && m.team_a_id && m.team_b_id)
    .map((m) => ({ a: m.team_a_id, b: m.team_b_id, sa: Number(m.score_a) || 0, sb: Number(m.score_b) || 0, w: resultOf(m) }));
}

export function defaultMargin(sport) {
  switch (sport.scoring) {
    case 'goals': return 1;
    case 'sets': return 1;
    case 'cricket': return 20;
    case 'points': return allowsDraw(sport) ? 1 : 10;
    default: return 1;
  }
}

export function marginOptions(sport) {
  switch (sport.scoring) {
    case 'goals': return [1, 2, 3];
    case 'sets': {
      const need = setsNeeded(sport);
      const opts = [];
      for (let i = need; i >= 1; i--) opts.push(i);
      return opts; // margin in sets: need-0, need-1 …
    }
    case 'cricket': return [5, 20, 50];
    case 'points': return allowsDraw(sport) ? [0.5, 1, 2] : [3, 10, 20];
    default: return [1];
  }
}

export function marginLabel(sport, m) {
  if (sport.scoring === 'sets') {
    const need = setsNeeded(sport);
    return `${need}–${need - m}`;
  }
  if (sport.scoring === 'cricket') return `by ${m} runs`;
  return `by ${fmtNum(m)}`;
}

function hypothetical(sport, a, b, pick) {
  const margin = Number(pick.m ?? defaultMargin(sport));
  let base = 0;
  if (sport.scoring === 'points') base = allowsDraw(sport) ? 1 : 50;
  if (sport.scoring === 'cricket') base = 120;
  if (sport.scoring === 'sets') {
    const need = setsNeeded(sport);
    if (pick.w === 'draw') return { a, b, sa: 0, sb: 0, w: 'draw' };
    const win = need, lose = Math.max(0, need - margin);
    return pick.w === 'a' ? { a, b, sa: win, sb: lose, w: 'a' } : { a, b, sa: lose, sb: win, w: 'b' };
  }
  if (pick.w === 'draw') return { a, b, sa: base, sb: base, w: 'draw' };
  return pick.w === 'a' ? { a, b, sa: base + margin, sb: base, w: 'a' } : { a, b, sa: base, sb: base + margin, w: 'b' };
}

const MAX_COMBOS = 60000;

// Enumerate every outcome of the remaining fixtures (respecting picks).
export function whatIf({ teamIds, played, remaining, sport, picks = {}, qualify = 2, nameOf }) {
  const draw = allowsDraw(sport);
  const options = remaining.map((f) => {
    if (picks[f.id]) return [picks[f.id]];
    const d = defaultMargin(sport);
    const o = [{ w: 'a', m: d }, { w: 'b', m: d }];
    if (draw) o.splice(1, 0, { w: 'draw', m: 0 });
    return o;
  });
  const total = options.reduce((n, o) => n * o.length, 1);

  const pickedResults = remaining.filter((f) => picks[f.id]).map((f) => hypothetical(sport, f.team_a_id, f.team_b_id, picks[f.id]));
  const projected = computeTable(teamIds, played.concat(pickedResults), sport, nameOf);

  if (total > MAX_COMBOS) {
    return { tooMany: true, total, projected, counts: null, n: 0, outcomes: [] };
  }

  const counts = Object.fromEntries(teamIds.map((id) => [id, 0]));
  const outcomes = [];
  let tieAtCut = false;
  const idx = new Array(remaining.length).fill(0);
  for (let c = 0; c < total; c++) {
    const res = remaining.map((f, i) => hypothetical(sport, f.team_a_id, f.team_b_id, options[i][idx[i]]));
    const table = computeTable(teamIds, played.concat(res), sport, nameOf);
    const top = table.slice(0, qualify).map((r) => r.id);
    top.forEach((id) => counts[id]++);
    if (qualify > 0 && table.length > qualify && table[qualify - 1].pts === table[qualify].pts) tieAtCut = true;
    outcomes.push({ res: remaining.map((f, i) => ({ f, w: options[i][idx[i]].w })), top });
    // increment mixed-radix counter
    for (let i = 0; i < idx.length; i++) {
      idx[i]++;
      if (idx[i] < options[i].length) break;
      idx[i] = 0;
    }
  }
  return { tooMany: false, total, n: total, counts, outcomes, tieAtCut, projected };
}

export function qualStatus(count, n, finished) {
  if (count === null || count === undefined || !n) return { key: 'unknown', label: '—' };
  if (count === n) return { key: 'through', label: finished ? 'Qualified' : 'Through' };
  if (count === 0) return { key: 'out', label: finished ? 'Out' : 'Out' };
  return { key: 'race', label: 'In race' };
}

// What does the tracked team need?
export function trackSummary(wi, teamId, teamLabel, roundName) {
  if (wi.tooMany) return { headline: `Too many open results to check`, sub: 'Pick winners for a few games to narrow it down.' };
  const n = wi.n, q = wi.counts[teamId] ?? 0;
  const involves = (r) => r.f.team_a_id === teamId || r.f.team_b_id === teamId;
  const winsOf = (r) => (r.f.team_a_id === teamId && r.w === 'a') || (r.f.team_b_id === teamId && r.w === 'b');
  const own = wi.outcomes.length ? wi.outcomes[0].res.filter(involves).length : 0;
  let headline;
  if (q === n) headline = `${teamLabel} ${n === 1 && own === 0 ? 'is through' : 'is through — whatever happens'}`;
  else if (q === 0) headline = `${teamLabel} can't reach the ${roundName} from here`;
  else {
    const winsAll = wi.outcomes.filter((o) => o.res.filter(involves).every(winsOf));
    if (own > 0 && winsAll.length && winsAll.every((o) => o.top.includes(teamId))) {
      headline = `${teamLabel}: win ${own === 1 ? 'the last game' : `all ${own} games left`} and you're in`;
    } else headline = `${teamLabel} needs help from other results`;
  }
  let sub = `Reaches the ${roundName} in ${q} of ${n} possible outcome${n === 1 ? '' : 's'}`;
  if (q > 0 && q < n && own > 0) {
    const withLoss = wi.outcomes.filter((o) => o.res.some((r) => involves(r) && !winsOf(r) && r.w !== 'draw'));
    if (withLoss.length) {
      const alive = withLoss.filter((o) => o.top.includes(teamId)).length;
      sub += alive ? ` · still alive after a loss in ${alive} of ${withLoss.length}` : ' · any loss knocks them out';
    }
  }
  return { headline, sub };
}

export function nextRoundName(matches, sportId, category) {
  const ko = matches.filter((m) => m.sport_id === sportId && m.category === category);
  if (ko.some((m) => m.stage === 'quarterfinal')) return 'quarter-finals';
  if (ko.some((m) => m.stage === 'semifinal')) return 'semi-finals';
  if (ko.some((m) => m.stage === 'final')) return 'final';
  return 'knockouts';
}

// ------------------------------------------------------------------
// Medal tally (finals, 3rd-place matches and ranking events)
// ------------------------------------------------------------------
export function medalTally(matches, teamsById, sportsById) {
  const tally = new Map();
  const add = (teamId, kind, event) => {
    const t = teamsById.get(teamId);
    if (!t) return;
    const key = t.college_id;
    if (!tally.has(key)) tally.set(key, { college_id: key, gold: 0, silver: 0, bronze: 0, events: [] });
    const row = tally.get(key);
    row[kind]++;
    row.events.push({ kind, event });
  };
  matches.forEach((m) => {
    if (m.status !== 'completed') return;
    const sport = sportsById.get(m.sport_id);
    if (!sport) return;
    const ev = `${sport.name} ${m.category}`;
    if (sport.scoring === 'ranking') {
      if (m.stage !== 'final' && m.stage !== 'event') return;
      (m.detail?.results || []).forEach((r) => {
        const p = Number(r.position);
        if (p === 1) add(r.team_id, 'gold', `${ev} · ${m.title || ''}`);
        else if (p === 2) add(r.team_id, 'silver', `${ev} · ${m.title || ''}`);
        else if (p === 3) add(r.team_id, 'bronze', `${ev} · ${m.title || ''}`);
      });
      return;
    }
    const w = resultOf(m);
    if (m.stage === 'final' && w !== 'draw') {
      add(w === 'a' ? m.team_a_id : m.team_b_id, 'gold', ev);
      add(w === 'a' ? m.team_b_id : m.team_a_id, 'silver', ev);
    }
    if (m.stage === 'third_place' && w !== 'draw') add(w === 'a' ? m.team_a_id : m.team_b_id, 'bronze', ev);
  });
  return [...tally.values()].sort((x, y) => y.gold - x.gold || y.silver - x.silver || y.bronze - x.bronze);
}

export { other };
