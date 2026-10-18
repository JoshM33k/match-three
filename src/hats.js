// Cosmetic hats every monster can wear. Unlocked by progress, chosen in the
// Monster Book. Patterns are drawn 1:1 with the 16px sprites.
import { pattern } from './pixel.js';

export const HATS = [
  { id: 'none', name: 'NO HAT', need: 'ALWAYS AVAILABLE', rows: [], colors: {}, test: () => true },
  {
    id: 'bow',
    name: 'BIG BOW',
    need: 'FINISH LEVEL 2',
    rows: ['oo.oo', 'opopo', 'oo.oo'],
    colors: { o: '#6a1046', p: '#ff5fa0' },
    fill: { o: '#ff8fc0' },
    test: (s) => s.level > 2,
  },
  {
    id: 'party',
    name: 'PARTY HAT',
    need: 'FINISH LEVEL 6',
    rows: ['..w..', '..y..', '.yby.', '.byb.', 'ybyby'],
    colors: { w: '#ffffff', y: '#ffe04a', b: '#6cc4ff' },
    test: (s) => s.level > 6,
  },
  {
    id: 'flower',
    name: 'FLOWER',
    need: 'REACH MINT MEADOW',
    rows: ['.p.', 'pyp', '.p.', '.g.'],
    colors: { p: '#ff8fc0', y: '#ffe04a', g: '#3fae4f' },
    test: (s) => s.level > 10,
  },
  {
    id: 'beanie',
    name: 'COZY BEANIE',
    need: 'REACH STARRY SEA',
    rows: ['..w..', '.rrr.', 'rrrrr', 'wwwww'],
    colors: { w: '#ffffff', r: '#ff5a7a' },
    test: (s) => s.level > 20,
  },
  {
    id: 'crown',
    name: 'ROYAL CROWN',
    need: 'DEFEAT A BOSS',
    rows: ['y.r.y', 'yyyyy', 'yyyyy'],
    colors: { y: '#ffcf3a', r: '#ff5a7a' },
    test: (s) => (s.stats && s.stats.bosses) >= 1,
  },
  {
    id: 'tophat',
    name: 'TOP HAT',
    need: 'EARN 40 STARS',
    rows: ['.kkk.', '.kkk.', '.rrr.', 'kkkkk'],
    colors: { k: '#2a1a3a', r: '#ff5a7a' },
    test: (s) => Object.values(s.stars || {}).reduce((a, b) => a + b, 0) >= 40,
  },
];

// Row (from the top of a 16px sprite) where each species' head starts.
const HEAD = [2, 3, 4, 4, 2, 2];

export function hatById(id) {
  return HATS.find((h) => h.id === id) || HATS[0];
}

export function hatUnlocked(hat, settings) {
  try {
    return !!hat.test(settings);
  } catch {
    return false;
  }
}

/**
 * Draw a hat on a monster sprite drawn at (x, y) with size (w, h).
 * Hats stay crisp at 1px per sprite pixel; size only shifts the anchor.
 */
export function drawHat(ctx, id, type, x, y, w, h) {
  const hat = hatById(id);
  if (!hat.rows.length || type < 0) return;
  const scale = Math.max(1, Math.round(w / 16));
  const hw = hat.rows[0].length * scale;
  const hh = hat.rows.length * scale;
  const hx = Math.round(x + w / 2 - hw / 2);
  const hy = Math.round(y + (HEAD[type] * h) / 16 - hh + scale);
  if (scale === 1) {
    pattern(ctx, hat.rows, hx, hy, hat.colors);
  } else {
    for (let r = 0; r < hat.rows.length; r++) {
      for (let c = 0; c < hat.rows[r].length; c++) {
        const col = hat.colors[hat.rows[r][c]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(hx + c * scale, hy + r * scale, scale, scale);
      }
    }
  }
}
