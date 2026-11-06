// Sample data for DEMO MODE (no Supabase configured). Also used to generate
// supabase/seed_demo.sql. Everything here is illustrative.

import { SPORTS } from './sports-config.js';

export { SPORTS };

const COLLEGES = [
  ['c-iima', 'IIM Ahmedabad', 'IIMA', 'Ahmedabad'],
  ['c-iimb', 'IIM Bangalore', 'IIMB', 'Bengaluru'],
  ['c-iimc', 'IIM Calcutta', 'IIMC', 'Kolkata'],
  ['c-xlri', 'XLRI Jamshedpur', 'XLRI', 'Jamshedpur'],
  ['c-iiml', 'IIM Lucknow', 'IIML', 'Lucknow'],
  ['c-iimk', 'IIM Kozhikode', 'IIMK', 'Kozhikode'],
  ['c-iimi', 'IIM Indore', 'IIMI', 'Indore'],
  ['c-fms', 'FMS Delhi', 'FMS', 'New Delhi'],
  ['c-mdi', 'MDI Gurgaon', 'MDI', 'Gurugram'],
  ['c-spj', 'SPJIMR Mumbai', 'SPJIMR', 'Mumbai'],
  ['c-iitgn', 'IIT Gandhinagar', 'IITGN', 'Gandhinagar'],
].map(([id, name, short_name, city]) => ({ id, name, short_name, city }));

const VENUES = [
  { id: 'v-indoor', name: 'Indoor Sports Complex', description: 'Basketball, badminton, table tennis and squash', lat: 23.0322, lng: 72.5369, indoor: true, sort_order: 1 },
  { id: 'v-cricket', name: 'Main Cricket Ground', description: 'Cricket and box cricket', lat: 23.0338, lng: 72.5341, indoor: false, sort_order: 2 },
  { id: 'v-football', name: 'Football Ground', description: 'Football, futsal and ultimate frisbee', lat: 23.0312, lng: 72.5333, indoor: false, sort_order: 3 },
  { id: 'v-volley', name: 'Volleyball Courts', description: 'Volleyball and throwball', lat: 23.0329, lng: 72.5352, indoor: false, sort_order: 4 },
  { id: 'v-pool', name: 'Swimming Pool', description: 'Swimming events', lat: 23.0318, lng: 72.5378, indoor: false, sort_order: 5 },
  { id: 'v-mind', name: 'Mind Sports Hall', description: 'Chess, carrom, snooker and e-sports', lat: 23.0331, lng: 72.5362, indoor: true, sort_order: 6 },
];
const COURTS = [
  ['k-in1', 'v-indoor', 'Court 1'], ['k-in2', 'v-indoor', 'Court 2'], ['k-bad3', 'v-indoor', 'Badminton Court 3'],
  ['k-pitch', 'v-cricket', 'Pitch'], ['k-field', 'v-football', 'Field'], ['k-vb-a', 'v-volley', 'Court A'],
  ['k-vb-b', 'v-volley', 'Court B'], ['k-lanes', 'v-pool', 'Lanes 1–6'], ['k-hall', 'v-mind', 'Hall'],
].map(([id, venue_id, name]) => ({ id, venue_id, name }));

const FIRST = ['Aarav', 'Kabir', 'Rohan', 'Ishaan', 'Dev', 'Vihaan', 'Arnav', 'Reyansh', 'Krish', 'Advait', 'Neel', 'Omkar', 'Tanay', 'Parth', 'Varun', 'Aditi', 'Meera', 'Riya', 'Sana', 'Tara', 'Nisha', 'Pooja', 'Anika', 'Diya'];
const LAST = ['S.', 'M.', 'D.', 'P.', 'K.', 'T.', 'J.', 'G.', 'N.', 'B.', 'R.', 'V.'];

