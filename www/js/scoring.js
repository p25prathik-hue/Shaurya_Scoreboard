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

// ------------------------------------------------------------------
// Rulebook helpers (rules come from sports-config.js, merged in the store)
// ------------------------------------------------------------------
const KNOCKOUT = ['quarterfinal', 'semifinal', 'final', 'third_place'];
export const isKnockout = (m) => !!m && KNOCKOUT.includes(m.stage);

export function catRules(sport, category) {
  const c = sport?.rules?.cat || {};
  return { ...(c['*'] || {}), ...(c[category] || {}) };
}
export function formatNote(sport, category) { return catRules(sport, category).format || ''; }
export function tieNote(sport, category) { return catRules(sport, category).tie_note || sport?.rules?.tie_note || ''; }
export function squadLimits(sport, category) { return catRules(sport, category).squad || null; }

// Can this particular match finish level?
export function canDraw(sport, m) {
  if (!sport || sport.scoring === 'ranking') return false;
  if (isKnockout(m)) return false;
  return allowsDraw(sport);
}
export function hasShootout(sport, m) {
  return sport?.scoring === 'goals' && sport.rules?.tie === 'shootout' && !canDraw(sport, m);
}
export function extraTimeAllowed(sport, m) {
  const et = sport?.rules?.et;
  return et === 'always' || (et === 'knockout' && isKnockout(m));
}
export function bestOf(sport, m) {
  const c = catRules(sport, m?.category);
  if (c.rubbers?.length) return c.rubbers.length;
  if (m?.stage === 'final' && c.final_best_of) return c.final_best_of;
  return c.best_of || sport?.periods || 3;
}
export function rubberName(sport, m, i) {
  return catRules(sport, m?.category).rubbers?.[i] || null;
}
const ABBR = { Singles: 'S', Doubles: 'D', "Men's singles": 'MS', "Women's singles": 'WS', 'Mixed doubles': 'XD' };
export const rubberAbbr = (name) => ABBR[name] || (name ? name[0] : '');

export function periodName(sport, n) {
  const label = sport?.period_label || 'Period';
  const max = sport?.periods || 1;
  if (n > max && sport?.scoring !== 'sets') {
    if (label === 'Turn') return n - max === 1 ? 'Super inning' : `Super inning ${n - max}`;
    if (sport?.scoring === 'goals') return `Extra time ${n - max}`;
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
  if (n > max && sport?.scoring !== 'sets') {
    if (label === 'Turn') return 'SI';
    return (sport?.scoring === 'goals' ? 'ET' : 'OT') + (n - max);
  }
  if (label === 'Quarter') return 'Q' + n;
  if (label === 'Half') return 'H' + n;
  return label[0] + n;
}

export function tiebreakName(sport) {
  if (sport?.rules?.tiebreak?.[0] === 'for') return 'total game points';
  switch (sport?.scoring) {
    case 'goals': return 'goal difference';
    case 'sets': return `${(sport.period_label || 'set').toLowerCase()} difference`;
    case 'cricket': return 'run difference';
    default: return 'score difference';
  }
}

// Can a group-stage game end level? (rulebook `draws`, else a sensible default)
export function allowsDraw(sport) {
  if (!sport) return false;
  if (typeof sport.rules?.draws === 'boolean') return sport.rules.draws;
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
    case 'cricket': return { overs: opts.overs || defaultOvers(sport, opts.category), current: 0, innings: [] };
    case 'ranking': return { results: [] };
    default: return {};
  }
}

