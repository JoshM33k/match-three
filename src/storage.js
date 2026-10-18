// Progress and settings, kept in localStorage when it is available.
const KEY = 'monster-pop.v1';

const defaults = () => ({
  level: 1,
  stars: {},
  best: {},
  seen: {},
  stats: { popped: {}, hatched: 0, bosses: 0, bestCombo: 0 },
  sfx: true,
  music: true,
  haptics: true,
  shake: true,
});

export function load(fresh = false) {
  if (fresh) return defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    // storage unavailable (private mode etc.) — fall back to defaults
  }
  return defaults();
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
