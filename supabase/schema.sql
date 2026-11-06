-- =====================================================================
-- Shaurya Live — Supabase schema, security rules and sports seed
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to re-run: every object is created with IF NOT EXISTS /
-- OR REPLACE, and seed rows use ON CONFLICT.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- One row per signed-in user. Role decides what they can change.
--   fan    : can view everything, follow teams
--   scorer : can score matches of their assigned sports, edit those rosters
--   admin  : SportsComm core team — full control
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'fan' check (role in ('fan', 'scorer', 'admin')),
  created_at  timestamptz not null default now()
);

-- Staff added by email before they have signed in for the first time.
create table if not exists public.staff_invites (
  email       text primary key,
  role        text not null check (role in ('scorer', 'admin')),
  sports      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.sports (
  id            text primary key,
  name          text not null,
  -- points  : basketball, kabaddi, frisbee, chess (board points)
  -- goals   : football, futsal, hockey
  -- sets    : volleyball, throwball, racket sports & e-sports ties (sets / rubbers / maps)
  -- cricket : runs / wickets / overs
  -- ranking : athletics, swimming, powerlifting (positions, not head-to-head)
  scoring       text not null check (scoring in ('points', 'goals', 'sets', 'cricket', 'ranking')),
  periods       int  not null default 2,          -- quarters/halves, or "best of" for sets
  period_label  text not null default 'Half',     -- Quarter, Half, Set, Rubber, Map, Innings…
  increments    numeric[] not null default '{1}', -- score buttons on the scoring pad
  win_points    numeric not null default 2,
  draw_points   numeric not null default 1,
  loss_points   numeric not null default 0,
  qualify_per_group int not null default 2,        -- teams per group that reach knockouts
  categories    text[] not null default '{Men}',
  sort_order    int  not null default 0,
  rules         jsonb not null default '{}'::jsonb      -- rulebook: formats, squads, tie rules, team-tie order
);
alter table public.sports add column if not exists rules jsonb not null default '{}'::jsonb;

create table if not exists public.scorer_sports (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  sport_id  text not null references public.sports (id) on delete cascade,
  primary key (user_id, sport_id)
);

create table if not exists public.colleges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text not null,
  city        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.venues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  lat          double precision,
  lng          double precision,
  indoor       boolean not null default false,
  sort_order   int not null default 0
);

create table if not exists public.courts (
  id        uuid primary key default gen_random_uuid(),
  venue_id  uuid not null references public.venues (id) on delete cascade,
  name      text not null
);

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  college_id  uuid not null references public.colleges (id) on delete cascade,
  sport_id    text not null references public.sports (id) on delete cascade,
  category    text not null,
  group_name  text,
  created_at  timestamptz not null default now(),
  unique (college_id, sport_id, category)
);

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null,
  jersey      text,
  role        text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists players_team_idx on public.players (team_id);

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  sport_id      text not null references public.sports (id) on delete cascade,
  category      text not null,
  stage         text not null default 'group'
                check (stage in ('group', 'league', 'round', 'quarterfinal', 'semifinal', 'final', 'third_place', 'event')),
  group_name    text,
  match_no      text,
  title         text,                -- for ranking events, e.g. "100 m sprint final"
  team_a_id     uuid references public.teams (id) on delete set null,
  team_b_id     uuid references public.teams (id) on delete set null,
  team_a_label  text,                -- placeholder before teams are known, e.g. "Group A winner"
  team_b_label  text,
  starts_at     timestamptz,
  venue_id      uuid references public.venues (id) on delete set null,
  court_id      uuid references public.courts (id) on delete set null,
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'live', 'completed', 'cancelled', 'postponed')),
  score_a       numeric not null default 0,
  score_b       numeric not null default 0,
  detail        jsonb not null default '{}'::jsonb,   -- periods / sets / innings / ranking results
  winner        text check (winner in ('a', 'b', 'draw')),
  status_text   text,                -- e.g. "Q3", "16.2 ov", "Set 2"
  result_note   text,                -- e.g. "won by 23 runs", "walkover"
  stream_url    text,                -- Phase 2: live stream link
  scorer_id     uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists matches_sport_idx on public.matches (sport_id, category);
