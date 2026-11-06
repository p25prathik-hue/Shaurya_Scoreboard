// Tiny bridge so views can ask the shell to re-render or navigate without
// importing app.js (avoids circular imports).
export const ui = {
  refresh: () => {},
  go(hash) {
    if (location.hash === hash) ui.refresh();
    else location.hash = hash;
  },
};

export function festDays(store) {
  const cfg = (window.SHAURYA_CONFIG && window.SHAURYA_CONFIG.FEST_DAYS) || [];
  const set = new Set(cfg);
  return [...set].sort();
}
