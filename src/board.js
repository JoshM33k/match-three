// Pure match-three rules. Works on a grid (grid[row][col]) of tile objects
// that have at least `type` (>= 0 for monsters, -1 for rainbow) and
// `special` (null | 'lineH' | 'lineV' | 'bomb' | 'rainbow'). Empty cells are null.

export const RAINBOW_TYPE = -1;
export const EGG_TYPE = -2;

const isEgg = (t) => t && t.type === EGG_TYPE;

export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const key = (r, c) => r * 64 + c;

const inBounds = (grid, r, c) => r >= 0 && c >= 0 && r < grid.length && c < grid[0].length;

const matchable = (t) => t && t.type >= 0;

const same = (a, b) => matchable(a) && matchable(b) && a.type === b.type;

/**
 * Fill a new grid without any ready-made matches and with at least one move.
 * `voids` (a Set of key(r, c)) marks cells that are not part of the board.
 * makeTile receives the monster type to create.
 */
export function createGrid(rows, cols, numTypes, rng, makeTile, voids = null) {
  const T = (grid, r, c) => (grid[r] && grid[r][c] ? grid[r][c].type : -9);
  // numTypes is a count (types 0..n-1) or an explicit list of monster types
  const pick = () => (Array.isArray(numTypes) ? numTypes[Math.floor(rng() * numTypes.length)] : Math.floor(rng() * numTypes));
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push([]);
      for (let c = 0; c < cols; c++) {
        if (voids && voids.has(key(r, c))) {
          grid[r].push(null);
          continue;
        }
        let type;
        do {
          type = pick();
        } while (
          (T(grid, r, c - 1) === type && T(grid, r, c - 2) === type) ||
          (T(grid, r - 1, c) === type && T(grid, r - 2, c) === type) ||
          (T(grid, r - 1, c) === type && T(grid, r, c - 1) === type && T(grid, r - 1, c - 1) === type)
        );
        grid[r].push(makeTile(type));
      }
    }
    if (findValidMoves(grid).length > 0) return grid;
  }
  throw new Error('could not build a playable grid');
}

/** All straight runs of 3+ matching tiles. */
export function findRuns(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const runs = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      let e = c + 1;
      while (e < cols && same(grid[r][c], grid[r][e])) e++;
      if (e - c >= 3) runs.push({ dir: 'h', type: grid[r][c].type, cells: range(c, e).map((x) => [r, x]) });
      c = e;
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      let e = r + 1;
      while (e < rows && same(grid[r][c], grid[e][c])) e++;
      if (e - r >= 3) runs.push({ dir: 'v', type: grid[r][c].type, cells: range(r, e).map((y) => [y, c]) });
      r = e;
    }
  }
  return runs;
}

function range(a, b) {
  const out = [];
  for (let i = a; i < b; i++) out.push(i);
  return out;
}

/**
 * Group overlapping runs into matches and decide which special (if any)
 * each match creates and where it appears.
 * @param swapCells cells the player just moved; specials prefer to spawn there.
 */
export function findMatchGroups(grid, swapCells = []) {
  const runs = findRuns(grid);
  const parent = runs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  runs.forEach((run, i) => {
    for (const [r, c] of run.cells) {
      const k = key(r, c);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k));
      else owner.set(k, i);
    }
  });

  const byRoot = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(run);
  });

  const groups = [];
  for (const groupRuns of byRoot.values()) {
    const cellMap = new Map();
    const hits = new Map();
    for (const run of groupRuns) {
      for (const [r, c] of run.cells) {
        const k = key(r, c);
        cellMap.set(k, [r, c]);
        hits.set(k, (hits.get(k) || 0) + 1);
      }
    }
    const cells = [...cellMap.values()];
    const longest = groupRuns.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    const hasH = groupRuns.some((r) => r.dir === 'h');
    const hasV = groupRuns.some((r) => r.dir === 'v');

    let special = null;
    if (longest.cells.length >= 5) special = 'rainbow';
    else if (hasH && hasV) special = 'bomb';
    else if (longest.cells.length === 4) special = longest.dir === 'h' ? 'lineV' : 'lineH';

    let spawn = null;
    if (special) {
      const free = ([r, c]) => !grid[r][c].special;
      const swapped = swapCells.find(([r, c]) => cellMap.has(key(r, c)) && free([r, c]));
      const cross = cells.find(([r, c]) => hits.get(key(r, c)) > 1 && free([r, c]));
      const mid = longest.cells[Math.floor(longest.cells.length / 2)];
      spawn = swapped || (special === 'bomb' && cross) || (free(mid) ? mid : cells.find(free)) || null;
      if (!spawn) special = null;
    }
    groups.push({ type: longest.type, cells, special, spawn });
  }
  addSquares(grid, groups, swapCells);
  return groups;
}

