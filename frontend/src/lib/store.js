// Small localStorage helpers. Storage can be missing or throw (private windows, blocked
// site data), so every access is wrapped and the app works without it.
const PREFIX = 'ss.v1.';

export const store = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? null : JSON.parse(raw);
    } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};
