// Procedural pixel-art monsters.
//
// Every monster is described by the left half of a 16x16 mask (mirrored to
// make the right half), a small palette and where its face sits. Outlines and
// shading are derived from the mask, and faces are stamped on top from a
// table of expressions, so new monsters or expressions are just data.
//
// This module has no DOM dependencies at import time so tools can reuse it.

export const SIZE = 16;

const FACE = {
  w: '#ffffff',
  r: '#9b1b4a',
  t: '#ffffff',
  b: '#8fe3ff',
};

export const MONSTERS = [
  {
    name: 'Bloop',
    colors: { o: '#5b1a4a', s: '#e5508f', b: '#ff80b8', l: '#ffc4de', a: '#ffffff', as: '#ffd1e6', k: '#4a1038', p: '#ff3f7f' },
    half: [
      '........',
      '.......#',
      '......##',
      '....####',
      '...#####',
      '..######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '..######',
      '...#####',
      '........',
    ],
    face: { ex: 4, ey: 7, my: 11 },
    shine: [[4, 4], [3, 5], [7, 2]],
  },
  {
    name: 'Grumble',
    colors: { o: '#2e1650', s: '#7a4cc4', b: '#a47bff', l: '#d2bcff', a: '#fff2c8', as: '#d9bf86', k: '#24103f', p: '#ff7fc8' },
    half: [
      '........',
      '.a......',
      '.aa.....',
      '..aa####',
      '..######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '..###...',
      '........',
    ],
    face: { ex: 4, ey: 6, my: 10 },
    shine: [[4, 4], [3, 5]],
    mouths: {
      idle: ['kkkk', 't..t'],
      blink: ['kkkk', 't..t'],
      happy: ['kkkk', 'trrt', '.kk.'],
      sleepy: ['kkkk', 't..t'],
    },
  },
  {
    name: 'Ogle',
    colors: { o: '#1b4a2a', s: '#3fae4f', b: '#74e06b', l: '#c4f7a5', a: '#ff5d8f', as: '#c43a6a', k: '#163a20', p: '#ff7fa0' },
    half: [
      '........',
      '......aa',
      '......aa',
      '.......o',
      '....####',
      '..######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '..######',
      '...#####',
      '.....###',
      '........',
    ],
    face: { ex: 4, ey: 6, my: 11, cyclops: true },
    shine: [[4, 5], [3, 6], [6, 1]],
  },
  {
    name: 'Fuzz',
    colors: { o: '#5a2a10', s: '#e0742a', b: '#ffa040', l: '#ffd08a', a: '#ff7f9f', as: '#d85a7a', k: '#4a200a', p: '#ff5a5a' },
    half: [
      '........',
      '..#.....',
      '..#a....',
      '..###.#.',
      '..######',
      '.#######',
      '..######',
      '.#######',
      '..######',
      '.#######',
      '..######',
      '.#######',
      '..######',
      '...#.###',
      '........',
      '........',
    ],
    face: { ex: 4, ey: 6, my: 10 },
    shine: [[4, 5], [5, 4]],
    mouths: {
      idle: ['kkkk', '.tt.'],
      blink: ['kkkk', '.tt.'],
      sleepy: ['kkkk', '.tt.'],
    },
  },
  {
    name: 'Boo',
    colors: { o: '#17306a', s: '#3f8be0', b: '#6cc4ff', l: '#c8ecff', a: '#ffffff', as: '#c8ecff', k: '#102450', p: '#ff9fd0' },
    half: [
      '........',
      '........',
      '.....###',
      '...#####',
      '..######',
      '..######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.#######',
      '.##.###.',
      '.#...#..',
      '........',
    ],
    face: { ex: 4, ey: 6, my: 10 },
    shine: [[4, 4], [3, 5], [6, 3]],
    mouths: {
      idle: ['kk', 'kk'],
      blink: ['kk', 'kk'],
    },
  },
  {
    name: 'Zap',
    colors: { o: '#6a4210', s: '#e8b020', b: '#ffe04a', l: '#fff6b0', a: '#ffffff', as: '#fff6b0', k: '#4f300a', p: '#ff8f5a' },
    half: [
      '........',
      '.......#',
      '......##',
      '......##',
      '.....###',
      '.#######',
      '.#######',
      '..######',
      '...#####',
      '...#####',
      '..######',
      '..######',
      '.####...',
      '.##.....',
      '........',
      '........',
    ],
    face: { ex: 5, ey: 6, my: 9 },
    shine: [[7, 2], [6, 4]],
  },
];

