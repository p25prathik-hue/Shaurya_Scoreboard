// Small shared helpers
export const TZ = 'Asia/Kolkata';

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tagged template that escapes interpolations unless they are wrapped with raw()
const RAW = Symbol('raw');
export function raw(s) {
  return { [RAW]: true, s: s == null ? '' : String(s) };
}
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < vals.length) out += toHtml(vals[i]);
  });
  return raw(out);
}
function toHtml(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(toHtml).join('');
  if (typeof v === 'object' && v[RAW]) return v.s;
  return esc(v);
}
export function render(el, content) {
  el.innerHTML = toHtml(content);
}

// ---- dates (always shown in IST) ----
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const wdFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' });
const dmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });

export function dayKey(iso) {
  if (!iso) return '';
  return dayFmt.format(new Date(iso)); // YYYY-MM-DD
}
export function timeOf(iso) {
  if (!iso) return '--:--';
  return timeFmt.format(new Date(iso));
}
export function todayKey() {
  return dayFmt.format(new Date());
}
export function weekday(dayKeyStr) {
  return wdFmt.format(new Date(dayKeyStr + 'T12:00:00+05:30'));
}
export function dayNum(dayKeyStr) {
  return Number(dayKeyStr.slice(8, 10));
}
export function dayLabel(dayKeyStr) {
  return wdFmt.format(new Date(dayKeyStr + 'T12:00:00+05:30')) + ' ' + dmFmt.format(new Date(dayKeyStr + 'T12:00:00+05:30'));
}
export function whenLabel(iso) {
  if (!iso) return 'Time TBC';
  const k = dayKey(iso);
  return (k === todayKey() ? 'Today' : dayLabel(k)) + ' · ' + timeOf(iso);
}
export function istIso(date, time) {
  if (!date) return null;
  return new Date(`${date}T${time || '00:00'}:00+05:30`).toISOString();
}
export function relTime(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return timeOf(iso);
}

// ---- misc ----
export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? '?' + s : '';
}

export function initials(s) {
  if (!s) return '?';
  const clean = s.replace(/[^A-Za-z0-9 ]/g, ' ').trim();
  if (clean.length <= 5) return clean.toUpperCase();
  return clean.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase();
}

// Stable colour per string for team badges
const BADGE = ['#FF6A2B', '#2E3A52', '#3B5D3A', '#5B2E52', '#6A4A16', '#1F4E5A', '#5A2D1A', '#3A3A5E'];
export function badgeColor(key) {
  let h = 0;
  for (const c of String(key || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BADGE[h % BADGE.length];
}

let toastTimer;
export function toast(msg, kind = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast ' + kind), 3200);
}

export function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '0';
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10);
}

// Minimal CSV parser (handles quotes, commas, newlines in quotes)
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
