// Generates supabase/seed_demo.sql from www/js/demo-data.js (sample data for trying the live app).
// Usage: node scripts/make_seed.mjs
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { buildDemo } from '../www/js/demo-data.js';

const d = buildDemo(['2026-11-20', '2026-11-21', '2026-11-22']);
const uuid = (s) => {
  const h = createHash('sha1').update('shaurya-demo:' + s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ids = (o, keys) => {
  const r = { ...o };
  keys.forEach((k) => { if (r[k]) r[k] = uuid(r[k]); });
  return r;
};
const ins = (table, rows, cols) => (rows.length
  ? `insert into public.${table} (${cols.join(', ')}) values\n${rows.map((r) => '  (' + cols.map((c) => q(r[c])).join(', ') + ')').join(',\n')}\non conflict do nothing;\n`
  : '');

const matches = d.matches.map((m) => {
  const r = ids(m, ['id', 'team_a_id', 'team_b_id', 'venue_id', 'court_id']);
  if (r.detail?.results) r.detail = { results: r.detail.results.map((x) => ({ ...x, team_id: uuid(x.team_id) })) };
  return r;
});

const out = [
  '-- Shaurya Live — OPTIONAL sample data for testing (fake colleges, scores and players).',
  '-- Run AFTER schema.sql. Remove it before the fest with the DELETE lines at the bottom.\n',
  ins('colleges', d.colleges.map((c) => ids(c, ['id'])), ['id', 'name', 'short_name', 'city']),
  ins('venues', d.venues.map((v) => ids(v, ['id'])), ['id', 'name', 'description', 'lat', 'lng', 'indoor', 'sort_order']),
  ins('courts', d.courts.map((c) => ids(c, ['id', 'venue_id'])), ['id', 'venue_id', 'name']),
  ins('teams', d.teams.map((t) => ids(t, ['id', 'college_id'])), ['id', 'college_id', 'sport_id', 'category', 'group_name']),
  ins('players', d.players.map((p) => ids(p, ['id', 'team_id'])), ['id', 'team_id', 'name', 'jersey', 'role', 'verified']),
  ins('matches', matches, ['id', 'sport_id', 'category', 'stage', 'group_name', 'match_no', 'title', 'team_a_id', 'team_b_id', 'team_a_label', 'team_b_label', 'starts_at', 'venue_id', 'court_id', 'status', 'score_a', 'score_b', 'detail', 'winner', 'status_text']),
  ins('announcements', d.announcements.map((a) => ({ ...a, id: uuid(a.id) })), ['id', 'message', 'level', 'active']),
  `-- ------------------------------------------------------------------
-- To REMOVE all sample data before the fest, run these lines:
-- delete from public.matches       where id in (${matches.map((m) => q(m.id)).join(', ')});
-- delete from public.colleges      where id in (${d.colleges.map((c) => q(uuid(c.id))).join(', ')});
-- delete from public.venues        where id in (${d.venues.map((v) => q(uuid(v.id))).join(', ')});
-- delete from public.announcements where id = ${q(uuid('a-1'))};
`,
];
writeFileSync(new URL('../supabase/seed_demo.sql', import.meta.url), out.join('\n'));
console.log('seed written:', d.colleges.length, 'colleges', d.teams.length, 'teams', d.players.length, 'players', matches.length, 'matches');