// The rainbow special is drawn with a round body whose colours cycle.
export const RAINBOW = {
  name: 'Rainbow',
  colors: { o: '#3a1a5a', s: '#000000', b: '#000000', l: '#ffffff', a: '#ffffff', as: '#ffffff', k: '#2a0f3a', p: '#ff5fa0' },
  half: [
    '........',
    '........',
    '.....###',
    '...#####',
    '..######',
    '.#######',
    '.#######',
    '.#######',
    '.#######',
    '.#######',
    '.#######',
    '..######',
    '...#####',
    '.....###',
    '........',
    '........',
  ],
  face: { ex: 4, ey: 6, my: 10 },
  shine: [[4, 4], [3, 5]],
};
export const RAINBOW_COLORS = ['#ff5a7a', '#ffa040', '#ffe04a', '#74e06b', '#6cc4ff', '#a47bff'];
export const RAINBOW_FRAMES = RAINBOW_COLORS.length;

export const EXPRESSIONS = ['idle', 'blink', 'happy', 'excited', 'surprised', 'squish', 'sad', 'sleepy', 'dizzy'];

// Two-eyed faces. Patterns use: k dark, w white, r mouth, t tooth, b tear.
// `mirror` flips the pattern for the right eye.
const EYES = {
  idle: { p: ['kw', 'kk', 'kk'] },
  blink: { p: ['..', '..', 'kk'] },
  happy: { p: ['.k.', 'k.k'], dy: 1 },
  excited: { p: ['wkk', 'kkk', 'kkw'] },
  surprised: { p: ['kkk', 'kwk', 'kkk'] },
  squish: { p: ['k..', '.k.', 'k..'], mirror: true },
  sad: { p: ['kkk', '.k.', '.b.'] },
  sleepy: { p: ['...', 'kkk'], dy: 1 },
  dizzy: { p: ['k.k', '.k.', 'k.k'] },
};

const MOUTHS = {
  idle: ['k..k', '.kk.'],
  blink: ['k..k', '.kk.'],
  happy: ['kkkk', 'krrk', '.kk.'],
  excited: ['.kk.', 'krrk', '.kk.'],
  surprised: ['kk', 'kk'],
  squish: ['kkkk'],
  sad: ['.kk.', 'k..k'],
  sleepy: ['kk', 'kk'],
  dizzy: ['k.k.', '.k.k'],
};

// Cyclops eyes are 4 wide; `pupil` marks where a 2x2 pupil goes (it follows
// the look direction).
const CYCLOPS_EYES = {
  idle: { p: ['.ww.', 'wwww', 'wwww', '.ww.'], pupil: 2 },
  blink: { p: ['....', '....', 'kkkk'] },
  happy: { p: ['....', '.kk.', 'k..k'] },
  excited: { p: ['.ww.', 'wwww', 'wwww', '.ww.'], pupil: 2, sparkle: true },
  surprised: { p: ['.ww.', 'wwww', 'wwww', '.ww.'], pupil: 1 },
  squish: { p: ['....', 'k..k', '.kk.'] },
  sad: { p: ['.ww.', 'wwww', 'wwww', '.ww.', '...b'], pupil: 2, pupilY: 1 },
  sleepy: { p: ['....', '....', 'kkkk', '.kk.'] },
  dizzy: { p: ['kkkk', 'k..k', 'k.kk', 'kkk.'] },
};

const CHEEKS = new Set(['idle', 'blink', 'happy', 'excited', 'squish', 'sleepy']);

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const ca = rgb(a);
  const cb = rgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function expandMask(half) {
  return half.map((row) => (row + row.split('').reverse().join('')).split(''));
}

const maskCache = new Map();
function maskFor(def) {
  let m = maskCache.get(def);
  if (!m) {
    m = expandMask(def.half);
    maskCache.set(def, m);
  }
  return m;
}

/**
 * Build the colour of every pixel of a monster.
 * @param {object} def        entry of MONSTERS or RAINBOW
 * @param {string} expr       one of EXPRESSIONS
 * @param {number} lx, ly     look direction (-1..1)
 * @param {string} variant    'n' | 'lh' | 'lv' | 'b0' | 'b1' | 'rb'
 * @param {number} frame      animation frame (rainbow colour offset)
 * @returns {(string|null)[]} SIZE*SIZE hex colours (null = transparent)
 */
