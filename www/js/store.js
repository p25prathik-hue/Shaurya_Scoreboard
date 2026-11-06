// App state + data access. Two backends with the same interface:
//   SupaBackend — real data through Supabase (auth, Postgres, realtime)
//   DemoBackend — in-memory sample data when no Supabase project is configured
import { buildDemo } from './demo-data.js';
import { uuid } from './util.js';

const CFG = window.SHAURYA_CONFIG || {};
export const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

// ------------------------------------------------------------------
// Supabase backend
// ------------------------------------------------------------------
class SupaBackend {
  constructor() {
    this.mode = 'live';
    this.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'shaurya-auth' },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    this.channel = null;
  }

  async fetchAll(table, order = 'id', filter) {
    const out = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      let q = this.sb.from(table).select('*').order(order, { ascending: true }).range(from, from + page - 1);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...data);
      if (data.length < page) break;
    }
    return out;
  }

  async loadPublic() {
    const [sports, colleges, venues, courts, teams, matches, announcements] = await Promise.all([
      this.fetchAll('sports', 'sort_order'),
      this.fetchAll('colleges', 'name'),
      this.fetchAll('venues', 'sort_order'),
      this.fetchAll('courts', 'name'),
      this.fetchAll('teams', 'created_at'),
      this.fetchAll('matches', 'starts_at'),
      this.fetchAll('announcements', 'created_at'),
    ]);
    return { sports, colleges, venues, courts, teams, matches, announcements };
  }

  async matchesSince(iso) {
    return this.fetchAll('matches', 'updated_at', (q) => q.gt('updated_at', iso));
  }

  async loadMine(uid) {
    const [p, s, f] = await Promise.all([
      this.sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      this.sb.from('scorer_sports').select('sport_id').eq('user_id', uid),
      this.sb.from('follows').select('team_id').eq('user_id', uid),
    ]);
    return {
      profile: p.data || null,
      scorerSports: (s.data || []).map((r) => r.sport_id),
      follows: (f.data || []).map((r) => r.team_id),
    };
  }

  async players(teamIds) {
    if (!teamIds.length) return [];
    const { data, error } = await this.sb.from('players').select('*').in('team_id', teamIds).order('created_at');
    if (error) throw error;
    return data;
  }

  async events(matchId) {
    const { data, error } = await this.sb.from('match_events').select('id, match_id, created_at, text, team').eq('match_id', matchId).order('id', { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  }

  async recordScore(matchId, patch, text, team) {
    const { data, error } = await this.sb.rpc('record_score', { p_match: matchId, p_state: patch, p_text: text || null, p_team: team || null });
    if (error) throw error;
    return data;
  }
  async undo(matchId) {
    const { data, error } = await this.sb.rpc('undo_last_event', { p_match: matchId });
    if (error) throw error;
    return data;
  }

  async upsert(table, row) {
    const { data, error } = await this.sb.from(table).upsert(row).select().single();
    if (error) throw error;
    return data;
  }
  async insertMany(table, rows) {
    if (!rows.length) return [];
    const { data, error } = await this.sb.from(table).insert(rows).select();
    if (error) throw error;
    return data;
  }
  async remove(table, id) {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw error;
  }
  async follow(uid, teamId, on) {
    const q = on
      ? this.sb.from('follows').insert({ user_id: uid, team_id: teamId })
      : this.sb.from('follows').delete().eq('user_id', uid).eq('team_id', teamId);
    const { error } = await q;
    if (error && error.code !== '23505') throw error;
  }
  async updateMyName(uid, name) {
    const { error } = await this.sb.from('profiles').update({ full_name: name }).eq('id', uid);
    if (error) throw error;
  }

  async listStaff() {
    const [p, s, i] = await Promise.all([
      this.sb.from('profiles').select('*').neq('role', 'fan').order('email'),
      this.sb.from('scorer_sports').select('*'),
      this.sb.from('staff_invites').select('*').order('email'),
    ]);
    if (p.error) throw p.error;
    return { staff: p.data, assignments: s.data || [], invites: i.data || [] };
  }
  async setStaff(email, role, sports) {
    const { data, error } = await this.sb.rpc('set_staff', { p_email: email, p_role: role, p_sports: sports || [] });
    if (error) throw error;
    return data;
  }

  // ---- auth ----
  async getSession() {
    const { data } = await this.sb.auth.getSession();
    return data.session;
  }
  onAuth(cb) {
    this.sb.auth.onAuthStateChange((evt, session) => cb(evt, session));
  }
  webRedirect() {
    return location.origin + location.pathname;
  }
  async signInGoogle() {
    if (isNative()) {
      const { data, error } = await this.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${CFG.APP_SCHEME}://auth`, skipBrowserRedirect: true },
      });
      if (error) throw error;
      const Browser = window.Capacitor.registerPlugin('Browser');
      await Browser.open({ url: data.url });
      return;
    }
    const { error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.webRedirect() } });
    if (error) throw error;
  }
  async handleDeepLink(url) {
    // in.iima.shaurya://auth?code=… (PKCE) — finish Google sign-in inside the app
    try {
      const u = new URL(url);
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error_description') || u.searchParams.get('error');
      if (err) throw new Error(err);
      if (code) {
        const { error } = await this.sb.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }
    } finally {
      try { await window.Capacitor.registerPlugin('Browser').close(); } catch (e) { /* already closed */ }
    }
  }
  async sendEmailCode(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: isNative() ? undefined : this.webRedirect() } });
    if (error) throw error;
  }
  async verifyEmailCode(email, token) {
    const { error } = await this.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  }
  async signOut() {
    await this.sb.auth.signOut();
  }

  // ---- realtime ----
  subscribe(h) {
    this.unsubscribe();
    this.channel = this.sb
      .channel('shaurya-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (p) => h.match(p.eventType, p.new, p.old))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => h.announcements())
      .subscribe((status) => h.status(status));
  }
  unsubscribe() {
    if (this.channel) {
      this.sb.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

// ------------------------------------------------------------------
// Demo backend (in memory)
// ------------------------------------------------------------------
class DemoBackend {
  constructor() {
    this.mode = 'demo';
    const d = buildDemo(CFG.FEST_DAYS || ['2026-11-20', '2026-11-21', '2026-11-22']);
    this.db = d;
    this.users = {
      fan: { id: 'u-fan', email: 'fan@demo.local', full_name: 'Demo Fan', role: 'fan' },
      scorer: { id: 'u-scorer', email: 'scorer@demo.local', full_name: 'Demo Scorer', role: 'scorer' },
      admin: { id: 'u-admin', email: 'admin@demo.local', full_name: 'Demo Admin', role: 'admin' },
    };
    this.scorerSports = { 'u-scorer': ['basketball', 'volleyball'] };
    this.follows = {};
    this.invites = [];
    this.session = null;
    this.authCb = null;
    this.h = null;
    try {
      const saved = sessionStorage.getItem('shaurya-demo-user');
      if (saved && this.users[saved]) this.session = { user: { id: this.users[saved].id, email: this.users[saved].email } };
    } catch (e) { /* storage blocked */ }
  }
  copy(x) { return JSON.parse(JSON.stringify(x)); }
  async loadPublic() {
    const d = this.db;
    return this.copy({ sports: d.sports, colleges: d.colleges, venues: d.venues, courts: d.courts, teams: d.teams, matches: d.matches, announcements: d.announcements });
  }
  async matchesSince() { return []; }
  me() {
    const id = this.session?.user?.id;
    return Object.values(this.users).find((u) => u.id === id) || null;
  }
  async loadMine(uid) {
    const p = Object.values(this.users).find((u) => u.id === uid);
    return { profile: p ? { ...p } : null, scorerSports: [...(this.scorerSports[uid] || [])], follows: [...(this.follows[uid] || [])] };
  }
  async players(teamIds) { return this.copy(this.db.players.filter((p) => teamIds.includes(p.team_id))); }
  async events(matchId) {
    return this.copy(this.db.events.filter((e) => e.match_id === matchId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
  }
  canScore(m) {
    const u = this.me();
    if (!u) return false;
    if (u.role === 'admin') return true;
    return u.role === 'scorer' && (m.scorer_id === u.id || (this.scorerSports[u.id] || []).includes(m.sport_id));
  }
  async recordScore(matchId, patch, text, team) {
    const m = this.db.matches.find((x) => x.id === matchId);
    if (!m) throw new Error('Match not found');
    if (!this.canScore(m)) throw new Error('You are not allowed to score this match');
    const prev = this.copy({ status: m.status, score_a: m.score_a, score_b: m.score_b, detail: m.detail, winner: m.winner, status_text: m.status_text, result_note: m.result_note });
    ['status', 'score_a', 'score_b', 'detail', 'winner', 'status_text', 'result_note'].forEach((k) => { if (k in patch) m[k] = this.copy(patch[k]); });
    m.updated_at = new Date().toISOString();
    if (text) this.db.events.push({ id: uuid(), match_id: matchId, created_at: new Date().toISOString(), text, team: team || null, prev });
    this.push('UPDATE', m);
    return this.copy(m);
  }
  async undo(matchId) {
    const m = this.db.matches.find((x) => x.id === matchId);
    if (!this.canScore(m)) throw new Error('You are not allowed to score this match');
    const evs = this.db.events.filter((e) => e.match_id === matchId && e.prev).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    if (!evs.length) throw new Error('Nothing to undo');
    Object.assign(m, this.copy(evs[0].prev));
    m.updated_at = new Date().toISOString();
    this.db.events = this.db.events.filter((e) => e !== evs[0]);
    this.push('UPDATE', m);
    return this.copy(m);
  }
  requireAdmin(table, row) {
    const u = this.me();
    if (!u) throw new Error('Please sign in');
    if (u.role === 'admin') return;
    if (table === 'players' && u.role === 'scorer') {
      const t = this.db.teams.find((x) => x.id === row.team_id);
      if (t && (this.scorerSports[u.id] || []).includes(t.sport_id)) return;
    }
    throw new Error('Only admins can change this');
  }
  async upsert(table, row) {
    this.requireAdmin(table, row);
    const list = this.db[table];
    const r = { ...row };
    if (!r.id) r.id = uuid();
    if (table === 'matches') r.updated_at = new Date().toISOString();
    const i = list.findIndex((x) => x.id === r.id);
    if (i >= 0) list[i] = { ...list[i], ...r };
    else {
      if (table === 'matches') Object.assign(r, { status: 'scheduled', score_a: 0, score_b: 0, detail: {}, winner: null, status_text: null, result_note: null, ...row, id: r.id });
      if (table === 'announcements') r.created_at = new Date().toISOString();
      list.push(r);
    }
    const saved = this.copy(list.find((x) => x.id === r.id));
    if (table === 'matches') this.push('UPDATE', saved);
    if (table === 'announcements') this.h?.announcements();
    return saved;
  }
  async insertMany(table, rows) {
    const out = [];
    for (const r of rows) out.push(await this.upsert(table, r));
    return out;
  }
  async remove(table, id) {
    const row = this.db[table].find((x) => x.id === id);
    this.requireAdmin(table, row || {});
    this.db[table] = this.db[table].filter((x) => x.id !== id);
    if (table === 'matches') this.push('DELETE', null, { id });
    if (table === 'announcements') this.h?.announcements();
  }
  async follow(uid, teamId, on) {
    const s = new Set(this.follows[uid] || []);
    on ? s.add(teamId) : s.delete(teamId);
    this.follows[uid] = [...s];
  }
  async updateMyName(uid, name) {
    const u = Object.values(this.users).find((x) => x.id === uid);
    if (u) u.full_name = name;
  }
  async listStaff() {
    const staff = Object.values(this.users).filter((u) => u.role !== 'fan');
    const assignments = Object.entries(this.scorerSports).flatMap(([user_id, l]) => l.map((sport_id) => ({ user_id, sport_id })));
    return this.copy({ staff, assignments, invites: this.invites });
  }
  async setStaff(email, role, sports) {
    if (this.me()?.role !== 'admin') throw new Error('Only admins can manage staff');
    const u = Object.values(this.users).find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u) {
      this.invites = this.invites.filter((i) => i.email !== email.toLowerCase());
      if (role !== 'fan') this.invites.push({ email: email.toLowerCase(), role, sports });
      return role === 'fan' ? 'removed' : 'invited';
    }
    u.role = role;
    this.scorerSports[u.id] = role === 'scorer' ? [...sports] : [];
    return 'updated';
  }
  // auth
  async getSession() { return this.session; }
  onAuth(cb) { this.authCb = cb; }
  async signInDemo(kind) {
    const u = this.users[kind];
    this.session = { user: { id: u.id, email: u.email } };
    try { sessionStorage.setItem('shaurya-demo-user', kind); } catch (e) { /* ignore */ }
    this.authCb?.('SIGNED_IN', this.session);
  }
  async signInGoogle() { throw new Error('Google sign-in works once Supabase is connected. Use a demo account for now.'); }
  async sendEmailCode() { throw new Error('Email codes work once Supabase is connected. Use a demo account for now.'); }
  async verifyEmailCode() { throw new Error('Not available in demo mode'); }
  async handleDeepLink() {}
  async signOut() {
    this.session = null;
    try { sessionStorage.removeItem('shaurya-demo-user'); } catch (e) { /* ignore */ }
    this.authCb?.('SIGNED_OUT', null);
  }
  subscribe(h) { this.h = h; setTimeout(() => h.status('SUBSCRIBED'), 0); }
  unsubscribe() {}
  push(type, row, old) { setTimeout(() => this.h?.match(type, row ? this.copy(row) : null, old), 0); }
}

// ------------------------------------------------------------------
// Store
// ------------------------------------------------------------------
class Store {
  constructor() {
    this.listeners = new Set();
    this.ready = false;
    this.error = null;
    this.user = null;
    this.profile = null;
    this.scorerSports = [];
    this.follows = new Set();
    this.sports = []; this.colleges = []; this.venues = []; this.courts = []; this.teams = []; this.matches = []; this.announcements = [];
    this.playersCache = new Map();
    this.liveStatus = 'connecting';
    this.pollTimer = null;
    this.lastSync = null;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(reason, detail) { this.listeners.forEach((fn) => { try { fn(reason, detail); } catch (e) { console.error(e); } }); }

  get mode() { return this.backend?.mode || 'demo'; }
  get role() { return this.profile?.role || (this.user ? 'fan' : 'guest'); }
  get isAdmin() { return this.role === 'admin'; }
  get isStaff() { return this.role === 'admin' || this.role === 'scorer'; }

  canScore(m) {
    if (!m || !this.user) return false;
    if (this.isAdmin) return true;
    return this.role === 'scorer' && (m.scorer_id === this.user.id || this.scorerSports.includes(m.sport_id));
  }
  canManageTeam(t) {
    if (!t || !this.user) return false;
    return this.isAdmin || (this.role === 'scorer' && this.scorerSports.includes(t.sport_id));
  }

  async init() {
    const configured = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY;
    if (configured && window.supabase) this.backend = new SupaBackend();
    else {
      if (configured && !window.supabase) this.error = 'Could not load the sign-in library. Check your internet connection and reload.';
      this.backend = new DemoBackend();
    }
    try {
      await this.reloadPublic();
    } catch (e) {
      console.error(e);
      this.error = 'Could not load fest data: ' + (e.message || e);
    }
    try {
      const session = await this.backend.getSession();
      await this.setUser(session?.user || null);
    } catch (e) { console.error(e); }
    this.backend.onAuth((evt, session) => {
      // Defer: Supabase recommends not awaiting other calls inside this callback.
      setTimeout(() => {
        const u = session?.user || null;
        if ((u?.id || null) !== (this.user?.id || null) || evt === 'USER_UPDATED') this.setUser(u).then(() => this.emit('auth'));
      }, 0);
    });
    if (isNative()) {
      try {
        const App = window.Capacitor.registerPlugin('App');
        App.addListener('appUrlOpen', ({ url }) => {
          if (url && url.startsWith(CFG.APP_SCHEME + '://')) this.backend.handleDeepLink(url).catch((e) => this.emit('error', e.message || String(e)));
        });
      } catch (e) { console.warn('App plugin unavailable', e); }
    }
    this.connectLive();
    document.addEventListener('visibilitychange', () => this.onVisibility());
    // Clean ?code= left by the OAuth redirect
    if (location.search.includes('code=') || location.search.includes('error')) {
      history.replaceState(null, '', location.pathname + location.hash);
    }
    this.ready = true;
    this.emit('ready');
  }

  index() {
    const by = (list) => new Map(list.map((x) => [x.id, x]));
    this.sportsById = by(this.sports);
    this.collegesById = by(this.colleges);
    this.teamsById = by(this.teams);
    this.venuesById = by(this.venues);
    this.courtsById = by(this.courts);
    this.matchesById = by(this.matches);
  }

  async reloadPublic() {
    const d = await this.backend.loadPublic();
    Object.assign(this, d);
    this.sortMatches();
    this.index();
    this.lastSync = this.maxUpdated();
    this.emit('data');
  }

  maxUpdated() {
    return this.matches.reduce((mx, m) => (m.updated_at && m.updated_at > mx ? m.updated_at : mx), '1970-01-01T00:00:00Z');
  }

  sortMatches() {
    this.matches.sort((a, b) => String(a.starts_at || '9999').localeCompare(String(b.starts_at || '9999')));
  }

  async setUser(u) {
    this.user = u;
    this.profile = null;
    this.scorerSports = [];
    this.follows = new Set();
    if (u) {
      try {
        const mine = await this.backend.loadMine(u.id);
        this.profile = mine.profile;
        this.scorerSports = mine.scorerSports;
        this.follows = new Set(mine.follows);
      } catch (e) { console.error(e); }
    }
    this.emit('auth');
  }

  // ---- realtime ----
  connectLive() {
    this.backend.subscribe({
      match: (type, row, old) => this.applyMatch(type, row, old),
      announcements: () => this.reloadAnnouncements(),
      status: (s) => {
        this.liveStatus = s === 'SUBSCRIBED' ? 'live' : s === 'CLOSED' ? 'closed' : 'reconnecting';
        if (s === 'SUBSCRIBED') this.stopPolling();
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') this.startPolling();
        this.emit('live-status');
      },
    });
  }
  applyMatch(type, row, old) {
    if (type === 'DELETE') {
      const id = old?.id;
      this.matches = this.matches.filter((m) => m.id !== id);
    } else if (row) {
      const i = this.matches.findIndex((m) => m.id === row.id);
      if (i >= 0) this.matches[i] = row; else this.matches.push(row);
      this.sortMatches();
      if (row.updated_at > (this.lastSync || '')) this.lastSync = row.updated_at;
    }
    this.matchesById = new Map(this.matches.map((x) => [x.id, x]));
    this.emit('match', row?.id || old?.id);
  }
  async reloadAnnouncements() {
    try {
      const d = await this.backend.loadPublic();
      this.announcements = d.announcements;
      this.emit('data');
    } catch (e) { console.error(e); }
  }
  startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollChanges(), 20000);
  }
  stopPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
  async pollChanges() {
    try {
      const rows = await this.backend.matchesSince(this.lastSync || '1970-01-01T00:00:00Z');
      rows.forEach((r) => this.applyMatch('UPDATE', r));
    } catch (e) { console.warn('poll failed', e); }
  }
  onVisibility() {
    if (document.hidden) {
      // Free plans cap live connections — drop ours while the app is in the background.
      this.hiddenTimer = setTimeout(() => { this.backend.unsubscribe(); this.liveStatus = 'paused'; this.stopPolling(); }, 30000);
    } else {
      clearTimeout(this.hiddenTimer);
      if (this.liveStatus === 'paused' || this.liveStatus === 'closed') {
        this.pollChanges();
        this.connectLive();
      }
    }
  }

  // ---- data helpers ----
  sport(id) { return this.sportsById?.get(id); }
  team(id) { return this.teamsById?.get(id); }
  college(id) { return this.collegesById?.get(id); }
  teamCollege(id) { const t = this.team(id); return t ? this.college(t.college_id) : null; }
  teamName(id, fallback) { return this.teamCollege(id)?.name || fallback || 'TBD'; }
  teamShort(id, fallback) { return this.teamCollege(id)?.short_name || fallback || 'TBD'; }
  venue(id) { return this.venuesById?.get(id); }
  court(id) { return this.courtsById?.get(id); }
  match(id) { return this.matchesById?.get(id); }
  placeOf(m) {
    const v = this.venue(m.venue_id), c = this.court(m.court_id);
    return [v?.name, c?.name].filter(Boolean).join(' · ') || 'Venue TBC';
  }

  async players(teamIds, force) {
    const need = teamIds.filter((id) => id && (force || !this.playersCache.has(id)));
    if (need.length) {
      const rows = await this.backend.players(need);
      need.forEach((id) => this.playersCache.set(id, []));
      rows.forEach((p) => this.playersCache.get(p.team_id)?.push(p));
      this.playersCache.forEach((list) => list.sort((a, b) => (Number(a.jersey) || 999) - (Number(b.jersey) || 999) || a.name.localeCompare(b.name)));
    }
    return Object.fromEntries(teamIds.map((id) => [id, this.playersCache.get(id) || []]));
  }

  events(matchId) { return this.backend.events(matchId); }

  async score(match, patch, text, team) {
    const row = await this.backend.recordScore(match.id, patch, text, team);
    if (row) this.applyMatch('UPDATE', row);
    return row;
  }
  async undo(match) {
    const row = await this.backend.undo(match.id);
    if (row) this.applyMatch('UPDATE', row);
    return row;
  }

  async save(table, row) {
    const saved = await this.backend.upsert(table, row);
    await this.afterWrite(table, saved);
    return saved;
  }
  async saveMany(table, rows) {
    const saved = await this.backend.insertMany(table, rows);
    for (const r of saved) await this.afterWrite(table, r, true);
    this.index();
    this.emit('data');
    return saved;
  }
  async remove(table, id) {
    await this.backend.remove(table, id);
    if (table === 'players') this.playersCache.forEach((l, k) => this.playersCache.set(k, l.filter((p) => p.id !== id)));
    else if (Array.isArray(this[table])) this[table] = this[table].filter((x) => x.id !== id);
    this.index();
    this.emit('data');
  }
  async afterWrite(table, row, quiet) {
    if (table === 'players') {
      const l = this.playersCache.get(row.team_id) || [];
      const i = l.findIndex((p) => p.id === row.id);
      if (i >= 0) l[i] = row; else l.push(row);
      this.playersCache.set(row.team_id, l);
    } else if (Array.isArray(this[table])) {
      const i = this[table].findIndex((x) => x.id === row.id);
      if (i >= 0) this[table][i] = row; else this[table].push(row);
      if (table === 'matches') this.sortMatches();
    }
    if (!quiet) { this.index(); this.emit('data'); }
  }

  async toggleFollow(teamId) {
    if (!this.user) throw new Error('Sign in to follow teams');
    const on = !this.follows.has(teamId);
    await this.backend.follow(this.user.id, teamId, on);
    on ? this.follows.add(teamId) : this.follows.delete(teamId);
    this.emit('auth');
    return on;
  }
  async updateMyName(name) {
    await this.backend.updateMyName(this.user.id, name);
    if (this.profile) this.profile.full_name = name;
    this.emit('auth');
  }
  listStaff() { return this.backend.listStaff(); }
  setStaff(email, role, sports) { return this.backend.setStaff(email, role, sports); }

  signInGoogle() { return this.backend.signInGoogle(); }
  sendEmailCode(email) { return this.backend.sendEmailCode(email); }
  verifyEmailCode(email, code) { return this.backend.verifyEmailCode(email, code); }
  signInDemo(kind) { return this.backend.signInDemo(kind); }
  signOut() { return this.backend.signOut(); }
}

export const store = new Store();