export function buildDemo(festDays) {
  const [d1, d2, d3] = festDays;
  const at = (day, hm) => new Date(`${day}T${hm}:00+05:30`).toISOString();
  const teams = [];
  const players = [];
  const team = (college, sport, cat, group) => {
    const id = `t-${sport}-${cat[0]}-${college}`.toLowerCase();
    if (!teams.find((t) => t.id === id)) teams.push({ id, college_id: college, sport_id: sport, category: cat, group_name: group || null });
    return id;
  };
  let seq = 0;
  const squad = (teamId, n, women) => {
    for (let i = 0; i < n; i++) {
      const f = women ? FIRST[15 + ((seq + i * 2) % 9)] : FIRST[(seq * 7 + i * 3) % 15];
      players.push({ id: `p-${teamId}-${i}`, team_id: teamId, name: `${f} ${LAST[(seq + i) % LAST.length]}`, jersey: String([4, 7, 9, 11, 23, 3, 14, 17, 21, 30, 5, 8][i % 12]), role: i === 0 ? 'Captain' : '', verified: i !== 5 });
    }
    seq++;
  };

  // Basketball Men
  const bA = ['c-iima', 'c-iimb', 'c-iimc', 'c-xlri'].map((c) => team(c, 'basketball', 'Men', 'A'));
  const bB = ['c-iiml', 'c-iimk', 'c-fms', 'c-mdi'].map((c) => team(c, 'basketball', 'Men', 'B'));
  // Football Men
  const fA = ['c-iima', 'c-mdi', 'c-spj'].map((c) => team(c, 'football', 'Men', 'A'));
  const fB = ['c-iimb', 'c-iimi', 'c-iitgn'].map((c) => team(c, 'football', 'Men', 'B'));
  // Cricket, volleyball, badminton, chess, carrom
  const cr = ['c-iimc', 'c-iiml', 'c-iima', 'c-xlri'].map((c) => team(c, 'cricket', 'Men', null));
  const vb = ['c-iimk', 'c-mdi', 'c-iima'].map((c) => team(c, 'volleyball', 'Men', 'C'));
  const bw = ['c-fms', 'c-iimi', 'c-iima'].map((c) => team(c, 'badminton', 'Women', 'B'));
  const ch = ['c-iimb', 'c-iitgn', 'c-iima', 'c-xlri'].map((c) => team(c, 'chess', 'Men', 'A'));
  const ca = ['c-iima', 'c-xlri'].map((c) => team(c, 'carrom', 'Mixed', null));
  const sw = ['c-iima', 'c-iimb', 'c-spj', 'c-fms'].map((c) => team(c, 'swimming', 'Mixed', null));
  const pl = ['c-iimc', 'c-iima', 'c-mdi'].map((c) => team(c, 'powerlifting', 'Men', null));

  [...bA, ...bB].forEach((t) => squad(t, 10));
  [...fA, ...fB].forEach((t) => squad(t, 11));
  cr.forEach((t) => squad(t, 11));
  vb.forEach((t) => squad(t, 8));
  bw.forEach((t) => squad(t, 4, true));
  ch.forEach((t) => squad(t, 5));

  const M = [];
  let mi = 0;
  const match = (o) => {
    M.push({
      id: `m-${++mi}`, stage: 'group', group_name: null, match_no: null, title: null, team_a_label: null, team_b_label: null,
      status: 'scheduled', score_a: 0, score_b: 0, detail: {}, winner: null, status_text: null, result_note: null,
      stream_url: null, scorer_id: null, updated_at: new Date().toISOString(), ...o,
    });
    return M[M.length - 1];
  };
  const bbDone = (a, b, q, day, t, court) => {
    const sa = q.reduce((s, x) => s + x[0], 0), sb = q.reduce((s, x) => s + x[1], 0);
    return match({ sport_id: 'basketball', category: 'Men', group_name: 'A', team_a_id: a, team_b_id: b, starts_at: at(day, t), venue_id: 'v-indoor', court_id: court, status: 'completed', score_a: sa, score_b: sb, detail: { period: 4, periods: q }, winner: sa > sb ? 'a' : 'b', status_text: 'Final' });
  };

  // ---- Basketball Men, Group A ----
  bbDone(bA[0], bA[1], [[18, 14], [16, 17], [19, 15], [15, 15]], d1, '11:00', 'k-in1'); // IIMA 68–61 IIMB
  bbDone(bA[2], bA[3], [[12, 15], [14, 16], [13, 14], [16, 15]], d1, '17:00', 'k-in1'); // IIMC 55–60 XLRI
  bbDone(bA[1], bA[2], [[17, 13], [15, 16], [18, 14], [16, 16]], d2, '09:30', 'k-in1'); // IIMB 66–59 IIMC
  const live = match({ sport_id: 'basketball', category: 'Men', group_name: 'A', team_a_id: bA[0], team_b_id: bA[3], starts_at: at(d2, '12:00'), venue_id: 'v-indoor', court_id: 'k-in1', status: 'live', score_a: 48, score_b: 44, detail: { period: 3, periods: [[14, 12], [18, 17], [16, 15]] }, status_text: 'Q3' });
  match({ sport_id: 'basketball', category: 'Men', group_name: 'A', team_a_id: bA[1], team_b_id: bA[3], starts_at: at(d2, '18:45'), venue_id: 'v-indoor', court_id: 'k-in2' });
  match({ sport_id: 'basketball', category: 'Men', group_name: 'A', team_a_id: bA[0], team_b_id: bA[2], starts_at: at(d3, '10:00'), venue_id: 'v-indoor', court_id: 'k-in1' });
  // ---- Basketball Men, Group B ----
  const bbB = (a, b, sa, sb, day, t) => match({ sport_id: 'basketball', category: 'Men', group_name: 'B', team_a_id: a, team_b_id: b, starts_at: at(day, t), venue_id: 'v-indoor', court_id: 'k-in2', status: 'completed', score_a: sa, score_b: sb, detail: { period: 4, periods: [] }, winner: sa > sb ? 'a' : 'b', status_text: 'Final' });
  bbB(bB[0], bB[1], 71, 64, d1, '12:30');
  bbB(bB[2], bB[3], 52, 58, d1, '15:00');
  bbB(bB[0], bB[2], 63, 49, d2, '10:30');
  bbB(bB[1], bB[3], 60, 62, d2, '11:30');
  match({ sport_id: 'basketball', category: 'Men', group_name: 'B', team_a_id: bB[0], team_b_id: bB[3], starts_at: at(d2, '16:30'), venue_id: 'v-indoor', court_id: 'k-in2' });
  match({ sport_id: 'basketball', category: 'Men', group_name: 'B', team_a_id: bB[1], team_b_id: bB[2], starts_at: at(d3, '09:00'), venue_id: 'v-indoor', court_id: 'k-in2' });
  // Knockouts
  match({ sport_id: 'basketball', category: 'Men', stage: 'semifinal', match_no: '1', team_a_label: 'Group A winner', team_b_label: 'Group B runner-up', starts_at: at(d3, '14:00'), venue_id: 'v-indoor', court_id: 'k-in1' });
  match({ sport_id: 'basketball', category: 'Men', stage: 'semifinal', match_no: '2', team_a_label: 'Group B winner', team_b_label: 'Group A runner-up', starts_at: at(d3, '15:30'), venue_id: 'v-indoor', court_id: 'k-in1' });
  match({ sport_id: 'basketball', category: 'Men', stage: 'final', team_a_label: 'Winner SF 1', team_b_label: 'Winner SF 2', starts_at: at(d3, '18:30'), venue_id: 'v-indoor', court_id: 'k-in1' });

  // ---- Football Men ----
  match({ sport_id: 'football', category: 'Men', group_name: 'A', team_a_id: fA[1], team_b_id: fA[2], starts_at: at(d1, '08:00'), venue_id: 'v-football', court_id: 'k-field', status: 'completed', score_a: 2, score_b: 0, detail: { period: 2, periods: [[1, 0], [1, 0]] }, winner: 'a', status_text: 'Final' });
  match({ sport_id: 'football', category: 'Men', group_name: 'A', team_a_id: fA[0], team_b_id: fA[1], starts_at: at(d2, '14:30'), venue_id: 'v-football', court_id: 'k-field' });
  match({ sport_id: 'football', category: 'Men', group_name: 'A', team_a_id: fA[0], team_b_id: fA[2], starts_at: at(d3, '08:00'), venue_id: 'v-football', court_id: 'k-field' });
  match({ sport_id: 'football', category: 'Men', group_name: 'B', team_a_id: fB[0], team_b_id: fB[1], starts_at: at(d1, '10:00'), venue_id: 'v-football', court_id: 'k-field', status: 'completed', score_a: 1, score_b: 1, detail: { period: 2, periods: [[0, 1], [1, 0]], pens: [4, 3] }, winner: 'a', result_note: 'won 4–3 on penalties', status_text: 'Final' });
  match({ sport_id: 'football', category: 'Men', group_name: 'B', team_a_id: fB[1], team_b_id: fB[2], starts_at: at(d2, '08:00'), venue_id: 'v-football', court_id: 'k-field', status: 'completed', score_a: 3, score_b: 1, detail: { period: 2, periods: [[2, 0], [1, 1]] }, winner: 'a', status_text: 'Final' });
  match({ sport_id: 'football', category: 'Men', group_name: 'B', team_a_id: fB[0], team_b_id: fB[2], starts_at: at(d2, '16:30'), venue_id: 'v-football', court_id: 'k-field' });

  // ---- Cricket Men QF (live) ----
  match({ sport_id: 'cricket', category: 'Men', stage: 'quarterfinal', match_no: '1', team_a_id: cr[0], team_b_id: cr[1], starts_at: at(d2, '09:00'), venue_id: 'v-cricket', court_id: 'k-pitch', status: 'live', score_a: 142, score_b: 0, detail: { overs: 20, current: 0, innings: [{ bat: 'a', runs: 142, wkts: 4, balls: 98, extras: 9 }] }, status_text: '16.2 ov' });
  match({ sport_id: 'cricket', category: 'Men', stage: 'quarterfinal', match_no: '2', team_a_id: cr[2], team_b_id: cr[3], starts_at: at(d2, '13:30'), venue_id: 'v-cricket', court_id: 'k-pitch' });

  // ---- Volleyball Men Group C (live) ----
  match({ sport_id: 'volleyball', category: 'Men', group_name: 'C', team_a_id: vb[0], team_b_id: vb[1], starts_at: at(d2, '11:00'), venue_id: 'v-volley', court_id: 'k-vb-b', status: 'live', score_a: 1, score_b: 1, detail: { current: 2, sets: [[25, 21], [22, 25], [19, 22]] }, status_text: 'Set 3' });
  match({ sport_id: 'volleyball', category: 'Men', group_name: 'C', team_a_id: vb[2], team_b_id: vb[0], starts_at: at(d2, '19:30'), venue_id: 'v-volley', court_id: 'k-vb-a' });
  match({ sport_id: 'volleyball', category: 'Men', group_name: 'C', team_a_id: vb[1], team_b_id: vb[2], starts_at: at(d1, '19:30'), venue_id: 'v-volley', court_id: 'k-vb-a', status: 'completed', score_a: 2, score_b: 0, detail: { current: 2, sets: [[25, 18], [25, 23], [0, 0]] }, winner: 'a', status_text: 'Final' });

  // ---- Badminton Women Group B (live tie) ----
  match({ sport_id: 'badminton', category: 'Women', group_name: 'B', team_a_id: bw[0], team_b_id: bw[1], starts_at: at(d2, '11:30'), venue_id: 'v-indoor', court_id: 'k-bad3', status: 'live', score_a: 1, score_b: 1, detail: { current: 2, sets: [[2, 0], [1, 2], [1, 1]] }, status_text: 'Rubber 3' });

  // ---- Chess Men Group A ----
  match({ sport_id: 'chess', category: 'Men', group_name: 'A', team_a_id: ch[0], team_b_id: ch[1], starts_at: at(d1, '15:00'), venue_id: 'v-mind', court_id: 'k-hall', status: 'completed', score_a: 2.5, score_b: 1.5, detail: { period: 1, periods: [[2.5, 1.5]] }, winner: 'a', status_text: 'Final' });
  match({ sport_id: 'chess', category: 'Men', group_name: 'A', team_a_id: ch[2], team_b_id: ch[3], starts_at: at(d1, '15:00'), venue_id: 'v-mind', court_id: 'k-hall', status: 'completed', score_a: 2, score_b: 2, detail: { period: 1, periods: [[2, 2]] }, winner: 'draw', status_text: 'Final' });
  match({ sport_id: 'chess', category: 'Men', group_name: 'A', team_a_id: ch[0], team_b_id: ch[2], starts_at: at(d2, '15:00'), venue_id: 'v-mind', court_id: 'k-hall' });
  match({ sport_id: 'chess', category: 'Men', group_name: 'A', team_a_id: ch[1], team_b_id: ch[3], starts_at: at(d2, '15:00'), venue_id: 'v-mind', court_id: 'k-hall' });

  // ---- Finished finals / ranking events (medal tally) ----
  match({ sport_id: 'carrom', category: 'Mixed', stage: 'final', team_a_id: ca[0], team_b_id: ca[1], starts_at: at(d1, '18:00'), venue_id: 'v-mind', court_id: 'k-hall', status: 'completed', score_a: 3, score_b: 2, detail: { current: 5, sets: [[16, 9], [11, 16], [16, 12], [16, 7], [9, 14]] }, winner: 'a', status_text: 'Final' });
  match({ sport_id: 'swimming', category: 'Mixed', stage: 'event', title: '50 m freestyle — Men', starts_at: at(d1, '08:30'), venue_id: 'v-pool', court_id: 'k-lanes', status: 'completed', detail: { results: [
    { team_id: sw[1], athlete: 'Riya T.', mark: '31.42 s', position: 1 },
    { team_id: sw[0], athlete: 'Kabir M.', mark: '31.88 s', position: 2 },
    { team_id: sw[3], athlete: 'Sana P.', mark: '32.10 s', position: 3 },
    { team_id: sw[2], athlete: 'Arnav J.', mark: '33.05 s', position: 4 },
  ] }, status_text: 'Final' });
  match({ sport_id: 'powerlifting', category: 'Men', stage: 'event', title: '66–74 kg', starts_at: at(d2, '10:00'), venue_id: 'v-indoor', court_id: 'k-in2', status: 'completed', detail: { results: [
    { team_id: pl[1], athlete: 'Dev K.', mark: '512.5 kg total', position: 1 },
    { team_id: pl[0], athlete: 'Varun B.', mark: '497.5 kg total', position: 2 },
    { team_id: pl[2], athlete: 'Parth G.', mark: '480 kg total', position: 3 },
  ] }, status_text: 'Final' });

  const now = Date.now();
  const ev = (match_id, minsAgo, text, team) => ({ id: `e-${match_id}-${minsAgo}`, match_id, created_at: new Date(now - minsAgo * 60000).toISOString(), text, team, prev: null });
  const events = [
    ev(live.id, 1, 'IIMA +3 · 48–44', 'a'),
    ev(live.id, 2, 'XLRI +2 · 45–44', 'b'),
    ev(live.id, 3, 'Timeout — XLRI', 'b'),
    ev(live.id, 4, 'IIMA +2 · 45–42', 'a'),
    ev(live.id, 6, 'End of Q2 · 32–29', null),
    ev(live.id, 40, 'Match started', null),
  ];

  return {
    sports: SPORTS,
    colleges: COLLEGES,
    venues: VENUES,
    courts: COURTS,
    teams,
    players,
    matches: M,
    events,
    announcements: [
      { id: 'a-1', message: 'Football QF moved to 15:00 at the Football Ground. Shuttle leaves the main gate at 14:40.', level: 'warning', active: true, created_at: new Date(now - 25 * 60000).toISOString() },
    ],
  };
}
