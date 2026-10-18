// Level configuration. Levels are generated from their number so the game
// goes on forever, getting gently harder.
import { makeRng } from './board.js';

export const ROWS = 8;
export const COLS = 8;

// Board shapes for some levels ('.' = no cell).
export const SHAPES = {
  heart: ['.##..##.', '########', '########', '########', '########', '.######.', '..####..', '...##...'],
  diamond: ['...##...', '..####..', '.######.', '########', '########', '.######.', '..####..', '...##...'],
  donut: ['########', '########', '########', '###..###', '###..###', '########', '########', '########'],
  plus: ['..####..', '..####..', '########', '########', '########', '########', '..####..', '..####..'],
  hourglass: ['########', '.######.', '..####..', '..####..', '..####..', '..####..', '.######.', '########'],
};
const SHAPE_ORDER = ['heart', 'donut', 'diamond', 'plus', 'hourglass'];

/** Set of key(r, c) for the void cells of a shape. */
export function voidsOf(shape) {
  const out = new Set();
  if (!shape) return out;
  SHAPES[shape].forEach((row, r) => [...row].forEach((ch, c) => ch === '.' && out.add(r * 64 + c)));
  return out;
}

/** Which monster types appear on a level's board. */
export function speciesFor(n, types = 6) {
  const all = [...Array(types).keys()];
  if (n <= 20) return all;
  const world = Math.floor((n - 1) / 10); // 2 = Starry Sea, ...
  const out = [3, 1, 4, 0, 5, 2][(world - 2) % 6];
  return all.map((t) => (t === out ? 6 : t));
}

/** A symmetric blob of goo cells in the middle of the board. */
function makeGoo(n, rng) {
  const cells = new Set();
  const want = Math.min(14, 8 + Math.floor(n / 5));
  const k = (r, c) => r * COLS + c;
  for (let guard = 0; cells.size < want && guard < 500; guard++) {
    const r = 2 + Math.floor(rng() * 5);
    const c = 1 + Math.floor(rng() * (COLS / 2 - 1));
    cells.add(k(r, c));
    cells.add(k(r, COLS - 1 - c));
  }
  return [...cells].map((v) => [Math.floor(v / COLS), v % COLS]);
}

export function getLevel(n) {
  const rng = makeRng(n * 7919);
  const types = n <= 3 ? 5 : 6;
  // From the third world on, one familiar monster sits out for Shroomy (6).
  const species = speciesFor(n, types);
  const moves = Math.max(18, 22 - Math.floor(n / 4));
  // Targets come from simulated play (tools/simulate.mjs): a typical score
  // per move on a six-monster board, times a difficulty factor that ramps
  // from very forgiving to "you'll need a plan". (Five-monster boards score
  // about twice as much, so the first levels are a gentle warm-up.)
  const perMove = 245;
  const difficulty = Math.min(0.82, 0.4 + n * 0.032);
  // Every fifth level is a boss battle against a giant crowned monster.
  const boss = n % 5 === 0 ? { type: (n / 5 - 1) % 6, hp: Math.min(125, 90 + n) } : null;
  const shape = !boss && n >= 7 && n % 3 === 1 ? SHAPE_ORDER[Math.floor(n / 3) % SHAPE_ORDER.length] : null;
  // smaller boards score less, roughly in proportion to how many cells they have
  const shapeCells = shape ? 64 - voidsOf(shape).size : 64;
  const target = Math.round((perMove * moves * difficulty * Math.pow(shapeCells / 64, 1.5)) / 50) * 50;
  const collect = [];
  // every fourth level from 4 has monster eggs to hatch
  const eggs = !boss && n >= 4 && n % 4 === 0 ? Math.min(12, 3 + Math.floor(n / 4)) : 0;
  if (eggs) collect.push({ type: -2, count: eggs });
  // goo puddles to clean up on some levels
  let goo = null;
  if (!boss && !eggs && n >= 6 && n % 4 === 2) {
    const holes = voidsOf(shape);
    goo = makeGoo(n, rng).filter(([r, c]) => !holes.has(r * 64 + c));
    collect.push({ type: -3, count: goo.length });
  }
  if (!boss && !goo && n >= 2 && n % 3 !== 1 && collect.length < 2) {
    const kinds = n % 3 === 0 && n >= 3 && !eggs ? 2 : 1;
    const pool = [...species];
    for (let i = 0; i < kinds; i++) {
      const type = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      collect.push({ type, count: Math.min(24, 8 + Math.round(n * 0.7)) - (kinds - 1) * 3 });
    }
  }
  // On boss levels beating the boss is the real goal; the score target is low.
  const stars = boss ? [Math.round((target * 0.4) / 50) * 50, target, Math.round(target * 1.4)] : [target, Math.round(target * 1.35), Math.round(target * 1.75)];
  return {
    n,
    types,
    species,
    moves,
    target: stars[0],
    stars,
    boss,
    collect,
    eggs,
    goo,
    shape,
    seed: n * 104729 + Date.now(),
  };
}

/** Zen mode: endless, relaxing play with no moves limit or goals. */
export function getZenLevel() {
  return { n: 0, zen: true, types: 6, species: [0, 1, 2, 3, 4, 5], moves: 0, target: 0, stars: [0, 0, 0], collect: [], eggs: 0, boss: null, seed: Date.now() };
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Daily challenge: the same seeded board for everyone on a given day. */
export function getDailyLevel(day = todayKey()) {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const kinds = [
    { name: 'CLASSIC DAY', types: 6, moves: 20, eggs: 0 },
    { name: 'EGG HUNT', types: 6, moves: 20, eggs: 5 },
    { name: 'MONSTER RUSH', types: 5, moves: 15, eggs: 0 },
  ];
  const k = kinds[h % kinds.length];
  return { n: 0, daily: true, day, title: k.name, types: k.types, species: [...Array(k.types).keys()], moves: k.moves, target: 0, stars: [0, 0, 0], collect: [], eggs: k.eggs, boss: null, goo: null, seed: h };
}