/**
 * 2x2 squares of one monster make a "pal". A square touching a plain match
 * upgrades that match; one touching a match that already makes a special
 * just joins it.
 */
function addSquares(grid, groups, swapCells) {
  const owner = new Map();
  groups.forEach((g, i) => g.cells.forEach(([r, c]) => owner.set(key(r, c), i)));
  for (let r = 0; r + 1 < grid.length; r++) {
    for (let c = 0; c + 1 < grid[0].length; c++) {
      const t = grid[r][c];
      if (!matchable(t) || !same(t, grid[r][c + 1]) || !same(t, grid[r + 1][c]) || !same(t, grid[r + 1][c + 1])) continue;
      const sq = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
      const hit = sq.map(([y, x]) => owner.get(key(y, x))).find((i) => i !== undefined);
      let g = hit !== undefined ? groups[hit] : null;
      if (!g) {
        g = { type: t.type, cells: [], special: null, spawn: null };
        groups.push(g);
      }
      const idx = groups.indexOf(g);
      for (const cell of sq) {
        const k = key(cell[0], cell[1]);
        if (!owner.has(k)) {
          g.cells.push(cell);
          owner.set(k, idx);
        }
      }
      if (!g.special) {
        const free = ([y, x]) => !grid[y][x].special;
        const inSq = (cell) => sq.some(([y, x]) => y === cell[0] && x === cell[1]);
        const spawn = swapCells.find((cell) => inSq(cell) && free(cell)) || sq.find(free);
        if (spawn) {
          g.special = 'pal';
          g.spawn = spawn;
        }
      }
    }
  }
}

function matchAt(grid, r, c) {
  const t = grid[r][c];
  if (!matchable(t)) return false;
  let h = 1;
  for (let x = c - 1; x >= 0 && same(grid[r][x], t); x--) h++;
  for (let x = c + 1; x < grid[0].length && same(grid[r][x], t); x++) h++;
  if (h >= 3) return true;
  let v = 1;
  for (let y = r - 1; y >= 0 && same(grid[y][c], t); y--) v++;
  for (let y = r + 1; y < grid.length && same(grid[y][c], t); y++) v++;
  if (v >= 3) return true;
  // part of a 2x2 square?
  for (const [dr, dc] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
    const y = r + dr;
    const x = c + dc;
    if (y < 0 || x < 0 || y + 1 >= grid.length || x + 1 >= grid[0].length) continue;
    if (same(grid[y][x], t) && same(grid[y][x + 1], t) && same(grid[y + 1][x], t) && same(grid[y + 1][x + 1], t)) return true;
  }
  return false;
}

/** A swap is "special" when it fires specials directly instead of needing a match. */
export function isSpecialSwap(a, b) {
  if (!a || !b || isEgg(a) || isEgg(b)) return false;
  if (a.special === 'rainbow' || b.special === 'rainbow') return true;
  return !!(a.special && b.special);
}

export function swapCells(grid, [r1, c1], [r2, c2]) {
  const t = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = t;
}

/** Whether swapping two adjacent cells makes a legal move. */
export function isValidSwap(grid, a, b) {
  const ta = grid[a[0]][a[1]];
  const tb = grid[b[0]][b[1]];
  if (!ta || !tb || isEgg(ta) || isEgg(tb)) return false;
  if (isSpecialSwap(ta, tb)) return true;
  swapCells(grid, a, b);
  const ok = matchAt(grid, a[0], a[1]) || matchAt(grid, b[0], b[1]);
  swapCells(grid, a, b);
  return ok;
}

export function findValidMoves(grid) {
  const moves = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const b = [r + dr, c + dc];
        if (!inBounds(grid, b[0], b[1])) continue;
        if (isValidSwap(grid, [r, c], b)) moves.push({ a: [r, c], b });
      }
    }
  }
  return moves;
}