create index if not exists matches_start_idx on public.matches (starts_at);

create table if not exists public.match_events (
  id          bigint generated always as identity primary key,
  match_id    uuid not null references public.matches (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  text        text not null,
  team        text,
  prev        jsonb      -- score state before this event, used for Undo
);
create index if not exists match_events_match_idx on public.match_events (match_id, id desc);

create table if not exists public.follows (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, team_id)
);

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  level       text not null default 'info' check (level in ('info', 'warning')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------
-- 2. Helper functions used by the security rules
-- ---------------------------------------------------------------------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Can the current user score a match of this sport / with this assigned scorer?
create or replace function public.can_score(p_sport text, p_scorer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.is_admin() or (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'scorer')
      and (
        coalesce(p_scorer = auth.uid(), false)
        or exists (select 1 from public.scorer_sports where user_id = auth.uid() and sport_id = p_sport)
      )
    ),
    false
  );
$$;

create or replace function public.can_manage_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.teams t
    join public.scorer_sports s on s.sport_id = t.sport_id and s.user_id = auth.uid()
    join public.profiles p on p.id = auth.uid() and p.role = 'scorer'
    where t.id = p_team
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------

-- Create a profile for every new sign-up; apply any pending staff invite.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.staff_invites;
begin
  select * into inv from public.staff_invites where lower(email) = lower(new.email);

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(inv.role, 'fan')
  )
  on conflict (id) do nothing;

  if inv.email is not null then
    insert into public.scorer_sports (user_id, sport_id)
    select new.id, s from unnest(inv.sports) as s
    where exists (select 1 from public.sports where id = s)
    on conflict do nothing;
    delete from public.staff_invites where email = inv.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody except an admin (or the database owner in the SQL editor) can change a role.
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.email is distinct from old.email then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists matches_touch on public.matches;
create trigger matches_touch
  before update on public.matches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Scoring functions (the only way scorers change a match)
-- ---------------------------------------------------------------------

-- Apply a new score state and log an event (with the previous state for Undo).
create or replace function public.record_score(
  p_match uuid,
  p_state jsonb,
  p_text  text default null,
  p_team  text default null
)
returns public.matches language plpgsql security definer set search_path = public as $$
declare
  m    public.matches;
  prev jsonb;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match not found';
  end if;
  if not public.can_score(m.sport_id, m.scorer_id) then
    raise exception 'You are not allowed to score this match';
  end if;
  if p_state ? 'status' and (p_state ->> 'status') not in ('scheduled', 'live', 'completed', 'cancelled', 'postponed') then
    raise exception 'Invalid status';
  end if;

  prev := jsonb_build_object(
    'status', m.status, 'score_a', m.score_a, 'score_b', m.score_b, 'detail', m.detail,
    'winner', m.winner, 'status_text', m.status_text, 'result_note', m.result_note
  );

  update public.matches set
    status      = coalesce(p_state ->> 'status', status),
    score_a     = coalesce((p_state ->> 'score_a')::numeric, score_a),
    score_b     = coalesce((p_state ->> 'score_b')::numeric, score_b),
    detail      = coalesce(p_state -> 'detail', detail),
    winner      = case when p_state ? 'winner'      then p_state ->> 'winner'      else winner end,
    status_text = case when p_state ? 'status_text' then p_state ->> 'status_text' else status_text end,
    result_note = case when p_state ? 'result_note' then p_state ->> 'result_note' else result_note end
  where id = p_match
  returning * into m;

  if coalesce(length(p_text), 0) > 0 then
    insert into public.match_events (match_id, created_by, text, team, prev)
    values (p_match, auth.uid(), left(p_text, 300), p_team, prev);
  end if;
  return m;
end;
$$;

