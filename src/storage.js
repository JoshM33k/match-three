// Progress and settings, kept in localStorage when it is available.
const KEY = 'monster-pop.v1';

const DEFAULTS = { level: 1, stars: {}, best: {}, sfx: true, music: true };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // storage unavailable (private mode etc.) — fall back to defaults
  }
  return { ...DEFAULTS, stars: {}, best: {} };
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