export function defaultOvers(sport, category) {
  const c = catRules(sport, category || sport?.categories?.[0]);
  return c.overs || (sport.id === 'boxcricket' ? 8 : 15);
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
    if (inn.super) return; // Super Over runs don't count towards the match score
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
    p.status_text = detail.pens ? `Penalties ${detail.pens[0]}–${detail.pens[1]}` : periodName(sport, detail.period || 1);
  } else if (sport.scoring === 'sets') {
    const [a, b] = setsWon(detail, p.status === 'completed');
    p.score_a = a; p.score_b = b;
    p.status_text = `${sport.period_label || 'Set'} ${(detail.current ?? 0) + 1}`;
  } else if (sport.scoring === 'cricket') {
    const t = cricketTotals(detail);
    p.score_a = t.a ? t.a.runs : 0; p.score_b = t.b ? t.b.runs : 0;
    const inn = detail.innings?.[detail.current ?? 0];
    p.status_text = inn ? `${inn.super ? 'Super Over · ' : ''}${ballsToOvers(inn.balls)} ov` : 'Toss';
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
    const inns = (d.innings || []).filter((x) => !x.super);
    const supers = (d.innings || []).filter((x) => x.super);
    const a = Number(m.score_a), b = Number(m.score_b);
    if (a === b) {
      // Settle with the last completed pair of Super Over innings
      for (let i = supers.length - (supers.length % 2) - 2; i >= 0; i -= 2) {
        const [s1, s2] = [supers[i], supers[i + 1]];
        if (s1.runs !== s2.runs) return { winner: s1.runs > s2.runs ? s1.bat : s2.bat, result_note: 'won the Super Over' };
        break;
      }
      return { winner: 'draw', result_note: 'Match tied' };
    }
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
  const pens = m.detail?.pens;
  if (a === b && pens && pens[0] !== pens[1]) {
    const w = pens[0] > pens[1] ? 'a' : 'b';
    return { winner: w, result_note: `won ${Math.max(...pens)}–${Math.min(...pens)} on penalties` };
  }
  if (a === b) return { winner: 'draw' };
  return { winner: a > b ? 'a' : 'b' };
}

// Is a level score acceptable right now? Returns null when the match can end,
// or a message telling the scorer how the rulebook settles the tie.
export function finishBlocker(sport, m) {
  if (!sport || sport.scoring === 'ranking') return null;
  const w = decideWinner(sport, m).winner;
  if (w !== 'draw' || canDraw(sport, m)) return null;
  switch (sport.scoring) {
    case 'cricket': return 'Scores are level — play a Super Over (rulebook: a tie goes to a Super Over).';
    case 'goals':
      if (m.detail?.pens) return 'The shootout is level — keep going (sudden death).';
      if (extraTimeAllowed(sport, m) && (m.detail?.period || 1) <= sport.periods) return 'Level at full time — play extra time, then penalties.';
      return 'Level — settle it with a penalty shootout.';
    case 'sets': return `Level — play the deciding ${(sport.period_label || 'set').toLowerCase()}.`;
    default:
      if (sport.rules?.tie === 'super_inning') return 'Tied — start the super inning (rulebook: 3 minutes each to run and chase).';
      if (sport.rules?.tie === 'golden_point') return 'Tied — play the golden point: next score wins.';
      return 'Scores are level — start overtime and keep playing until there is a winner.';
  }
}

