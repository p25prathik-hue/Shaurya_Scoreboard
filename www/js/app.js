// App shell: router, navigation, event delegation, live re-rendering
import { store, isNative } from './store.js';
import { ui } from './ui.js';
import { html, render, toast } from './util.js';
import { icon } from './components.js';
import * as fan from './views-fan.js';
import * as org from './views-org.js';

const routes = [
  [/^\/$/, fan.home],
  [/^\/match\/([^/]+)$/, fan.match],
  [/^\/standings$/, fan.standings],
  [/^\/venues$/, fan.venues],
  [/^\/teams$/, fan.teams],
  [/^\/team\/([^/]+)$/, fan.team],
  [/^\/login$/, fan.login],
  [/^\/me$/, fan.me],
  [/^\/formats$/, fan.formats],
  [/^\/org$/, org.desk],
  [/^\/org\/score\/([^/]+)$/, org.score],
  [/^\/org\/fixtures$/, org.fixtures],
  [/^\/org\/fixture\/([^/]+)$/, org.fixture],
  [/^\/org\/teams$/, org.teamsAdmin],
  [/^\/org\/team\/([^/]+)$/, org.roster],
  [/^\/org\/venues$/, org.venuesAdmin],
  [/^\/org\/staff$/, org.staff],
  [/^\/org\/sports$/, org.sportsAdmin],
];

const viewEl = document.getElementById('view');
const navEl = document.getElementById('bottom-nav');
const topNavEl = document.getElementById('top-nav');
const actionsEl = document.getElementById('header-actions');
const demoEl = document.getElementById('demo-bar');
let current = null;
let currentPath = null;

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, q] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(q || '')) };
}

function route() {
  const { path, query } = parseHash();
  let view = null;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { view = fn({ params: m.slice(1).map(decodeURIComponent), query }); break; }
  }
  if (!view) view = { render: () => html`<div class="empty mt">Page not found. <a href="#/">Go home</a></div>` };
  const samePage = currentPath === location.hash;
  current = view;
  currentPath = location.hash;
  draw();
  if (!samePage) window.scrollTo(0, 0);
  if (view.mount && store.ready) view.mount();
  shell();
}

function draw(opts = {}) {
  if (!current) return;
  if (!store.ready) {
    viewEl.innerHTML = '<div class="loading"><div class="spinner"></div>Loading Shaurya Live…</div>';
    return;
  }
  const active = document.activeElement;
  const keep = opts.keepFocus && active && viewEl.contains(active) && active.id ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
  const y = window.scrollY;
  const edits = captureEdits();
  try {
    render(viewEl, current.render());
  } catch (e) {
    console.error(e);
    viewEl.innerHTML = '';
    render(viewEl, html`<div class="empty mt">Something went wrong showing this page. <a href="#/">Go home</a><div class="tiny" style="margin-top:6px">${e.message}</div></div>`);
  }
  restoreEdits(edits);
  window.scrollTo(0, y);
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus(); try { el.setSelectionRange(keep.start, keep.end); } catch (e) { /* not a text input */ } }
  }
}

ui.refresh = (opts) => draw(opts || {});

// Keep half-typed form input when the page re-renders (live score updates, event log refresh…)
function fieldKey(el) {
  if (el.id) return '#' + el.id;
  const f = el.closest('form');
  const fk = f ? `${f.dataset.form || ''}|${f.dataset.id || f.dataset.venue || ''}` : '';
  return `${fk}|${el.name}|${el.type === 'checkbox' || el.type === 'radio' ? el.value : ''}`;
}
function captureEdits() {
  const out = [];
  viewEl.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.id && !el.name) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== el.defaultChecked) out.push([fieldKey(el), 'checked', el.checked]);
    } else if (el.tagName === 'SELECT') {
      const def = [...el.options].find((o) => o.defaultSelected) || el.options[0];
      if (def && el.value !== def.value) out.push([fieldKey(el), 'value', el.value]);
    } else if (el.value !== el.defaultValue) out.push([fieldKey(el), 'value', el.value]);
  });
  return out;
}
function restoreEdits(list) {
  if (!list.length) return;
  const map = new Map();
  viewEl.querySelectorAll('input, select, textarea').forEach((el) => map.set(fieldKey(el), el));
  list.forEach(([k, prop, v]) => {
    const el = map.get(k);
    if (!el) return;
    if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === v)) return;
    el[prop] = v;
  });
}