export function mostCommonType(grid, exclude = new Set()) {
  const counts = new Map();
  grid.forEach((row, r) =>
    row.forEach((t, c) => {
      if (matchable(t) && !exclude.has(key(r, c))) counts.set(t.type, (counts.get(t.type) || 0) + 1);
    })
  );
  let best = null;
  let n = -1;
  for (const [type, count] of counts) {
    if (count > n) {
      best = type;
      n = count;
    }
  }
  return best;
}

/** The effect a special tile produces when it is cleared. */
export function effectFor(special, r, c) {
  switch (special) {
    case 'lineH':
      return { kind: 'line', dir: 'h', r, c };
    case 'lineV':
      return { kind: 'line', dir: 'v', r, c };
    case 'bomb':
      return { kind: 'bomb', radius: 1, r, c };
    case 'rainbow':
      return { kind: 'color', type: null, r, c };
    case 'pal':
      return { kind: 'pal', r, c };
    default:
      return null;
  }
}

/** Effects for swapping two tiles where isSpecialSwap() is true. */
export function swapEffects(grid, a, b) {
  const ta = grid[a[0]][a[1]];
  const tb = grid[b[0]][b[1]];
  const [r, c] = b;
  if (ta.special === 'rainbow' && tb.special === 'rainbow') return [{ kind: 'all', r, c }];
  if (ta.special === 'rainbow' || tb.special === 'rainbow') {
    const [rb, other] = ta.special === 'rainbow' ? [a, tb] : [b, ta];
    return [{ kind: 'color', type: other.type, convert: other.special || null, r: rb[0], c: rb[1] }];
  }
  if (ta.special === 'pal' || tb.special === 'pal') return [effectFor(ta.special, a[0], a[1]), effectFor(tb.special, b[0], b[1])];
  const kinds = [ta.special, tb.special].map((s) => (s === 'bomb' ? 'bomb' : 'line'));
  if (kinds[0] === 'bomb' && kinds[1] === 'bomb') return [{ kind: 'bomb', radius: 2, r, c }];
  if (kinds[0] === 'line' && kinds[1] === 'line') {
    return [
      { kind: 'line', dir: 'h', r, c },
      { kind: 'line', dir: 'v', r, c },
    ];
  }
  return [{ kind: 'cross', width: 1, r, c }];
}

// Seconds between successive cells of an effect, and before chained effects.
const STEP = 0.035;
const CHAIN = 0.12;
export const PAL_FLIGHT = 0.4;

let palTarget = null;

/** Pick where a pal flies: any monster not already being cleared, far away. */
function defaultPalTarget(grid, cleared, e) {
  let best = null;
  let bestD = -1;
  grid.forEach((row, r) =>
    row.forEach((t, c) => {
      if (!t || cleared.has(key(r, c)) || Math.abs(r - e.r) + Math.abs(c - e.c) <= 1) return;
      const d = ((r * 7 + c * 13 + e.r * 3 + e.c * 5) % 17) + (t.special ? 20 : 0);
      if (d > bestD) {
        bestD = d;
        best = [r, c];
      }
    })
  );
  return best;
}

/** Cells an effect hits, each with its distance-based delay offset. */
function effectCells(grid, e, cleared) {
  const rows = grid.length;
  const cols = grid[0].length;
  const out = [];
  const add = (r, c, d) => {
    if (inBounds(grid, r, c) && grid[r][c]) out.push([r, c, d]);
  };
  switch (e.kind) {
    case 'line':
      if (e.dir === 'h') for (let c = 0; c < cols; c++) add(e.r, c, Math.abs(c - e.c) * STEP);
      else for (let r = 0; r < rows; r++) add(r, e.c, Math.abs(r - e.r) * STEP);
      break;
    case 'cross':
      for (let w = -e.width; w <= e.width; w++) {
        for (let c = 0; c < cols; c++) add(e.r + w, c, Math.abs(c - e.c) * STEP);
        for (let r = 0; r < rows; r++) add(r, e.c + w, Math.abs(r - e.r) * STEP);
      }
      break;
    case 'bomb':
      for (let r = e.r - e.radius; r <= e.r + e.radius; r++) {
        for (let c = e.c - e.radius; c <= e.c + e.radius; c++) {
          add(r, c, Math.max(Math.abs(r - e.r), Math.abs(c - e.c)) * STEP);
        }
      }
      break;
    case 'color': {
      if (e.type == null) e.type = mostCommonType(grid, cleared);
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const t = grid[r][c];
          if (t && t.type === e.type && e.type != null) add(r, c, ++i * STEP);
        }
      }
      add(e.r, e.c, 0);
      break;
    }
    case 'pal': {
      // clear the pal's neighbours, then fly off to one target
      for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) add(e.r + dr, e.c + dc, 0);
      if (!e.target) e.target = (palTarget || defaultPalTarget)(grid, cleared, e);
      if (e.target) add(e.target[0], e.target[1], PAL_FLIGHT);
      break;
    }
    case 'all':
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) add(r, c, (Math.abs(r - e.r) + Math.abs(c - e.c)) * STEP);
      }
      break;
  }
  return out;
}