// --- penalty shootout ---
export function startShootout(sport, match) {
  const d = clone(match.detail);
  d.pens = [0, 0];
  return patchFromDetail(sport, match, d);
}
export function addPen(sport, match, side, scored) {
  const d = clone(match.detail);
  d.pens = d.pens || [0, 0];
  d.pen_log = d.pen_log || [];
  d.pen_log.push({ side, scored: !!scored });
  if (scored) d.pens[side === 'a' ? 0 : 1]++;
  return patchFromDetail(sport, match, d);
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
export function setsNeeded(sport, m) {
  return Math.floor(bestOf(sport, m) / 2) + 1;
}

// --- cricket ---
export function startInnings(sport, match, batSide, overs, opts = {}) {
  const d = clone(match.detail);
  if (!d.innings) Object.assign(d, initialDetail(sport, { overs, category: match.category }));
  if (overs && !opts.super) d.overs = overs;
  const inn = { bat: batSide, runs: 0, wkts: 0, balls: 0, extras: 0 };
  if (opts.super) Object.assign(inn, { super: true, overs: 1 });
  d.innings.push(inn);
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
  const mains = inns.filter((x) => !x.super);
  const supers = inns.filter((x) => x.super);
  const info = { overs: cur?.super ? 1 : d.overs, innings: inns, mains, supers, current: cur, target: null, need: null, isSuper: !!cur?.super };
  let first = null;
  if (cur && !cur.super && mains.length >= 2 && cur === mains[1]) first = mains[0];
  if (cur && cur.super) {
    const k = supers.indexOf(cur);
    if (k % 2 === 1) first = supers[k - 1];
  }
  if (first) {
    info.target = first.runs + 1;
    const ballsLeft = (cur.super ? 6 : (d.overs || 0) * 6) - cur.balls;
    info.need = { runs: Math.max(0, info.target - cur.runs), balls: Math.max(0, ballsLeft) };
  }
  // A Super Over is needed once both main innings are done and level
  info.mainsLevel = mains.length >= 2 && mains[0].runs === mains[1].runs;
  info.superPairDone = supers.length > 0 && supers.length % 2 === 0;
  info.superLevel = info.superPairDone && supers[supers.length - 2].runs === supers[supers.length - 1].runs;
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
    if (m.status === 'live' && info.isSuper) note = 'Super Over' + (info.need ? ` · need ${info.need.runs} off ${info.need.balls}` : '');
    else if (m.status === 'live' && info.need && info.need.runs > 0) note = `Need ${info.need.runs} off ${info.need.balls}`;
    else if (m.status === 'live' && info.rr) note = `RR ${info.rr}`;
    return { a: f(t.a), b: f(t.b), note, overs: inn ? ballsToOvers(inn.balls) : '' };
  }
  if (sport.scoring === 'ranking') {
    return { a: '', b: '', note: '' };
  }
  if (sport.scoring === 'sets') {
    const won = m.status === 'completed' ? [m.score_a, m.score_b] : setsWon(m.detail || {}, false);
    const d = m.detail || {};
    const i = d.current ?? 0;
    const cur = d.sets?.[i];
    const rn = rubberName(sport, m, i);
    const note = m.status === 'live' && cur && i < bestOf(sport, m) ? `${sport.period_label} ${i + 1}${rn ? ' (' + rn + ')' : ''}: ${fmtNum(cur[0])}–${fmtNum(cur[1])}` : '';
    return { a: fmtNum(won[0]), b: fmtNum(won[1]), note };
  }
  const pens = m.detail?.pens;
  return { a: fmtNum(m.score_a), b: fmtNum(m.score_b), note: pens ? `Pens ${pens[0]}–${pens[1]}` : '' };
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
    for (let i = 0; i < n; i++) cols.push({ label: periodShort(sport, i + 1), a: periods[i]?.[0], b: periods[i]?.[1], current: m.status === 'live' && !d.pens && i === (d.period || 1) - 1 });
    if (d.pens) cols.push({ label: 'Pens', a: d.pens[0], b: d.pens[1], current: m.status === 'live' });
    return { cols, totalA: fmtNum(m.score_a), totalB: fmtNum(m.score_b), totalLabel: 'T' };
  }
  if (sport.scoring === 'sets') {
    const sets = d.sets || [];
    const rubbers = catRules(sport, m.category).rubbers;
    const n = bestOf(sport, m);
    const cur = d.current ?? 0;
    let cols;
    if (rubbers?.length) {
      // Team ties: always show every match in rulebook order (S, D, S…)
      cols = rubbers.map((r, i) => ({ label: rubberAbbr(r) + (rubbers.filter((x) => x === r).length > 1 ? rubbers.slice(0, i + 1).filter((x) => x === r).length : ''), title: r, a: i < cur || (i === cur && m.status !== 'scheduled') ? sets[i]?.[0] : undefined, b: i < cur || (i === cur && m.status !== 'scheduled') ? sets[i]?.[1] : undefined, current: m.status === 'live' && i === cur }));
    } else {
      const shown = sets.filter((s, i) => i < n && (i < cur || (m.status === 'live' && i === cur) || (s[0] + s[1] > 0)));
      if (!shown.length) return null;
      cols = shown.map((s, i) => ({ label: periodShort(sport, i + 1), a: s[0], b: s[1], current: m.status === 'live' && i === cur }));
    }
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
  const order = sport.rules?.tiebreak || ['diff', 'for'];
  const tb = (x, y) => {
    for (const k of order) {
      const v = k === 'for' ? y.sf - x.sf : y.diff - x.diff;
      if (v) return v;
    }
    return 0;
  };
  list.sort((x, y) => y.pts - x.pts || tb(x, y) || String(nameOf(x.id)).localeCompare(String(nameOf(y.id))));
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
  return 'final'; // rulebook: group stages followed by a final
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