// ---------- navigation chrome ----------
function shell() {
  const { path } = parseHash();
  const inOrg = path.startsWith('/org');
  const fanTabs = [
    ['#/', '/', 'home', 'Live'],
    ['#/standings', '/standings', 'chart', 'Standings'],
    ['#/venues', '/venues', 'pin', 'Venues'],
    ['#/teams', '/teams', 'users', 'Teams'],
  ];
  if (store.isStaff) fanTabs.push(['#/org', '/org', 'shield', 'Organise']);
  else fanTabs.push([store.user ? '#/me' : '#/login', store.user ? '/me' : '/login', 'user', store.user ? 'Me' : 'Sign in']);
  const orgTabs = store.isAdmin
    ? [['#/org', '/org', 'grid', 'Desk'], ['#/org/fixtures', '/org/fixture', 'calendar', 'Fixtures'], ['#/org/teams', '/org/team', 'users', 'Teams'], ['#/org/staff', '/org/staff', 'shield', 'Staff'], ['#/', '/x', 'home', 'Fan view']]
    : [['#/org', '/org', 'grid', 'Desk'], ['#/org/teams', '/org/team', 'users', 'Squads'], ['#/me', '/me', 'user', 'Me'], ['#/', '/x', 'home', 'Fan view']];
  const tabs = inOrg ? orgTabs : fanTabs;
  const isCur = (prefix) => (prefix === '/' ? path === '/' || path.startsWith('/match') : prefix === '/org' ? path === '/org' || path.startsWith('/org/score') : path.startsWith(prefix));
  const link = ([href, prefix, ic, label]) => html`<a href="${href}" ${isCur(prefix) ? 'aria-current="page"' : ''}>${icon(ic, 22)}${label}</a>`;
  render(navEl, tabs.map(link));
  navEl.className = 'bottom-nav' + (inOrg ? ' org' : '');
  render(topNavEl, tabs.map(link));
  topNavEl.className = 'top-nav' + (inOrg ? ' org' : '');

  const liveOk = store.liveStatus === 'live' || store.mode === 'demo';
  render(actionsEl, html`
    ${store.mode === 'live' ? html`<span class="conn ${liveOk ? '' : 'bad'}" title="${liveOk ? 'Live updates on' : 'Reconnecting — refreshing every 20 s'}"><i></i><span class="sr-only">${liveOk ? 'Live updates on' : 'Reconnecting'}</span></span>` : ''}
    ${store.isStaff && !inOrg ? html`<a class="icon-btn org" href="#/org" aria-label="Organiser tools">${icon('shield', 20)}</a>` : ''}
    <a class="icon-btn" href="${store.user ? '#/me' : '#/login'}" aria-label="${store.user ? 'Your account' : 'Sign in'}">${icon('user', 20)}</a>`);
  demoEl.hidden = store.mode !== 'demo' && !store.error;
  if (store.error) render(demoEl, html`${store.error}`);
  else if (store.mode === 'demo') render(demoEl, html`Demo mode — sample data only. Add your Supabase URL and key in <b>config.js</b> to go live.`);
}

// ---------- event delegation ----------
function findHandler(kind, el) {
  const map = current && current[kind];
  return map ? map[el.dataset[kind === 'actions' ? 'act' : kind === 'change' ? 'change' : 'input']] : null;
}

viewEl.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !viewEl.contains(el)) return;
  const fn = current?.actions?.[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  try { await fn(el, e); } catch (err) { console.error(err); toast(err.message || String(err), 'error'); }
});
viewEl.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = findHandler('change', el);
  if (fn) fn(el, e);
});
viewEl.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const fn = findHandler('input', el);
  if (fn) fn(el, e);
});
viewEl.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = current?.forms?.[form.dataset.form];
  if (!fn) return;
  const btn = form.querySelector('[type=submit]');
  if (btn) btn.disabled = true;
  try { await fn(new FormData(form), form); } catch (err) { console.error(err); toast(err.message || String(err), 'error'); }
  if (btn && btn.isConnected) btn.disabled = false;
});

// ---------- store updates ----------
let pending = false;
store.on((reason, detail) => {
  if (reason === 'error') { toast(detail, 'error'); return; }
  if (reason === 'auth' || reason === 'ready') shell();
  if (reason === 'live-status') { shell(); return; }
  if (current?.onStore) current.onStore(reason, detail);
  if (reason === 'ready') { draw(); current?.mount?.(); return; }
  const editing = document.activeElement && viewEl.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!current || (!current.live && reason !== 'auth') || editing) return;
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; draw(); });
});

window.addEventListener('hashchange', route);
window.addEventListener('online', () => store.ready && store.pollChanges());

// ---------- boot ----------
route();
store.init().then(() => {
  shell();
  if (!isNative() && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
  }
});