-- Restore the state saved with the latest event and delete that event.
create or replace function public.undo_last_event(p_match uuid)
returns public.matches language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  e public.match_events;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match not found';
  end if;
  if not public.can_score(m.sport_id, m.scorer_id) then
    raise exception 'You are not allowed to score this match';
  end if;

  select * into e from public.match_events
  where match_id = p_match and prev is not null
  order by id desc limit 1;
  if not found then
    raise exception 'Nothing to undo';
  end if;

  update public.matches set
    status      = e.prev ->> 'status',
    score_a     = (e.prev ->> 'score_a')::numeric,
    score_b     = (e.prev ->> 'score_b')::numeric,
    detail      = coalesce(e.prev -> 'detail', '{}'::jsonb),
    winner      = e.prev ->> 'winner',
    status_text = e.prev ->> 'status_text',
    result_note = e.prev ->> 'result_note'
  where id = p_match
  returning * into m;

  delete from public.match_events where id = e.id;
  return m;
end;
$$;

-- Admin: give someone a role (by email). Works before or after their first sign-in.
create or replace function public.set_staff(p_email text, p_role text, p_sports text[] default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage staff';
  end if;
  if p_role not in ('fan', 'scorer', 'admin') then
    raise exception 'Invalid role';
  end if;

  select id into uid from public.profiles where lower(email) = lower(trim(p_email));

  if uid is null then
    if p_role = 'fan' then
      delete from public.staff_invites where lower(email) = lower(trim(p_email));
      return 'removed';
    end if;
    insert into public.staff_invites (email, role, sports)
    values (lower(trim(p_email)), p_role, coalesce(p_sports, '{}'))
    on conflict (email) do update set role = excluded.role, sports = excluded.sports;
    return 'invited';
  end if;

  update public.profiles set role = p_role where id = uid;
  delete from public.scorer_sports where user_id = uid;
  if p_role = 'scorer' then
    insert into public.scorer_sports (user_id, sport_id)
    select uid, s from unnest(coalesce(p_sports, '{}')) as s
    where exists (select 1 from public.sports where id = s)
    on conflict do nothing;
  end if;
  return 'updated';
end;
$$;

revoke execute on function public.record_score(uuid, jsonb, text, text) from public, anon;
revoke execute on function public.undo_last_event(uuid) from public, anon;
revoke execute on function public.set_staff(text, text, text[]) from public, anon;
grant execute on function public.record_score(uuid, jsonb, text, text) to authenticated;
grant execute on function public.undo_last_event(uuid) to authenticated;
grant execute on function public.set_staff(text, text, text[]) to authenticated;

-- Table privileges for the app's API roles. Row Level Security (below) still
-- decides which rows each person may actually read or change.
grant usage on schema public to anon, authenticated;
grant select on public.sports, public.colleges, public.venues, public.courts, public.teams, public.players,
  public.matches, public.match_events, public.announcements to anon, authenticated;
grant insert, update, delete on public.sports, public.colleges, public.venues, public.courts, public.teams,
  public.players, public.matches, public.announcements to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.staff_invites, public.scorer_sports, public.follows to authenticated;

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.staff_invites enable row level security;
alter table public.sports        enable row level security;
alter table public.scorer_sports enable row level security;
alter table public.colleges      enable row level security;
alter table public.venues        enable row level security;
alter table public.courts        enable row level security;
alter table public.teams         enable row level security;
alter table public.players       enable row level security;
alter table public.matches       enable row level security;
alter table public.match_events  enable row level security;
alter table public.follows       enable row level security;
alter table public.announcements enable row level security;

-- Drop old versions of our policies so the file can be re-run.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','staff_invites','sports','scorer_sports','colleges','venues','courts',
                        'teams','players','matches','match_events','follows','announcements')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Public, read-only fest data (no login needed to watch scores)
create policy "public read" on public.sports        for select using (true);
create policy "public read" on public.colleges      for select using (true);
create policy "public read" on public.venues        for select using (true);
create policy "public read" on public.courts        for select using (true);
create policy "public read" on public.teams         for select using (true);
create policy "public read" on public.players       for select using (true);
create policy "public read" on public.matches       for select using (true);
create policy "public read" on public.match_events  for select using (true);
create policy "public read" on public.announcements for select using (true);

-- Admin-only writes on fest structure
create policy "admin write" on public.sports        for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.colleges      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.venues        for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.courts        for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.teams         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.matches       for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all"   on public.staff_invites for all using (public.is_admin()) with check (public.is_admin());