/**
 * Work out everything that gets cleared, following chains of specials.
 * @param seeds      [[r, c], ...] cleared immediately
 * @param effects    effects that start immediately
 * @param opts.protect  keys of cells that must survive (fresh specials)
 * @param opts.consumed keys of specials whose own effect should not fire
 * @returns {{cleared: Map<number,{r,c,delay}>, effects: object[]}}
 *   Each effect gets a `delay` (seconds) for staging the animation.
 */
export function expandClears(grid, seeds, effects = [], opts = {}) {
  palTarget = opts.palTarget || null;
  const protect = opts.protect || new Set();
  const consumed = new Set(opts.consumed || []);
  const cleared = new Map();
  const fired = [];
  const queue = effects.map((e) => ({ ...e, delay: e.delay || 0 }));

  const clear = (r, c, delay) => {
    const k = key(r, c);
    if (protect.has(k)) return;
    const prev = cleared.get(k);
    if (prev) {
      prev.delay = Math.min(prev.delay, delay);
      return;
    }
    cleared.set(k, { r, c, delay });
    const t = grid[r][c];
    if (t && t.special && !consumed.has(k)) {
      consumed.add(k);
      const e = effectFor(t.special, r, c);
      if (e) queue.push({ ...e, delay: delay + CHAIN });
    }
  };

  for (const [r, c] of seeds) clear(r, c, 0);
  while (queue.length) {
    queue.sort((a, b) => a.delay - b.delay);
    const e = queue.shift();
    fired.push(e);
    const exclude = new Set(cleared.keys());
    for (const [r, c, d] of effectCells(grid, e, exclude)) {
      if (e.convert && !grid[r][c].special && !consumed.has(key(r, c)) && !protect.has(key(r, c))) {
        const kind = e.convert === 'bomb' || e.convert === 'pal' ? e.convert : (r + c) % 2 ? 'lineH' : 'lineV';
        const conv = effectFor(kind, r, c);
        consumed.add(key(r, c));
        queue.push({ ...conv, delay: e.delay + d + CHAIN });
      }
      clear(r, c, e.delay + d);
    }
  }
  return { cleared, effects: fired };
}

/**
 * Drop tiles into gaps and create new tiles above the board.
 * Mutates grid. Returns every tile that needs to move with its start row
 * (negative rows are above the board).
 */
export function applyGravity(grid, makeTile, voids = null) {
  const rows = grid.length;
  const cols = grid[0].length;
  const moves = [];
  for (let c = 0; c < cols; c++) {
    // the playable cells of this column, bottom to top (tiles fall past voids)
    const cells = [];
    for (let r = rows - 1; r >= 0; r--) if (!voids || !voids.has(key(r, c))) cells.push(r);
    let w = 0;
    for (const r of cells) {
      const t = grid[r][c];
      if (!t) continue;
      const to = cells[w++];
      if (to !== r) {
        grid[to][c] = t;
        grid[r][c] = null;
        moves.push({ tile: t, r: to, c, fromR: r });
      }
    }
    for (let i = w; i < cells.length; i++) {
      const r = cells[i];
      const t = makeTile();
      grid[r][c] = t;
      moves.push({ tile: t, r, c, fromR: -(i - w) - 1, spawned: true });
    }
  }
  return moves;
}

/** Rearrange tiles so there are no matches and at least one move. */
export function shuffleGrid(grid, rng) {
  const cells = [];
  const tiles = [];
  grid.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t) {
        cells.push([r, c]);
        tiles.push(t);
      }
    })
  );
  for (let attempt = 0; attempt < 500; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    cells.forEach(([r, c], i) => (grid[r][c] = tiles[i]));
    if (findMatchGroups(grid).length === 0 && findValidMoves(grid).length > 0) return true;
  }
  return false;
}