export function buildPixels(def, expr = 'idle', lx = 0, ly = 0, variant = 'n', frame = 0) {
  const m = maskFor(def);
  const C = def.colors;
  const px = new Array(SIZE * SIZE).fill(null);
  const at = (x, y) => (x < 0 || y < 0 || x >= SIZE || y >= SIZE ? '.' : m[y][x]);
  const solid = (x, y) => {
    const ch = at(x, y);
    return ch === '#' || ch === 'a';
  };
  const set = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) px[y * SIZE + x] = c;
  };

  let outline = C.o;
  if (variant === 'b0') outline = '#ffcf3a';
  if (variant === 'b1') outline = '#fffbe0';

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ch = at(x, y);
      if (ch === '#') {
        let base = C.b;
        let shade = C.s;
        let light = C.l;
        if (variant === 'rb') {
          base = RAINBOW_COLORS[(((x + y) >> 1) + frame) % RAINBOW_FRAMES];
          shade = mix(base, '#3a1a5a', 0.3);
          light = mix(base, '#ffffff', 0.45);
        }
        let c = base;
        if (!solid(x, y + 1) || !solid(x + 1, y)) c = shade;
        else if (!solid(x, y - 1) || !solid(x - 1, y)) c = light;
        else if (!solid(x, y + 2) && (x + y) % 2 === 0) c = shade;
        set(x, y, c);
      } else if (ch === 'a') {
        set(x, y, at(x, y + 1) === '.' || at(x + 1, y) === '.' ? C.as : C.a);
      } else if (ch === 'o') {
        set(x, y, C.o);
      } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        set(x, y, outline);
      }
    }
  }

  for (const [x, y] of def.shine || []) {
    if (solid(x, y)) set(x, y, '#ffffff');
  }

  // Line specials get glowing stripes across the body.
  if (variant === 'lh' || variant === 'lv') {
    const rows = [];
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const x = variant === 'lh' ? j : i;
        const y = variant === 'lh' ? i : j;
        if (m[y][x] === '#') {
          rows.push(i);
          break;
        }
      }
    }
    const lo = Math.min(...rows);
    const hi = Math.max(...rows);
    const stripes = [lo + 2, hi - 2];
    for (const s of stripes) {
      for (let j = 0; j < SIZE; j++) {
        const x = variant === 'lh' ? j : s;
        const y = variant === 'lh' ? s : j;
        if (m[y][x] === '#') set(x, y, mix(px[y * SIZE + x], '#ffffff', 0.85));
      }
    }
  }

  drawFace(def, expr, lx, ly, set);
  return px;
}

function stamp(pattern, x0, y0, colors, set, mirror = false) {
  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y];
    for (let x = 0; x < row.length; x++) {
      const ch = mirror ? row[row.length - 1 - x] : row[x];
      if (ch === '.') continue;
      set(x0 + x, y0 + y, colors[ch]);
    }
  }
}

function drawFace(def, expr, lx, ly, set) {
  const f = def.face;
  const colors = { ...FACE, k: def.colors.k };
  const e = EYES[expr] ? expr : 'idle';

  if (f.cyclops) {
    const eye = CYCLOPS_EYES[e];
    const x0 = 6 + lx;
    const y0 = f.ey + (ly > 0 ? 1 : 0);
    stamp(eye.p, x0, y0, colors, set);
    if (eye.pupil) {
      const s = eye.pupil;
      const py = 1 + (eye.pupilY ?? ly) + (s === 1 ? 1 : 0);
      const px = 1 + lx + (s === 1 && lx >= 0 ? 1 : 0);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x0 + px + x, y0 + py + y, colors.k);
      if (eye.sparkle) set(x0 + px, y0 + py, colors.w);
    }
  } else {
    const eye = EYES[e];
    const w = eye.p[0].length;
    const xl = f.ex + 2 - w + lx;
    const xr = SIZE - (f.ex + 2 - w) - w + lx;
    const y0 = f.ey + (eye.dy || 0) + ly;
    stamp(eye.p, xl, y0, colors, set);
    stamp(eye.p, xr, y0, colors, set, eye.mirror);
  }

  if (CHEEKS.has(e)) {
    const cy = f.ey + (f.cyclops ? 4 : 3);
    const cx = f.ex - 2;
    set(cx, cy, def.colors.p);
    set(cx + 1, cy, def.colors.p);
    set(SIZE - 1 - cx, cy, def.colors.p);
    set(SIZE - 2 - cx, cy, def.colors.p);
  }

  const mouth = (def.mouths && def.mouths[e]) || MOUTHS[e];
  const mw = mouth[0].length;
  stamp(mouth, (SIZE - mw) / 2 + lx, f.my, colors, set);
}

// ---- Canvas helpers (browser only) ----

const spriteCache = new Map();

function toCanvas(pixels) {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  const img = g.createImageData(SIZE, SIZE);
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    if (!p) continue;
    const [r, gg, b] = rgb(p);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Cached sprite canvas for a monster type (-1 = rainbow). */
export function getSprite(type, expr, lx = 0, ly = 0, variant = 'n', frame = 0) {
  const key = `${type}|${expr}|${lx}|${ly}|${variant}|${frame}`;
  let c = spriteCache.get(key);
  if (!c) {
    const def = type < 0 ? RAINBOW : MONSTERS[type];
    c = toCanvas(buildPixels(def, expr, lx, ly, type < 0 ? 'rb' : variant, frame));
    spriteCache.set(key, c);
  }
  return c;
}

export function monsterColor(type) {
  return type < 0 ? '#ffffff' : MONSTERS[type].colors.b;
}

export function monsterLight(type) {
  return type < 0 ? '#ffffff' : MONSTERS[type].colors.l;
}
