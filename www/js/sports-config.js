// Shaurya 2026 rulebook, encoded. Single source of truth for sport formats.
// Used by the app (merged over whatever is in the database), the demo data,
// and to generate the sports seed in supabase/schema.sql (scripts/make_seed.mjs).
//
// rules fields
//   draws     : can a group/league game end level? (knockouts never can)
//   tie       : how a level game is settled — shootout | overtime | super_over | super_inning | golden_point | decider
//   tie_note  : what fans are told about ties (per category in cat.*.tie_note when it differs)
//   et        : 'always' | 'knockout' — extra time is played before penalties
//   play_all  : every match of a team tie is played even after it's decided (counts for tie-breaks)
//   tiebreak  : standings order after points — 'diff' (score difference) and/or 'for' (scored)
//   mark_hint : what to enter for ranking events
//   events    : ranking-event titles per category
//   cat       : per category — format, squad [min, max], rubbers (team-tie order), best_of, final_best_of, overs

const S = 'Singles', D = 'Doubles';

export const SPORTS = [
  {
    id: 'cricket', name: 'Cricket', scoring: 'cricket', periods: 2, period_label: 'Innings', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men'],
    rules: {
      draws: false, tie: 'super_over', tie_note: 'A tie goes to a Super Over: the side batting second bats first, 3 batters and 1 bowler each, 2 wickets ends it. Repeat until there is a winner.',
      cat: { Men: { overs: 15, squad: [11, 15], format: '15 overs a side (ICC T20 rules, white ball). Max 3 overs per bowler, 3-over powerplay, 2 bouncers an over, free hit after every no-ball.' } },
    },
  },
  {
    id: 'boxcricket', name: 'Box Cricket', scoring: 'cricket', periods: 2, period_label: 'Innings', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Women'],
    rules: {
      draws: true, tie: 'super_over',
      cat: { Women: { overs: 8, squad: [8, 10], format: 'One-off 8-over match, 8 players a side, hard tennis ball inside a marked box. Two bowlers may bowl 2 overs; everyone else 1 over.' } },
    },
  },
  {
    id: 'football', name: 'Football', scoring: 'goals', periods: 2, period_label: 'Half', increments: [1],
    win_points: 3, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men'],
    rules: {
      draws: false, tie: 'shootout', et: 'knockout',
      tie_note: 'No draws. Level at full time: straight to penalties before the semis; semis and final play extra time (2 × 10 min) then penalties. Sudden death after 5 kicks each.',
      cat: { Men: { squad: [11, 18], format: '11-a-side, 2 × 30 min. Up to 5 substitutions in 3 windows. FIFA laws.' } },
    },
  },
  {
    id: 'futsal', name: 'Futsal', scoring: 'goals', periods: 2, period_label: 'Half', increments: [1],
    win_points: 3, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Women'],
    rules: {
      draws: false, tie: 'shootout', et: 'always',
      tie_note: 'No draws. Extra time of 2 × 5 min, then 5 penalties each — 1v1 from the centre spot with 20 seconds to score (MLS-style).',
      cat: { Women: { squad: [5, 10], format: '5-a-side (4 + goalkeeper), 2 × 15 min with a 7-min break. Rolling substitutions, no offside.' } },
    },
  },
  {
    id: 'basketball', name: 'Basketball', scoring: 'points', periods: 4, period_label: 'Quarter', increments: [1, 2, 3],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, tie: 'overtime',
      cat: {
        Men: { squad: [5, 12], format: '4 × 10-min quarters (clock stops when the ball is dead), 10-min half-time. FIBA rules, size-7 ball.', tie_note: 'Level after Q4: 5-minute overtime periods until there is a winner.' },
        Women: { squad: [5, 12], format: '4 × 8-min quarters (clock stops when the ball is dead), 10-min half-time. FIBA rules, size-6 ball.', tie_note: 'Level after Q4: 3-minute overtime periods until there is a winner.' },
      },
    },
  },
  {
    id: 'volleyball', name: 'Volleyball', scoring: 'sets', periods: 3, period_label: 'Set', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, tie: 'decider',
      cat: {
        Men: { squad: [6, 12], best_of: 3, final_best_of: 5, format: 'Best of 3 sets to 25. Final: best of 5 (5th set to 15). 3rd-place match: best of 3. FIVB rules, up to 2 liberos.' },
        Women: { squad: [6, 12], best_of: 3, format: 'Best of 3: sets 1–2 to 25, set 3 to 15. Final and 3rd-place match: 3 sets to 25.' },
      },
    },
  },
  {
    id: 'hockey', name: 'Hockey', scoring: 'goals', periods: 2, period_label: 'Half', increments: [1],
    win_points: 3, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men'],
    rules: {
      draws: true, tie: 'shootout',
      tie_note: 'Group games can be drawn. Knockouts level at full time go straight to a shootout from the midline against one defender (5 takers, then sudden death).',
      cat: { Men: { squad: [6, 12], format: '6-a-side, 2 × 20 min, unlimited substitutions. Push and reverse push only — no hits, cracks or scoops; no designated goalkeeper.' } },
    },
  },
  {
    id: 'kabaddi', name: 'Kabaddi', scoring: 'points', periods: 2, period_label: 'Half', increments: [1, 2, 3],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: true,
      cat: {
        Men: { squad: [7, 12], format: '7 a side + 5 subs, 2 × 20 min, 5 substitutions per half. All-out = 2 extra points. Weight limit 85 kg.' },
        Women: { squad: [7, 12], format: '7 a side + 5 subs, 2 × 20 min, 5 substitutions per half. All-out = 2 extra points. Weight limit 75 kg.' },
      },
    },
  },
  {
    id: 'khokho', name: 'Kho-Kho', scoring: 'points', periods: 4, period_label: 'Turn', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Mixed'],
    rules: {
      draws: false, tie: 'super_inning', tie_note: 'A tie goes to a super inning: each team gets 3 minutes to run and 3 to chase.',
      cat: { Mixed: { squad: [9, 15], format: '2 innings of 2 turns, 7 minutes each. 9 players (at least 2 women), up to 6 substitutes.' } },
    },
  },
  {
    id: 'throwball', name: 'Throwball', scoring: 'sets', periods: 3, period_label: 'Set', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, tie: 'decider',
      cat: {
        Men: { squad: [7, 12], best_of: 3, format: 'Best of 3 sets to 25. 7 a side in a 2-3-2 formation, up to 5 substitutes.' },
        Women: { squad: [7, 12], best_of: 3, format: 'Best of 3 sets to 25. 7 a side in a 2-3-2 formation, up to 5 substitutes.' },
      },
    },
  },
  {
    id: 'frisbee', name: 'Ultimate Frisbee', scoring: 'points', periods: 2, period_label: 'Half', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Mixed'],
    rules: {
      draws: false, tie: 'golden_point', tie_note: 'Level at the 60-minute cap: golden (universe) point.',
      cat: { Mixed: { squad: [7, 16], format: 'First to 15 or a 60-min hard cap; half-time at 7 points or 30 min. 7 on the field (5 men + 2 women). Played at the New Campus sports ground. Spirit of the game.' } },
    },
  },
  {
    id: 'badminton', name: 'Badminton', scoring: 'sets', periods: 5, period_label: 'Match', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, play_all: true, inner: 'games',
      cat: {
        Men: { squad: [5, 7], rubbers: [S, D, S, D, S], format: '5 matches (S, D, S, D, S), each best of 3 games to 21. Only 2 players may play twice (one singles + one doubles). Every game is played — they count for tie-breaks.' },
        Women: { squad: [3, 4], rubbers: [S, D, S], format: '3 matches (S, D, S), each best of 3 games to 21. Only 1 player may play twice. Every game is played — they count for tie-breaks.' },
      },
    },
  },
  {
    id: 'tabletennis', name: 'Table Tennis', scoring: 'sets', periods: 5, period_label: 'Game', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, inner: 'sets',
      cat: {
        Men: { squad: [5, 7], rubbers: [S, S, D, S, D], format: '5 games (S, S, D, S, D), each best of 5 sets to 11. Two players at most may play one singles + one doubles. 1 time-out per team per game.' },
        Women: { squad: [5, 7], rubbers: [S, S, D, S, D], format: '5 games (S, S, D, S, D), each best of 5 sets to 11. Two players at most may play one singles + one doubles. 1 time-out per team per game.' },
      },
    },
  },
  {
    id: 'tennis', name: 'Lawn Tennis', scoring: 'sets', periods: 5, period_label: 'Match', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, inner: 'games',
      cat: {
        Men: { squad: [4, 7], rubbers: [S, S, D, S, D], format: '5 matches (S, S, D, S, D), each a single set with a 10-point tie-break at 6–6. Deuce and advantage scoring.' },
        Women: { squad: [2, 4], rubbers: [S, D, S], format: '3 matches (S, D, S), each a single set with a 7-point tie-break at 6–6. Deuce and advantage scoring.' },
      },
    },
  },
  {
    id: 'squash', name: 'Squash', scoring: 'sets', periods: 5, period_label: 'Match', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: false, play_all: true, inner: 'games',
      cat: {
        Men: { squad: [5, 6], rubbers: [S, S, S, S, S], format: '5 singles matches, each best of 3 games to 11, five different players. All matches are played even after the tie is decided.' },
        Women: { squad: [3, 4], rubbers: [S, S, S], format: '3 singles matches with 11-point games, three different players. All matches are played even after the tie is decided.' },
      },
    },
  },
  {
    id: 'athletics', name: 'Athletics', scoring: 'ranking', periods: 1, period_label: 'Event', increments: [1],
    win_points: 0, draw_points: 0, loss_points: 0, qualify_per_group: 0, categories: ['Mixed'],
    rules: {
      mark_hint: 'Time, e.g. 10.84 s',
      events: { Mixed: ['80 m — Men', '80 m — Women', '2,000 m — Women', '5,000 m — Men'] },
      cat: { Mixed: { squad: [2, 8], format: 'Direct finals, timed: 80 m (men and women), 2,000 m (women), 5,000 m (men). Finish-line video is the evidence. World Athletics rules.' } },
    },
  },
  {
    id: 'swimming', name: 'Swimming', scoring: 'ranking', periods: 1, period_label: 'Event', increments: [1],
    win_points: 0, draw_points: 0, loss_points: 0, qualify_per_group: 0, categories: ['Mixed'],
    rules: {
      mark_hint: 'Time, e.g. 31.42 s',
      events: {
        Mixed: [
          '50 m freestyle — Men', '50 m breaststroke — Men', '50 m backstroke — Men', '50 m butterfly — Men',
          '25 m freestyle — Women', '25 m breaststroke — Women', '25 m backstroke — Women', '25 m butterfly — Women',
          '4 × 25 m freestyle mixed relay',
        ],
      },
      cat: { Mixed: { squad: [4, 8], format: 'Men swim 50 m and women 25 m in freestyle, breaststroke, backstroke and butterfly, plus a 4 × 25 m freestyle mixed relay (3 men + 1 woman). Push starts, no diving. 2–3 swimmers per college per race; max 2 individual races each.' } },
    },
  },
  {
    id: 'powerlifting', name: 'Powerlifting', scoring: 'ranking', periods: 1, period_label: 'Event', increments: [1],
    win_points: 0, draw_points: 0, loss_points: 0, qualify_per_group: 0, categories: ['Men', 'Women'],
    rules: {
      mark_hint: 'Total, e.g. 512.5 kg',
      events: {
        Men: ['Up to 59 kg', '59–66 kg', '66–74 kg', '74–83 kg', '83–93 kg'],
        Women: ['Up to 55 kg', '55–66 kg', 'Over 66 kg'],
      },
      cat: {
        Men: { squad: [1, 10], format: 'Raw. Squat, bench press, deadlift — 3 attempts each; ranked on the total of the best lifts in each bodyweight class (59 / 66 / 74 / 83 / 93 kg). Max 2 lifters per college per class; weigh-in 2 hours before.' },
        Women: { squad: [1, 6], format: 'Raw. Squat, bench press, deadlift — 3 attempts each; ranked on the total of the best lifts in each bodyweight class (55 / 66 / 66+ kg). Max 2 lifters per college per class; weigh-in 2 hours before.' },
      },
    },
  },
  {
    id: 'chess', name: 'Chess', scoring: 'points', periods: 1, period_label: 'Round', increments: [0.5, 1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Men', 'Women'],
    rules: {
      draws: true, tiebreak: ['for'], max_score: 4,
      tie_note: 'Equal game points: 1 match point each. Standings ties: total game points, then two blitz rounds, then Armageddon.',
      cat: {
        Men: { squad: [4, 6], format: '4 boards (+2 subs, fixed board order), 15 min + 10 s per move. Board win = 1 game point, draw = ½. More game points = 2 match points.' },
        Women: { squad: [4, 6], format: '4 boards (+2 subs, fixed board order), 15 min + 10 s per move. Board win = 1 game point, draw = ½. More game points = 2 match points.' },
      },
    },
  },
  {
    id: 'carrom', name: 'Carrom', scoring: 'sets', periods: 5, period_label: 'Game', increments: [1, 3],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Mixed'],
    rules: {
      draws: false, play_all: true, inner: 'points',
      cat: { Mixed: { squad: [5, 7], rubbers: ["Men's singles", "Women's singles", D, S, 'Mixed doubles'], format: "5 games (men's singles, women's singles, doubles, singles, mixed doubles), each 4 boards or 16 points. Queen = 3, other coins = 1. All 5 games are played — board difference breaks standings ties. Quiet sport: no prompting." } },
    },
  },
  {
    id: 'snooker', name: 'Snooker', scoring: 'sets', periods: 5, period_label: 'Match', increments: [1, 2, 3, 4, 5, 6, 7],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Mixed'],
    rules: {
      draws: false, play_all: true, inner: 'points',
      tie_note: 'Standings ties: head-to-head (2 teams) or total frames won (3+ teams), then play-offs.',
      cat: { Mixed: { squad: [4, 7], rubbers: [S, S, D, S, D], format: '5 matches (S, S, D, S, D), 60 minutes each — highest score wins. International rules, no free ball. A player plays at most one singles and one doubles. Quiet sport.' } },
    },
  },
  {
    id: 'fifa', name: 'FIFA', scoring: 'sets', periods: 5, period_label: 'Game', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Mixed'],
    rules: {
      draws: false, inner: 'goals',
      cat: { Mixed: { squad: [6, 7], rubbers: [S, D, S, D, S], format: 'Best of 5 games (S, D, S, D, S), 12 min each (6-min halves), controllers only, PS4. A drawn game goes to extra time, then penalties.' } },
    },
  },
  {
    id: 'valorant', name: 'Valorant', scoring: 'sets', periods: 3, period_label: 'Map', increments: [1],
    win_points: 2, draw_points: 1, loss_points: 0, qualify_per_group: 2, categories: ['Mixed'],
    rules: {
      draws: false, inner: 'rounds',
      cat: { Mixed: { squad: [5, 7], best_of: 3, format: 'Best of 3 maps from the competitive pool (Ascent, Bind, Corrode, Haven, Lotus, Icebox, Sunset); teams ban and pick alternately. One tactical time-out per side. VCT rules.' } },
    },
  },
].map((s, i) => ({ ...s, sort_order: i + 1 }));

const DEFAULTS = new Map(SPORTS.map((s) => [s.id, s]));

// Merge rulebook defaults under a sport row from the database (DB values win).
export function withRules(row) {
  const def = DEFAULTS.get(row.id);
  const dbRules = row.rules && typeof row.rules === 'object' ? row.rules : {};
  if (!def) return { ...row, rules: dbRules };
  const rules = { ...def.rules, ...dbRules };
  const cats = { ...(def.rules.cat || {}) };
  Object.entries(dbRules.cat || {}).forEach(([k, v]) => { cats[k] = { ...(cats[k] || {}), ...v }; });
  rules.cat = cats;
  return { ...def, ...row, rules };
}

export const GENERAL_RULES = [
  'Groups followed by a final in every sport (exact format depends on registrations).',
  'Carry your institute ID card — no ID, no play.',
  '15-minute grace period from the scheduled time, then a walkover can be awarded.',
  'One team per university per sport. The referee’s decision is final.',
];