-- Rosters: admins, or scorers assigned to that sport
create policy "staff write" on public.players for all
  using (public.can_manage_team(team_id)) with check (public.can_manage_team(team_id));

-- Profiles: you see and rename yourself; admins see everyone
create policy "own or admin read"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "own or admin update" on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Scorer sport assignments
create policy "own or admin read" on public.scorer_sports for select using (user_id = auth.uid() or public.is_admin());
create policy "admin write"       on public.scorer_sports for all using (public.is_admin()) with check (public.is_admin());

-- Follows: each user manages their own
create policy "own follows" on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- match_events has no write policy: events are written only through record_score / undo_last_event.

-- ---------------------------------------------------------------------
-- 6. Realtime (live score pushes)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'announcements') then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Sports seed — Shaurya 2026 rulebook (generated from www/js/sports-config.js
--    by scripts/make_seed.mjs; re-running this file resets these 23 sports)
-- ---------------------------------------------------------------------
-- BEGIN SPORTS SEED
insert into public.sports (id, name, scoring, periods, period_label, increments, win_points, draw_points, loss_points, qualify_per_group, categories, sort_order, rules) values
  ('cricket', 'Cricket', 'cricket', 2, 'Innings', '{1}', 2, 1, 0, 2, '{"Men"}', 1, '{"draws":false,"tie":"super_over","tie_note":"A tie goes to a Super Over: the side batting second bats first, 3 batters and 1 bowler each, 2 wickets ends it. Repeat until there is a winner.","cat":{"Men":{"overs":15,"squad":[11,15],"format":"15 overs a side (ICC T20 rules, white ball). Max 3 overs per bowler, 3-over powerplay, 2 bouncers an over, free hit after every no-ball."}}}'::jsonb),
  ('boxcricket', 'Box Cricket', 'cricket', 2, 'Innings', '{1}', 2, 1, 0, 2, '{"Women"}', 2, '{"draws":true,"tie":"super_over","cat":{"Women":{"overs":8,"squad":[8,10],"format":"One-off 8-over match, 8 players a side, hard tennis ball inside a marked box. Two bowlers may bowl 2 overs; everyone else 1 over."}}}'::jsonb),
  ('football', 'Football', 'goals', 2, 'Half', '{1}', 3, 1, 0, 2, '{"Men"}', 3, '{"draws":false,"tie":"shootout","et":"knockout","tie_note":"No draws. Level at full time: straight to penalties before the semis; semis and final play extra time (2 × 10 min) then penalties. Sudden death after 5 kicks each.","cat":{"Men":{"squad":[11,18],"format":"11-a-side, 2 × 30 min. Up to 5 substitutions in 3 windows. FIFA laws."}}}'::jsonb),
  ('futsal', 'Futsal', 'goals', 2, 'Half', '{1}', 3, 1, 0, 2, '{"Women"}', 4, '{"draws":false,"tie":"shootout","et":"always","tie_note":"No draws. Extra time of 2 × 5 min, then 5 penalties each — 1v1 from the centre spot with 20 seconds to score (MLS-style).","cat":{"Women":{"squad":[5,10],"format":"5-a-side (4 + goalkeeper), 2 × 15 min with a 7-min break. Rolling substitutions, no offside."}}}'::jsonb),
  ('basketball', 'Basketball', 'points', 4, 'Quarter', '{1,2,3}', 2, 1, 0, 2, '{"Men","Women"}', 5, '{"draws":false,"tie":"overtime","cat":{"Men":{"squad":[5,12],"format":"4 × 10-min quarters (clock stops when the ball is dead), 10-min half-time. FIBA rules, size-7 ball.","tie_note":"Level after Q4: 5-minute overtime periods until there is a winner."},"Women":{"squad":[5,12],"format":"4 × 8-min quarters (clock stops when the ball is dead), 10-min half-time. FIBA rules, size-6 ball.","tie_note":"Level after Q4: 3-minute overtime periods until there is a winner."}}}'::jsonb),
  ('volleyball', 'Volleyball', 'sets', 3, 'Set', '{1}', 2, 1, 0, 2, '{"Men","Women"}', 6, '{"draws":false,"tie":"decider","cat":{"Men":{"squad":[6,12],"best_of":3,"final_best_of":5,"format":"Best of 3 sets to 25. Final: best of 5 (5th set to 15). 3rd-place match: best of 3. FIVB rules, up to 2 liberos."},"Women":{"squad":[6,12],"best_of":3,"format":"Best of 3: sets 1–2 to 25, set 3 to 15. Final and 3rd-place match: 3 sets to 25."}}}'::jsonb),
  ('hockey', 'Hockey', 'goals', 2, 'Half', '{1}', 3, 1, 0, 2, '{"Men"}', 7, '{"draws":true,"tie":"shootout","tie_note":"Group games can be drawn. Knockouts level at full time go straight to a shootout from the midline against one defender (5 takers, then sudden death).","cat":{"Men":{"squad":[6,12],"format":"6-a-side, 2 × 20 min, unlimited substitutions. Push and reverse push only — no hits, cracks or scoops; no designated goalkeeper."}}}'::jsonb),
  ('kabaddi', 'Kabaddi', 'points', 2, 'Half', '{1,2,3}', 2, 1, 0, 2, '{"Men","Women"}', 8, '{"draws":true,"cat":{"Men":{"squad":[7,12],"format":"7 a side + 5 subs, 2 × 20 min, 5 substitutions per half. All-out = 2 extra points. Weight limit 85 kg."},"Women":{"squad":[7,12],"format":"7 a side + 5 subs, 2 × 20 min, 5 substitutions per half. All-out = 2 extra points. Weight limit 75 kg."}}}'::jsonb),
  ('khokho', 'Kho-Kho', 'points', 4, 'Turn', '{1}', 2, 1, 0, 2, '{"Mixed"}', 9, '{"draws":false,"tie":"super_inning","tie_note":"A tie goes to a super inning: each team gets 3 minutes to run and 3 to chase.","cat":{"Mixed":{"squad":[9,15],"format":"2 innings of 2 turns, 7 minutes each. 9 players (at least 2 women), up to 6 substitutes."}}}'::jsonb),
  ('throwball', 'Throwball', 'sets', 3, 'Set', '{1}', 2, 1, 0, 2, '{"Men","Women"}', 10, '{"draws":false,"tie":"decider","cat":{"Men":{"squad":[7,12],"best_of":3,"format":"Best of 3 sets to 25. 7 a side in a 2-3-2 formation, up to 5 substitutes."},"Women":{"squad":[7,12],"best_of":3,"format":"Best of 3 sets to 25. 7 a side in a 2-3-2 formation, up to 5 substitutes."}}}'::jsonb),
  ('frisbee', 'Ultimate Frisbee', 'points', 2, 'Half', '{1}', 2, 1, 0, 2, '{"Mixed"}', 11, '{"draws":false,"tie":"golden_point","tie_note":"Level at the 60-minute cap: golden (universe) point.","cat":{"Mixed":{"squad":[7,16],"format":"First to 15 or a 60-min hard cap; half-time at 7 points or 30 min. 7 on the field (5 men + 2 women). Played at the New Campus sports ground. Spirit of the game."}}}'::jsonb),
  ('badminton', 'Badminton', 'sets', 5, 'Match', '{1}', 2, 1, 0, 2, '{"Men","Women"}', 12, '{"draws":false,"play_all":true,"inner":"games","cat":{"Men":{"squad":[5,7],"rubbers":["Singles","Doubles","Singles","Doubles","Singles"],"format":"5 matches (S, D, S, D, S), each best of 3 games to 21. Only 2 players may play twice (one singles + one doubles). Every game is played — they count for tie-breaks."},"Women":{"squad":[3,4],"rubbers":["Singles","Doubles","Singles"],"format":"3 matches (S, D, S), each best of 3 games to 21. Only 1 player may play twice. Every game is played — they count for tie-breaks."}}}'::jsonb),
  ('tabletennis', 'Table Tennis', 'sets', 5, 'Game', '{1}', 2, 1, 0, 2, '{"Men","Women"}', 13, '{"draws":false,"inner":"sets","cat":{"Men":{"squad":[5,7],"rubbers":["Singles","Singles","Doubles","Singles","Doubles"],"format":"5 games (S, S, D, S, D), each best of 5 sets to 11. Two players at most may play one singles + one doubles. 1 time-out per team per game."},"Women":{"squad":[5,7],"rubbers":["Singles","Singles","Doubles","Singles","Doubles"],"format":"5 games (S, S, D, S, D), each best of 5 sets to 11. Two players at most may play one singles + one doubles. 1 time-out per team per game."}}}'::jsonb),
  ('tennis', 'Lawn Tennis', 'sets', 5, 'Match', '{1}', 2, 1, 0, 2, '{"Men","Women"}', 14, '{"draws":false,"inner":"games","cat":{"Men":{"squad":[4,7],"rubbers":["Singles","Singles","Doubles","Singles","Doubles"],"format":"5 matches (S, S, D, S, D), each a single set with a 10-point tie-break at 6–6. Deuce and advantage scoring."},"Women":{"squad":[2,4],"rubbers":["Singles","Doubles","Singles"],"format":"3 matches (S, D, S), each a single set with a 7-point tie-break at 6–6. Deuce and advantage scoring."}}}'::jsonb),
  ('squash', 'Squash', 'sets', 5, 'Match', '{1}', 2, 1, 0, 2, '{"Men","Women"}', 15, '{"draws":false,"play_all":true,"inner":"games","cat":{"Men":{"squad":[5,6],"rubbers":["Singles","Singles","Singles","Singles","Singles"],"format":"5 singles matches, each best of 3 games to 11, five different players. All matches are played even after the tie is decided."},"Women":{"squad":[3,4],"rubbers":["Singles","Singles","Singles"],"format":"3 singles matches with 11-point games, three different players. All matches are played even after the tie is decided."}}}'::jsonb),
  ('athletics', 'Athletics', 'ranking', 1, 'Event', '{1}', 0, 0, 0, 0, '{"Mixed"}', 16, '{"mark_hint":"Time, e.g. 10.84 s","events":{"Mixed":["80 m — Men","80 m — Women","2,000 m — Women","5,000 m — Men"]},"cat":{"Mixed":{"squad":[2,8],"format":"Direct finals, timed: 80 m (men and women), 2,000 m (women), 5,000 m (men). Finish-line video is the evidence. World Athletics rules."}}}'::jsonb),
  ('swimming', 'Swimming', 'ranking', 1, 'Event', '{1}', 0, 0, 0, 0, '{"Mixed"}', 17, '{"mark_hint":"Time, e.g. 31.42 s","events":{"Mixed":["50 m freestyle — Men","50 m breaststroke — Men","50 m backstroke — Men","50 m butterfly — Men","25 m freestyle — Women","25 m breaststroke — Women","25 m backstroke — Women","25 m butterfly — Women","4 × 25 m freestyle mixed relay"]},"cat":{"Mixed":{"squad":[4,8],"format":"Men swim 50 m and women 25 m in freestyle, breaststroke, backstroke and butterfly, plus a 4 × 25 m freestyle mixed relay (3 men + 1 woman). Push starts, no diving. 2–3 swimmers per college per race; max 2 individual races each."}}}'::jsonb),
  ('powerlifting', 'Powerlifting', 'ranking', 1, 'Event', '{1}', 0, 0, 0, 0, '{"Men","Women"}', 18, '{"mark_hint":"Total, e.g. 512.5 kg","events":{"Men":["Up to 59 kg","59–66 kg","66–74 kg","74–83 kg","83–93 kg"],"Women":["Up to 55 kg","55–66 kg","Over 66 kg"]},"cat":{"Men":{"squad":[1,10],"format":"Raw. Squat, bench press, deadlift — 3 attempts each; ranked on the total of the best lifts in each bodyweight class (59 / 66 / 74 / 83 / 93 kg). Max 2 lifters per college per class; weigh-in 2 hours before."},"Women":{"squad":[1,6],"format":"Raw. Squat, bench press, deadlift — 3 attempts each; ranked on the total of the best lifts in each bodyweight class (55 / 66 / 66+ kg). Max 2 lifters per college per class; weigh-in 2 hours before."}}}'::jsonb),
  ('chess', 'Chess', 'points', 1, 'Round', '{0.5,1}', 2, 1, 0, 2, '{"Men","Women"}', 19, '{"draws":true,"tiebreak":["for"],"max_score":4,"tie_note":"Equal game points: 1 match point each. Standings ties: total game points, then two blitz rounds, then Armageddon.","cat":{"Men":{"squad":[4,6],"format":"4 boards (+2 subs, fixed board order), 15 min + 10 s per move. Board win = 1 game point, draw = ½. More game points = 2 match points."},"Women":{"squad":[4,6],"format":"4 boards (+2 subs, fixed board order), 15 min + 10 s per move. Board win = 1 game point, draw = ½. More game points = 2 match points."}}}'::jsonb),
  ('carrom', 'Carrom', 'sets', 5, 'Game', '{1,3}', 2, 1, 0, 2, '{"Mixed"}', 20, '{"draws":false,"play_all":true,"inner":"points","cat":{"Mixed":{"squad":[5,7],"rubbers":["Men''s singles","Women''s singles","Doubles","Singles","Mixed doubles"],"format":"5 games (men''s singles, women''s singles, doubles, singles, mixed doubles), each 4 boards or 16 points. Queen = 3, other coins = 1. All 5 games are played — board difference breaks standings ties. Quiet sport: no prompting."}}}'::jsonb),
  ('snooker', 'Snooker', 'sets', 5, 'Match', '{1,2,3,4,5,6,7}', 2, 1, 0, 2, '{"Mixed"}', 21, '{"draws":false,"play_all":true,"inner":"points","tie_note":"Standings ties: head-to-head (2 teams) or total frames won (3+ teams), then play-offs.","cat":{"Mixed":{"squad":[4,7],"rubbers":["Singles","Singles","Doubles","Singles","Doubles"],"format":"5 matches (S, S, D, S, D), 60 minutes each — highest score wins. International rules, no free ball. A player plays at most one singles and one doubles. Quiet sport."}}}'::jsonb),
  ('fifa', 'FIFA', 'sets', 5, 'Game', '{1}', 2, 1, 0, 2, '{"Mixed"}', 22, '{"draws":false,"inner":"goals","cat":{"Mixed":{"squad":[6,7],"rubbers":["Singles","Doubles","Singles","Doubles","Singles"],"format":"Best of 5 games (S, D, S, D, S), 12 min each (6-min halves), controllers only, PS4. A drawn game goes to extra time, then penalties."}}}'::jsonb),
  ('valorant', 'Valorant', 'sets', 3, 'Map', '{1}', 2, 1, 0, 2, '{"Mixed"}', 23, '{"draws":false,"inner":"rounds","cat":{"Mixed":{"squad":[5,7],"best_of":3,"format":"Best of 3 maps from the competitive pool (Ascent, Bind, Corrode, Haven, Lotus, Icebox, Sunset); teams ban and pick alternately. One tactical time-out per side. VCT rules."}}}'::jsonb)
on conflict (id) do update set
  name = excluded.name, scoring = excluded.scoring, periods = excluded.periods, period_label = excluded.period_label,
  increments = excluded.increments, win_points = excluded.win_points, draw_points = excluded.draw_points,
  loss_points = excluded.loss_points, qualify_per_group = excluded.qualify_per_group,
  categories = excluded.categories, sort_order = excluded.sort_order, rules = excluded.rules;
-- END SPORTS SEED

-- ---------------------------------------------------------------------
-- 8. Make yourself the first admin
-- ---------------------------------------------------------------------
-- Replace the email below with yours and run these two lines on their own.
-- If you have not signed in yet, the invite is applied on your first sign-in.
--
--   insert into public.staff_invites (email, role) values ('you@example.com', 'admin')
--     on conflict (email) do update set role = 'admin';
--   update public.profiles set role = 'admin' where lower(email) = lower('you@example.com');
