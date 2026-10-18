// The playing field: board state machine, monster animation, effects, HUD
// and the level overlays.
import {
  makeRng,
  createGrid,
  findMatchGroups,
  findValidMoves,
  isSpecialSwap,
  swapCells,
  swapEffects,
  expandClears,
  applyGravity,
  shuffleGrid,
  key,
} from './board.js';
import { getSprite, monsterColor, monsterLight, RAINBOW_COLORS, RAINBOW_FRAMES, EGG_TYPE, GOO_TYPE, MONSTERS } from './sprites.js';
import { drawText, panel, roundRect, iconOutlined, Button, pixelLine, pixelCircle, textWidth, wrapText, pattern, HAND } from './pixel.js';
import { getLevel, getZenLevel, getDailyLevel, voidsOf, ROWS, COLS } from './levels.js';
import { WORLDS, worldFor } from './background.js';
import { drawHat } from './hats.js';

const POP_GROW = 0.1;
const POP_TIME = 0.3;
const SWAP_TIME = 0.16;
const GRAVITY = 75; // cells / s^2
const MAX_FALL = 18;

const CROWN = ['#.#.#', '#####', '#####'];

const PRAISE = ['YUM!', 'CHOMP!', 'RAWR!', 'MUNCH!', 'MONSTROUS!', 'GOBBLED!', 'SPOOKTACULAR!'];
const WIN_WORDS = ['YUMMY!', 'DELICIOUS!', 'MONSTROUS!', 'RAWRSOME!'];
const TIPS = ['SWIPE TO SWAP!', 'MATCH 4 FOR A BLASTER', 'L OR T MAKES A BOMB', 'MATCH 5 FOR A RAINBOW', 'SWAP TWO SPECIALS!', 'A SQUARE MAKES A PAL'];

// How long each species' idle quirk lasts (seconds), by monster type.
const QUIRK_TIME = [0.6, 0.9, 0.7, 0.4, 1.1, 0.6];

// Shown once, the first time a player meets each thing.
const NEW_THINGS = {
  line: { title: 'BLASTER!', text: 'MATCHING 4 MADE A BLASTER. MATCH IT OR SWAP IT TO CLEAR A WHOLE LINE!' },
  bomb: { title: 'BOMB!', text: 'L AND T SHAPES MAKE BOMBS. THEY BLAST EVERY MONSTER AROUND THEM!' },
  pal: { title: 'MONSTER PAL!', text: 'A 2X2 SQUARE MADE A PAL. SET IT OFF AND IT FLIES AWAY TO HELP WITH YOUR GOALS!' },
  rainbow: { title: 'RAINBOW!', text: 'MATCHING 5 MADE A RAINBOW. SWAP IT WITH ANY MONSTER TO POP EVERY ONE OF THAT KIND!' },
  goo: { title: 'GOO!', text: 'POP MONSTERS ON TOP OF THE STICKY PINK GOO TO CLEAN IT ALL UP.' },
  egg: { title: 'EGGS!', text: "EGGS CAN'T MOVE. MATCH NEXT TO THEM TO CRACK THEM. TWO HITS AND OUT POPS A BABY!" },
};

let nextId = 1;

class Tile {
  constructor(type, special = null) {
    this.id = nextId++;
    this.type = type;
    this.special = special;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.falling = false;
    this.fallDelay = 0;
    this.targetY = 0;
    this.squash = 0;
    this.squashV = 0;
    this.hop = 0;
    this.hopV = 0;
    this.expr = null;
    this.exprT = 0;
    this.blinkT = 1 + Math.random() * 5;
    this.blink = 0;
    this.glanceT = Math.random() * 4;
    this.glanceX = 0;
    this.glanceY = 0;
    this.move = null;
    this.pop = null;
    this.shake = 0;
    this.sleepy = false;
    this.zT = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.quirkT = 2 + Math.random() * 6;
    this.quirk = 0;
    this.quirkSide = 1;
  }

  say(expr, t) {
    this.expr = expr;
    this.exprT = t;
  }

  jump(v = -70) {
    if (this.hop === 0 && this.hopV === 0) this.hopV = v;
  }

  tweenTo(x, y, dur, arc = 0) {
    this.move = { fx: this.x, fy: this.y, tx: x, ty: y, t: 0, dur, arc };
  }
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Game {
  constructor(app) {
    this.app = app;
    this.time = 0;
  }

  get audio() {
    return this.app.audio;
  }

  get stats() {
    const s = this.app.settings;
    s.stats = s.stats || { popped: {}, hatched: 0, bosses: 0, bestCombo: 0 };
    return s.stats;
  }

  start(levelNum) {
    this.levelId = levelNum;
    this.level = levelNum === 'zen' ? getZenLevel() : levelNum === 'daily' ? getDailyLevel() : getLevel(levelNum);
    this.zen = !!this.level.zen;
    this.daily = !!this.level.daily;
    this.milestone = 5000;
    this.usedExtra = false;
    this.rng = makeRng(this.level.seed);
    this.score = 0;
    this.shownScore = 0;
    this.moves = this.level.moves;
    this.goals = this.level.collect.map((g) => ({ ...g, left: g.count, shown: g.count, bump: 0 }));
    this.voids = voidsOf(this.level.shape);
    this.grid = createGrid(ROWS, COLS, this.level.types, this.rng, (t) => new Tile(t), this.voids);
    this.placeEggs(this.level.eggs || 0);
    this.goo = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    for (const [r, c] of this.level.goo || []) this.goo[r][c] = 1;
    this.particles = [];
    this.texts = [];
    this.effects = [];
    this.flyers = [];
    this.combo = 0;
    this.selected = null;
    this.drag = null;
    this.hint = null;
    this.idleT = 0;
    this.bonus = false;
    this.shakeT = 0;
    this.lastSwap = null;
    this.tipT = 0;
    this.tip = this.level.n === 1 ? 0 : 1 + (this.level.n % (TIPS.length - 1));
    const b = this.level.boss;
    this.boss = b
      ? { type: b.type, hp: b.hp, max: b.hp, shown: b.hp, attackIn: 4, hitT: 0, roarT: 0, deadT: 0, name: 'KING ' + MONSTERS[b.type].name.toUpperCase() }
      : null;
    this.zings = [];
    this.moveDone = false;
    this.audio.setFlavor(worldFor(this.level.n || 1));
    this.audio.setSong(this.boss ? 'boss' : 'game');
    this.layout();

    // Monsters tumble in from the top, column by column.
    this.eachTile((t, r, c) => {
      t.x = c;
      t.y = r - ROWS - 1;
      t.targetY = r;
      t.falling = true;
      t.vy = 0;
      t.fallDelay = 0.25 + c * 0.04 + (ROWS - r) * 0.02;
    });
    this.state = 'fall';
    this.overlay = { kind: 'intro', t: 0 };
    this.pendingTip = null;
    if (this.level.eggs) this.introduce('egg', { type: EGG_TYPE, special: null, hp: 1 }, 0.3);
    if (this.level.goo) this.introduce('goo', { type: GOO_TYPE, special: null }, 0.3);
    this.setButtons();
  }

  /** Where a monster pal flies: whatever helps the goals most. */
  palTarget(grid, cleared, e) {
    const options = [[], [], [], []];
    grid.forEach((row, r) =>
      row.forEach((t, c) => {
        if (!t || cleared.has(key(r, c)) || (Math.abs(r - e.r) + Math.abs(c - e.c) <= 1)) return;
        if (this.goo[r][c]) options[0].push([r, c]);
        else if (t.type === EGG_TYPE) options[1].push([r, c]);
        else if (this.goals.some((g) => g.type === t.type && g.left > 0)) options[2].push([r, c]);
        else options[3].push([r, c]);
      })
    );
    const list = options.find((o) => o.length);
    return list ? list[Math.floor(Math.random() * list.length)] : null;
  }

  /** Queue a one-time explainer for something new (if never seen). */
  introduce(kind, tile, wait = 0.7) {
    const seen = this.app.settings.seen;
    if (seen[kind] || this.pendingTip) return;
    seen[kind] = true;
    this.app.persist();
    this.pendingTip = { kind: 'tip', t: 0, wait, what: kind, tile: { type: tile.type, special: tile.special, hp: tile.hp }, ...NEW_THINGS[kind] };
  }

  /** Swap some monsters for eggs while keeping the board playable. */
  placeEggs(n) {
    if (!n) return;
    for (let attempt = 0; attempt < 50; attempt++) {
      const placed = [];
      while (placed.length < n) {
        const r = Math.floor(this.rng() * Math.min(ROWS, 6));
        const c = Math.floor(this.rng() * COLS);
        if (placed.some(([pr, pc]) => pr === r && pc === c) || !this.grid[r][c]) continue;
        placed.push([r, c, this.grid[r][c]]);
        const egg = new Tile(EGG_TYPE);
        egg.hp = 2;
        this.grid[r][c] = egg;
      }
      if (findValidMoves(this.grid).length >= 3) return;
      for (const [r, c, t] of placed) this.grid[r][c] = t;
    }
  }

  eachTile(fn) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c]) fn(this.grid[r][c], r, c);
  }

  // ---------------------------------------------------------------- layout

  layout() {
    const { vw, vh, safeTop, safeBottom } = this.app;
    const top = safeTop + 3;
    const bottom = safeBottom + 3;
    const hudH = this.boss ? 60 : 46;
    const barH = 18;
    const gap = 6;
    let cell = Math.floor((Math.min(vw, 250) - 10) / COLS);
    cell = Math.min(cell, Math.floor((vh - top - bottom - hudH - barH - gap * 2 - 6) / ROWS));
    cell = Math.max(16, Math.min(24, cell));
    this.cell = cell;
    this.bw = cell * COLS;
    this.bh = cell * ROWS;
    const total = hudH + gap + this.bh + 6 + gap + barH;
    const y0 = Math.max(top, Math.floor((vh - total) / 2));
    this.boardX = Math.floor((vw - this.bw) / 2);
    this.hudY = y0;
    this.boardY = y0 + hudH + gap + 3;
    this.barY = Math.min(vh - bottom - barH, this.boardY + this.bh + 3 + gap);
    this.setButtons();
  }

  setButtons() {
    if (!this.level) return;
    const x = this.boardX - 3;
    const w = this.bw + 6;
    const y = this.barY;
    const a = this.app;
    this.barButtons = [
      new Button({ icon: 'pause', x, y, w: 20, h: 17, color: '#a47bff', shade: '#6a44b8', onClick: () => this.pause() }),
      new Button({
        icon: 'music',
        x: x + w - 42,
        y,
        w: 20,
        h: 17,
        color: a.settings.music ? '#6cc4ff' : '#7a6a90',
        shade: a.settings.music ? '#3f80c0' : '#4a3a60',
        onClick: () => {
          a.toggleMusic();
          this.setButtons();
        },
      }),
      new Button({
        icon: 'sound',
        x: x + w - 20,
        y,
        w: 20,
        h: 17,
        color: a.settings.sfx ? '#74e06b' : '#7a6a90',
        shade: a.settings.sfx ? '#3f9e4f' : '#4a3a60',
        onClick: () => {
          a.toggleSfx();
          this.setButtons();
        },
      }),
    ];
    this.overlayButtons = this.makeOverlayButtons();
  }

  makeOverlayButtons() {
    const o = this.overlay;
    if (!o || o.kind === 'intro') return [];
    const cx = Math.floor(this.app.vw / 2);
    const by = this.boardY + Math.floor(this.bh / 2) + 22;
    const a = this.app;
    const btn = (label, ic, yy, color, shade, onClick, w = 76) =>
      new Button({ label, icon: ic, x: cx - Math.floor(w / 2), y: yy, w, h: 18, color, shade, onClick });
    if (o.kind === 'win') {
      return [
        btn('NEXT', 'play', by + 6, '#74e06b', '#3f9e4f', () =>
          a.transition(() => {
            a.setWorld(this.level.n + 1);
            this.start(this.level.n + 1);
          })
        ),
        btn('MAP', 'map', by + 28, '#a47bff', '#6a44b8', () => a.toMap(this.level.n + (o.kind === 'win' ? 1 : 0))),
      ];
    }
    if (o.kind === 'daily') {
      return [
        btn('AGAIN', 'retry', by + 6, '#ffa040', '#c06a20', () => a.transition(() => this.start('daily'))),
        btn('MENU', 'home', by + 28, '#a47bff', '#6a44b8', () => a.toTitle()),
      ];
    }
    if (o.kind === 'lose') {
      const y0 = this.boardY + Math.floor(this.bh / 2) - 2;
      const list = [];
      if (!this.usedExtra) list.push(btn('+5 MOVES', 'heart', y0, '#74e06b', '#3f9e4f', () => this.extraMoves()));
      list.push(btn('RETRY', 'retry', y0 + list.length * 22, '#ff7eb6', '#c2407e', () => a.transition(() => this.start(this.levelId))));
      list.push(btn('MAP', 'map', y0 + list.length * 22, '#a47bff', '#6a44b8', () => a.toMap(this.level.n)));
      return list;
    }
    if (o.kind === 'pause') {
      const y0 = this.boardY + 44;
      return [
        btn('RESUME', 'play', y0, '#74e06b', '#3f9e4f', () => this.resume()),
        btn('RESTART', 'retry', y0 + 22, '#ffa040', '#c06a20', () => a.transition(() => this.start(this.levelId))),
        btn(a.settings.music ? 'MUSIC ON' : 'MUSIC OFF', 'music', y0 + 44, '#6cc4ff', '#3f80c0', () => {
          a.toggleMusic();
          this.setButtons();
        }),
        btn(a.settings.sfx ? 'SOUND ON' : 'SOUND OFF', 'sound', y0 + 66, '#6cc4ff', '#3f80c0', () => {
          a.toggleSfx();
          this.setButtons();
        }),
        this.zen || this.daily
          ? btn('MENU', 'home', y0 + 88, '#a47bff', '#6a44b8', () => a.toTitle())
          : btn('MAP', 'map', y0 + 88, '#a47bff', '#6a44b8', () => a.toMap(this.level.n)),
      ];
    }
    return [];
  }

  pause() {
    if (this.overlay) return;
    this.app.persist();
    this.overlay = { kind: 'pause', t: 0 };
    this.setButtons();
  }

  resume() {
    this.overlay = null;
    this.setButtons();
  }

  // ----------------------------------------------------------------- input

  cellAt(x, y) {
    const c = Math.floor((x - this.boardX) / this.cell);
    const r = Math.floor((y - this.boardY) / this.cell);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    return [r, c];
  }

  buttons() {
    if (this.overlay && this.overlay.kind !== 'intro') return this.overlayButtons;
    return this.barButtons;
  }

  pointerDown(x, y) {
    for (const b of this.buttons()) {
      if (b.hit(x, y)) {
        b.pressed = true;
        return;
      }
    }
    if (this.overlay) {
      if (this.overlay.kind === 'intro' && this.overlay.t > 0.3) this.overlay.t = Math.max(this.overlay.t, 2.2);
      if (this.overlay.kind === 'tip' && this.overlay.t > 0.5) {
        this.overlay = null;
        this.setButtons();
      }
      return;
    }
    this.wake();
    if (this.state !== 'idle') return;
    const cell = this.cellAt(x, y);
    if (!cell || !this.grid[cell[0]][cell[1]]) {
      this.selected = null;
      return;
    }
    this.tickle(cell);
    const sel = this.selected;
    if (sel && Math.abs(sel[0] - cell[0]) + Math.abs(sel[1] - cell[1]) === 1) {
      this.trySwap(sel, cell);
      return;
    }
    if (sel && sel[0] === cell[0] && sel[1] === cell[1]) {
      this.drag = { cell, x, y, wasSelected: true };
      return;
    }
    const t = this.grid[cell[0]][cell[1]];
    if (t.type === EGG_TYPE || t.stuck) {
      this.wobbleEgg(t);
      this.selected = null;
      return;
    }
    this.selected = cell;
    t.jump(-85);
    this.audio.monster(t.type, 'select');
    this.drag = { cell, x, y };
  }

  /** Tapping the same monster quickly tickles it. */
  tickle(cell) {
    const k = key(...cell);
    const now = this.time;
    const tk = this.tickles;
    if (!tk || tk.k !== k || now - tk.t > 0.6) {
      this.tickles = { k, t: now, n: 1 };
      return;
    }
    tk.t = now;
    tk.n++;
    const t = this.grid[cell[0]][cell[1]];
    if (!t || t.type < 0) return;
    if (tk.n === 3) {
      t.say('laugh', 0.9);
      t.jump(-100);
      this.audio.monster(t.type, 'match', 1.35);
      const { x, y } = this.tileScreen(t);
      for (let i = 0; i < 3; i++) {
        this.particles.push({ x: x + (i - 1) * 5, y: y - 6, vx: (i - 1) * 8, vy: -20 - i * 4, life: 0, max: 0.9, color: monsterColor(t.type), grav: 0, kind: 'heart', ph: i });
      }
    } else if (tk.n >= 6) {
      t.say('dizzy', 1.2);
      t.shake = 0.5;
      this.audio.monster(t.type, 'sad', 0.9);
      tk.n = 0;
    }
  }

  pointerMove(x, y) {
    const d = this.drag;
    if (!d || this.state !== 'idle') return;
    const dx = x - d.x;
    const dy = y - d.y;
    const [r, c] = d.cell;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cell * 0.4) {
      // lean toward the finger; the neighbour in the way looks worried
      const horiz = Math.abs(dx) > Math.abs(dy);
      const lim = this.cell * 0.25;
      d.lean = horiz ? [Math.max(-lim, Math.min(lim, dx * 0.6)), 0] : [0, Math.max(-lim, Math.min(lim, dy * 0.6))];
      const n = horiz ? this.grid[r] && this.grid[r][c + Math.sign(dx)] : this.grid[r + Math.sign(dy)] && this.grid[r + Math.sign(dy)][c];
      if (n && Math.max(Math.abs(dx), Math.abs(dy)) > 3 && n.exprT <= 0.05) n.say('surprised', 0.25);
      return;
    }
    const target = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    this.drag = null;
    if (target[0] < 0 || target[1] < 0 || target[0] >= ROWS || target[1] >= COLS) {
      this.grid[r][c].shake = 0.25;
      return;
    }
    this.trySwap(d.cell, target);
  }

  pointerUp(x, y) {
    for (const b of this.buttons()) {
      if (b.pressed) {
        b.pressed = false;
        if (b.hit(x, y)) {
          this.audio.click();
          b.onClick();
          return;
        }
      }
    }
    if (this.drag && this.drag.wasSelected) this.selected = null;
    this.drag = null;
  }

  wake() {
    this.idleT = 0;
    this.hint = null;
    this.eachTile((t) => {
      t.sleepAt = 0;
      if (t.sleepy) {
        t.sleepy = false;
        t.say('surprised', 0.35);
        t.jump(-60);
      }
    });
  }

  // ------------------------------------------------------------- game flow

  wobbleEgg(t) {
    t.shake = 0.4;
    t.jump(-40);
    this.audio.tok();
  }

  trySwap(a, b) {
    if (this.state !== 'idle') return;
    const ta = this.grid[a[0]][a[1]];
    const tb = this.grid[b[0]][b[1]];
    if (!ta || !tb) return;
    this.selected = null;
    this.drag = null;
    this.hint = null;
    if (ta.type === EGG_TYPE || tb.type === EGG_TYPE || ta.stuck || tb.stuck) {
      for (const t of [ta, tb]) {
        if (t.type === EGG_TYPE || t.stuck) this.wobbleEgg(t);
        else t.say('sad', 0.6);
      }
      return;
    }
    swapCells(this.grid, a, b);
    ta.tweenTo(b[1], b[0], SWAP_TIME, 6);
    tb.tweenTo(a[1], a[0], SWAP_TIME, -2);
    ta.say('excited', 0.4);
    tb.say('surprised', 0.4);
    this.audio.swap();
    this.lastSwap = { a, b };
    this.state = 'swap';
  }

  finishSwap() {
    const { a, b } = this.lastSwap;
    const ta = this.grid[a[0]][a[1]];
    const tb = this.grid[b[0]][b[1]];
    if (isSpecialSwap(ta, tb)) {
      if (!this.zen) this.moves--;
      this.moveDone = true;
      this.combo = 1;
      const effects = swapEffects(this.grid, a, b);
      const rainbow = ta.special === 'rainbow' || tb.special === 'rainbow';
      const consumed = [a, b].filter(([r, c]) => !rainbow || this.grid[r][c].special === 'rainbow').map(([r, c]) => key(r, c));
      this.audio.monster(tb.type, 'match');
      this.clear([], effects, [a, b], consumed);
      this.lastSwap = null;
      return;
    }
    const groups = findMatchGroups(this.grid, [a, b]);
    this.lastSwap = null;
    if (!groups.length) {
      swapCells(this.grid, a, b);
      ta.tweenTo(b[1], b[0], SWAP_TIME);
      tb.tweenTo(a[1], a[0], SWAP_TIME);
      ta.say('sad', 0.9);
      tb.say('sad', 0.9);
      ta.shake = 0.35;
      tb.shake = 0.35;
      this.audio.monster(tb.type, 'sad');
      this.state = 'unswap';
      return;
    }
    if (!this.zen) this.moves--;
    this.moveDone = true;
    this.combo = 1;
    this.clear(groups);
  }

  afterSettle() {
    const groups = findMatchGroups(this.grid);
    if (groups.length) {
      this.combo++;
      this.clear(groups);
      return;
    }
    if (this.combo >= 3) {
      const word = PRAISE[Math.min(PRAISE.length - 1, this.combo - 3 + Math.floor(Math.random() * 2))];
      this.bigText(word, this.combo >= 5 ? '#ffe04a' : '#ffffff');
    }
    this.combo = 0;
    if (this.bonus) {
      const specials = this.specialCells();
      if (specials.length) {
        this.combo = 1;
        this.clear([], [], specials, []);
      } else {
        this.showWin();
      }
      return;
    }
    if (this.goalsMet()) {
      this.startBonus();
      return;
    }
    if (this.moves <= 0 && this.daily) {
      this.showDailyEnd();
      return;
    }
    if (this.moves <= 0 && !this.zen) {
      this.showLose();
      return;
    }
    if (this.moveDone) {
      this.eachTile((t) => {
        if (t.stuck > 0) t.stuck--;
      });
      if (!this.boss || this.boss.hp <= 0) this.moveDone = false;
    }
    if (this.boss && this.boss.hp > 0 && this.moveDone) {
      this.moveDone = false;
      if (--this.boss.attackIn <= 0) {
        this.bossAttack();
        return;
      }
    }
    if (!findValidMoves(this.grid).length) {
      this.doShuffle();
      return;
    }
    this.state = 'idle';
    this.idleT = 0;
    this.app.checkStickers();
  }

  specialCells() {
    const out = [];
    this.eachTile((t, r, c) => {
      if (t.special) out.push([r, c]);
    });
    return out;
  }

  goalsMet() {
    if (this.zen || this.daily) return false;
    if (this.boss && this.boss.hp > 0) return false;
    return this.score >= this.level.target && this.goals.every((g) => g.left <= 0);
  }

  /** Start clearing: matched groups, effects and seed cells. */
  clear(groups, effects = [], seeds = [], consumed = []) {
    const grid = this.grid;
    const protect = new Set();
    const spawns = groups.filter((g) => g.special && g.spawn);
    for (const g of spawns) protect.add(key(...g.spawn));
    const seedCells = [...seeds, ...groups.flatMap((g) => g.cells)];
    const res = expandClears(grid, seedCells, effects, { protect, consumed, palTarget: (g, cl, e) => this.palTarget(g, cl, e) });

    // Eggs never pop: anything that hits them, or a match right next to
    // them, cracks them instead.
    const eggHits = new Map();
    for (const [k, cell] of res.cleared) {
      if (grid[cell.r][cell.c].type === EGG_TYPE) {
        eggHits.set(k, cell);
        res.cleared.delete(k);
      }
    }
    for (const g of groups) {
      for (const [r, c] of g.cells) {
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const t = grid[r + dr] && grid[r + dr][c + dc];
          const k = key(r + dr, c + dc);
          if (t && t.type === EGG_TYPE && !eggHits.has(k)) eggHits.set(k, { r: r + dr, c: c + dc, delay: 0.05 });
        }
      }
    }
    for (const { r, c, delay } of eggHits.values()) grid[r][c].crack = -delay - 0.05;

    const mergeTo = new Map();
    for (const g of spawns) {
      for (const [r, c] of g.cells) if (r !== g.spawn[0] || c !== g.spawn[1]) mergeTo.set(key(r, c), g.spawn);
    }

    const combo = Math.max(1, this.combo);
    const pitch = 1 + (combo - 1) * 0.07;
    let maxDelay = 0;
    let points = 0;
    let bigBlast = false;
    for (const e of res.effects) if (e.kind === 'bomb' || e.kind === 'all' || e.kind === 'color') bigBlast = true;

    for (const { r, c, delay } of res.cleared.values()) {
      const t = grid[r][c];
      if (!t) continue;
      const m = mergeTo.get(key(r, c));
      t.pop = { t: -delay, merge: m && delay === 0 ? { x: m[1], y: m[0] } : null, burst: false };
      maxDelay = Math.max(maxDelay, delay);
      points += 20 * combo;
      if (t.type >= 0) this.stats.popped[t.type] = (this.stats.popped[t.type] || 0) + 1;
      if (this.goo[r][c]) {
        this.goo[r][c] = 0;
        const gg = this.goals.find((g) => g.type === GOO_TYPE);
        if (gg) {
          gg.left--;
          this.flyers.push({ goal: gg, type: GOO_TYPE, sx: c, sy: r, t: -delay, dur: 0.5 });
        }
        this.burst(c, r, '#ff6fb4', 5);
      }
      const goal = this.goals.find((g) => g.type === t.type && g.left > 0);
      if (goal) {
        goal.left--;
        this.flyers.push({ goal, type: t.type, sx: t.x, sy: t.y, t: -delay - 0.12, dur: 0.6 });
      }
      // neighbours react to the commotion
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const n = grid[r + dr] && grid[r + dr][c + dc];
          if (!n || res.cleared.has(key(r + dr, c + dc))) continue;
          if (bigBlast) n.say('dizzy', 0.9 + delay);
          else {
            n.say('happy', 0.55);
            n.jump(-55 - Math.random() * 30);
          }
        }
      }
    }

    if (this.boss && this.boss.hp > 0) {
      for (const { r, c, delay } of res.cleared.values()) {
        const t = grid[r][c];
        if (t) this.hitBoss(1, t.x, t.y, monsterColor(t.type), delay + POP_GROW);
      }
    }

    // Voices: one per distinct monster in the matched groups.
    const voiced = new Set();
    groups.forEach((g) => {
      if (voiced.size < 3 && !voiced.has(g.type)) {
        this.audio.monster(g.type, 'match', pitch, voiced.size * 0.06);
        voiced.add(g.type);
      }
    });

    for (const g of spawns) {
      points += { lineH: 60, lineV: 60, bomb: 100, rainbow: 200, pal: 80 }[g.special] || 0;
    }

    for (const e of res.effects) {
      const fx = { ...e, t: -e.delay, started: false };
      if (e.kind === 'pal') {
        const src = grid[e.r][e.c];
        fx.type = src ? src.type : 0;
      }
      if (e.kind === 'color') {
        fx.targets = [...res.cleared.values()].filter(({ r, c }) => grid[r][c].type === e.type || (r === e.r && c === e.c));
      }
      this.effects.push(fx);
      if (e.kind === 'pal') this.audio.monster(fx.type, 'whee', 1.2, e.delay);
      else if (e.kind === 'line' || e.kind === 'cross') this.audio.zap(e.delay);
      else if (e.kind === 'bomb') this.audio.boom(e.delay);
      else if (e.kind === 'color') this.audio.sparkle(pitch, e.delay);
      else if (e.kind === 'all') {
        this.audio.boom(e.delay);
        this.audio.sparkle(1, e.delay + 0.1);
      }
    }

    // Score popup at the middle of the action.
    const cells = [...res.cleared.values()];
    if (cells.length) {
      const cx = cells.reduce((s, p) => s + p.c, 0) / cells.length;
      const cy = cells.reduce((s, p) => s + p.r, 0) / cells.length;
      this.score += points;
      if (this.zen) this.app.settings.zenBest = Math.max(this.app.settings.zenBest || 0, this.score);
      this.texts.push({
        text: '+' + points,
        x: this.boardX + (cx + 0.5) * this.cell,
        y: this.boardY + (cy + 0.5) * this.cell,
        t: 0,
        dur: 0.9,
        color: combo >= 3 ? '#ffe04a' : '#ffffff',
        scale: points >= 300 ? 2 : 1,
      });
    }
    if (combo > this.stats.bestCombo) this.stats.bestCombo = combo;
    if (combo === 3 || combo === 5) {
      // the whole board cheers in a wave
      this.eachTile((t, r, c) => {
        if (!res.cleared.has(key(r, c))) t.jumpT = 0.05 + c * 0.04 + Math.random() * 0.05;
      });
    }
    if (combo >= 2) {
      this.audio.combo(combo);
      this.texts.push({
        text: 'COMBO X' + combo,
        x: this.boardX + this.bw / 2,
        y: this.boardY + this.bh / 2 - 20,
        t: 0,
        dur: 0.9,
        color: '#ffa9c6',
        scale: 2,
      });
      this.app.buzz(12);
    }

    this.pending = { cleared: res.cleared, spawns };
    this.popT = 0;
    this.popDur = maxDelay + POP_TIME + 0.02;
    this.state = 'pop';
  }

  finishPop() {
    const grid = this.grid;
    for (const { r, c } of this.pending.cleared.values()) grid[r][c] = null;
    for (const g of this.pending.spawns) {
      const [r, c] = g.spawn;
      const t = grid[r][c];
      if (!t) continue;
      t.special = g.special;
      if (g.special === 'rainbow') t.type = -1;
      t.say('excited', 0.8);
      t.squash = -0.35;
      t.squashV = 0;
      t.jump(-90);
      this.burst(t.x, t.y, '#ffffff', 10, true);
      this.effects.push({ kind: 'ring', r, c, t: 0, color: '#ffffff' });
      this.audio.special(1 + this.combo * 0.05);
      this.app.buzz(18);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const n = grid[r + dr] && grid[r + dr][c + dc];
        if (n && n.type >= 0 && !n.special) n.say('love', 0.9);
      }
      const kind = g.special === 'lineH' || g.special === 'lineV' ? 'line' : g.special;
      this.stats.made = this.stats.made || {};
      this.stats.made[kind] = (this.stats.made[kind] || 0) + 1;
      this.introduce(g.special === 'lineH' || g.special === 'lineV' ? 'line' : g.special, t);
    }
    this.pending = null;
    const moves = applyGravity(grid, () => new Tile(Math.floor(this.rng() * this.level.types)), this.voids);
    const dropped = moves.filter((m) => m.spawned);
    if (dropped.length >= 6 && this.audio.throttle('whee', 1.5)) {
      const t = dropped[Math.floor(Math.random() * dropped.length)].tile;
      this.audio.monster(t.type, 'whee', 1, 0.05);
    }
    for (const m of moves) {
      const t = m.tile;
      t.x = m.c;
      if (m.spawned) t.y = m.fromR;
      t.targetY = m.r;
      t.falling = true;
      t.vy = 0;
      t.fallDelay = m.c * 0.012;
    }
    this.state = 'fall';
  }

  doShuffle() {
    if (!shuffleGrid(this.grid, this.rng)) {
      // practically impossible, but keep the game going: reroll every monster
      this.eachTile((t) => {
        t.type = Math.floor(this.rng() * this.level.types);
        t.special = null;
      });
      if (!shuffleGrid(this.grid, this.rng)) {
        this.start(this.levelId);
        return;
      }
    }
    this.eachTile((t, r, c) => {
      t.tweenTo(c, r, 0.55);
      t.say('dizzy', 0.9);
    });
    this.bigText('SHUFFLE!', '#6cc4ff');
    this.audio.shuffle();
    this.state = 'shuffle';
  }

  startBonus() {
    this.bonus = true;
    this.state = 'bonus';
    this.bonusT = 0.9;
    this.bigText('MONSTER PARTY!', '#ffe04a');
    this.audio.win();
    this.eachTile((t) => {
      t.say('happy', 1);
      t.jump(-60 - Math.random() * 60);
    });
  }

  updateBonus(dt) {
    this.bonusT -= dt;
    if (this.bonusT > 0) return;
    if (this.moves > 0) {
      const options = [];
      this.eachTile((t, r, c) => {
        if (!t.special && t.type >= 0) options.push([r, c]);
      });
      if (options.length) {
        this.moves--;
        const [r, c] = options[Math.floor(this.rng() * options.length)];
        const t = this.grid[r][c];
        t.special = this.rng() < 0.5 ? 'lineH' : 'lineV';
        t.say('excited', 1);
        t.jump(-90);
        this.burst(c, r, '#ffe04a', 6, true);
        this.score += 100;
        this.audio.special(1 + (this.level.moves - this.moves) * 0.03);
        this.bonusT = 0.14;
        return;
      }
    }
    const specials = this.specialCells();
    if (!specials.length) {
      this.showWin();
      return;
    }
    this.combo = 1;
    this.clear([], [], specials, []);
  }

  showWin() {
    this.state = 'done';
    if (this.boss) this.stats.bosses++;
    const stars = this.level.stars.filter((s) => this.score >= s).length;
    const s = this.app.settings;
    const n = this.level.n;
    s.stars[n] = Math.max(s.stars[n] || 0, stars);
    const prevBest = s.best[n] || 0;
    s.best[n] = Math.max(prevBest, this.score);
    s.level = Math.max(s.level, n + 1);
    this.app.persist();
    this.app.checkStickers();
    this.overlay = { kind: 'win', t: 0, stars, shown: 0, word: this.boss ? 'VICTORY!' : WIN_WORDS[n % WIN_WORDS.length], best: s.best[n], newBest: this.score > prevBest && prevBest > 0, count: 0, starT: [] };
    this.setButtons();
    this.eachTile((t) => t.say('happy', 99));
    this.confetti();
    this.audio.chorus();
  }

  showDailyEnd() {
    this.state = 'done';
    const s = this.app.settings;
    const d = (s.daily = s.daily || { day: null, best: 0, streak: 0, lastDay: null });
    const today = this.level.day;
    if (d.day !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      d.streak = d.lastDay === yesterday ? d.streak + 1 : 1;
      d.lastDay = today;
      d.day = today;
      d.best = 0;
    }
    const isBest = this.score > d.best;
    d.best = Math.max(d.best, this.score);
    this.app.persist();
    this.app.checkStickers();
    this.overlay = { kind: 'daily', t: 0, best: d.best, streak: d.streak, isBest };
    this.setButtons();
    this.eachTile((t) => t.say('happy', 99));
    this.audio.win();
    this.confetti();
  }

  /** A one-off monster snack: five more moves to finish the level. */
  extraMoves() {
    this.usedExtra = true;
    this.moves += 5;
    this.overlay = null;
    this.setButtons();
    this.eachTile((t) => {
      t.expr = null;
      t.exprT = 0;
      t.say('excited', 0.8);
      t.jumpT = 0.05 + Math.random() * 0.3;
    });
    this.bigText('+5 MOVES!', '#74e06b');
    this.audio.special(1.1);
    this.state = 'idle';
    this.idleT = 0;
  }

  showLose() {
    this.state = 'done';
    this.app.persist();
    this.overlay = { kind: 'lose', t: 0 };
    this.setButtons();
    this.eachTile((t) => t.say('sad', 99));
    this.audio.lose();
  }

  bigText(text, color) {
    this.texts.push({
      text,
      x: this.boardX + this.bw / 2,
      y: this.boardY + this.bh / 2,
      t: 0,
      dur: 1.3,
      color,
      scale: 3,
      big: true,
    });
  }

  // ------------------------------------------------------------- particles

  burst(cx, cy, color, n = 8, sparkle = false) {
    const x = this.boardX + (cx + 0.5) * this.cell;
    const y = this.boardY + (cy + 0.5) * this.cell;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const v = 30 + Math.random() * 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: 0,
        max: 0.4 + Math.random() * 0.35,
        color,
        size: Math.random() < 0.4 ? 2 : 1,
        grav: 140,
        kind: 'sq',
      });
    }
    if (sparkle) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * this.cell,
          y: y + (Math.random() - 0.5) * this.cell,
          vx: 0,
          vy: -10,
          life: 0,
          max: 0.5,
          color: '#ffffff',
          grav: 0,
          kind: 'spark',
        });
      }
    }
  }

  confetti() {
    const colors = RAINBOW_COLORS.concat(['#ffffff']);
    for (let i = 0; i < 70; i++) {
      this.particles.push({
        x: this.boardX + Math.random() * this.bw,
        y: this.boardY - 10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 40,
        vy: 20 + Math.random() * 40,
        life: 0,
        max: 2 + Math.random() * 1.5,
        color: colors[i % colors.length],
        size: 2,
        grav: 20,
        kind: 'confetti',
        ph: Math.random() * 6,
      });
    }
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    this.time += dt;
    const o = this.overlay;
    if (o) {
      o.t += dt;
      if (o.kind === 'intro' && o.t > 2.6) {
        this.overlay = null;
        this.setButtons();
      }
      if (o.kind === 'win') {
        // count the score up, then land the stars one by one
        const before = o.count;
        o.count = Math.min(this.score, Math.round(this.score * Math.min(1, o.t / 0.9)));
        if (Math.floor(o.count / 250) !== Math.floor(before / 250)) this.audio.pop(1.5 + (o.count / Math.max(1, this.score)) * 0.6);
        if (o.shown < o.stars && o.t > 1.0 + o.shown * 0.45) {
          this.audio.star(o.shown);
          o.starT[o.shown] = o.t;
          const sx = Math.floor(this.app.vw / 2) - 34 + o.shown * 25 + 9;
          const sy = this.boardY + Math.floor(this.bh / 2) - 62 + 39;
          this.burstAt(sx, sy, '#ffe04a', 10);
          this.burstAt(sx, sy, '#ffffff', 4);
          this.shakeT = Math.max(this.shakeT, 0.12);
          o.shown++;
        }
      }
      if (o.kind === 'pause' || o.kind === 'tip') return;
    } else if (this.pendingTip && this.state !== 'done') {
      this.pendingTip.wait -= dt;
      if (this.pendingTip.wait <= 0) {
        this.overlay = this.pendingTip;
        this.pendingTip = null;
        this.audio.special(1.2);
        this.setButtons();
        return;
      }
    }

    this.updateTiles(dt);

    switch (this.state) {
      case 'fall':
        if (!this.anyMoving() && (!this.overlay || this.overlay.kind !== 'intro' || this.overlay.t > 1)) this.afterSettle();
        break;
      case 'swap':
        if (!this.anyMoving()) this.finishSwap();
        break;
      case 'unswap':
        if (!this.anyMoving()) this.state = 'idle';
        break;
      case 'shuffle':
        if (!this.anyMoving()) this.afterSettle();
        break;
      case 'pop':
        this.popT += dt;
        if (this.popT >= this.popDur) this.finishPop();
        break;
      case 'bonus':
        this.updateBonus(dt);
        break;
      case 'boss':
        this.updateBossAttack(dt);
        break;
      case 'idle':
        this.updateIdle(dt);
        break;
    }

    this.updateEffects(dt);
    this.updateBoss(dt);
    this.shownScore += Math.ceil((this.score - this.shownScore) * Math.min(1, dt * 8));
    if (this.shownScore > this.score) this.shownScore = this.score;
    if (this.zen && this.score >= this.milestone && this.state !== 'pop') {
      const words = ['NICE!', 'DREAMY!', 'SO CALM!', 'BLISS!', 'MONSTER ZEN!'];
      this.bigText(words[Math.min(words.length - 1, this.milestone / 5000 - 1)], '#9fe8ff');
      this.milestone += 5000;
      this.app.checkStickers();
      this.confetti();
      this.audio.win();
      this.app.persist();
    }
    this.tipT += dt;
    if (this.tipT > 6) {
      this.tipT = 0;
      this.tip = this.level.n === 1 && this.tip === 0 ? 1 : 1 + (this.tip % (TIPS.length - 1));
    }
  }

  anyMoving() {
    let moving = false;
    this.eachTile((t) => {
      if (t.falling || t.move) moving = true;
    });
    return moving;
  }

  updateIdle(dt) {
    this.idleT += dt;
    const hintDelay = this.level.n === 1 ? (this.moves === this.level.moves ? 0.6 : 3) : 7;
    if (!this.hint && this.idleT > hintDelay && !this.selected) {
      const moves = findValidMoves(this.grid);
      if (moves.length) this.hint = moves[Math.floor(Math.random() * moves.length)];
    }
    if (this.idleT > 14 && Math.random() < dt * 0.8) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      const t = this.grid[r][c];
      if (t && !this.isHint(r, c) && !t.sleepy && t.exprT <= 0) {
        t.say('yawn', 0.9);
        t.sleepAt = 0.9;
      }
    }
    // every now and then somebody does a happy little hop
    if (Math.random() < dt * 0.7) {
      const t = this.grid[Math.floor(Math.random() * ROWS)][Math.floor(Math.random() * COLS)];
      if (t && !t.sleepy) t.jump(-40);
    }
  }

  isHint(r, c) {
    const h = this.hint;
    return h && ((h.a[0] === r && h.a[1] === c) || (h.b[0] === r && h.b[1] === c));
  }

  updateTiles(dt) {
    let landed = 0;
    this.eachTile((t) => {
      if (t.exprT > 0) {
        t.exprT -= dt;
        if (t.exprT <= 0) t.expr = null;
      }
      t.blinkT -= dt;
      if (t.blinkT <= 0) {
        t.blink = 0.13;
        t.wink = Math.random() < 0.15;
        if (t.wink) t.blink = 0.35;
        t.blinkT = 1.5 + Math.random() * 4.5;
      }
      if (t.blink > 0) t.blink -= dt;
      t.glanceT -= dt;
      if (t.glanceT <= 0) {
        t.glanceT = 1 + Math.random() * 3;
        const r = Math.random();
        t.glanceX = r < 0.5 ? 0 : r < 0.75 ? -1 : 1;
        t.glanceY = Math.random() < 0.8 ? 0 : Math.random() < 0.5 ? -1 : 1;
      }
      if (t.shake > 0) t.shake -= dt;
      if (t.sleepAt > 0) {
        t.sleepAt -= dt;
        if (t.sleepAt <= 0 && this.state === 'idle' && this.idleT > 14) t.sleepy = true;
      }
      if (t.jumpT > 0) {
        t.jumpT -= dt;
        if (t.jumpT <= 0 && !t.pop && !t.falling) {
          t.jump(-90);
          t.say('laugh', 0.6);
        }
      }

      t.squashV += (-320 * t.squash - 16 * t.squashV) * dt;
      t.squash += t.squashV * dt;
      if (Math.abs(t.squash) < 0.004 && Math.abs(t.squashV) < 0.05) t.squash = t.squashV = 0;

      if (t.hopV !== 0 || t.hop < 0) {
        t.hopV += 700 * dt;
        t.hop += t.hopV * dt;
        if (t.hop >= 0) {
          if (t.hopV > 60) t.squash = Math.min(0.25, t.hopV / 900);
          t.hop = 0;
          t.hopV = 0;
        }
      }

      if (t.move) {
        const m = t.move;
        m.t += dt;
        const k = ease(Math.min(1, m.t / m.dur));
        t.x = m.fx + (m.tx - m.fx) * k;
        t.y = m.fy + (m.ty - m.fy) * k;
        if (m.t >= m.dur) t.move = null;
      }

      if (t.falling) {
        if (t.fallDelay > 0) t.fallDelay -= dt;
        else {
          t.vy = Math.min(MAX_FALL, t.vy + GRAVITY * dt);
          t.y += t.vy * dt;
          if (t.y >= t.targetY) {
            t.y = t.targetY;
            t.falling = false;
            if (t.vy > 4) {
              t.squash = Math.min(0.32, t.vy / 45);
              t.squashV = 0;
              t.say('squish', 0.14);
              if (landed++ % 3 === 0) this.audio.monster(t.type, 'land');
            }
            t.vy = 0;
          }
        }
      }

      if (t.pop) {
        const p = t.pop;
        p.t += dt;
        if (p.merge && p.t > 0) {
          const k = Math.min(1, p.t / POP_TIME);
          t.x += (p.merge.x - t.x) * k * 0.5;
          t.y += (p.merge.y - t.y) * k * 0.5;
        }
        if (!p.burst && p.t >= POP_GROW) {
          p.burst = true;
          if (!p.merge) {
            this.burst(t.x, t.y, monsterColor(t.type), 7, Math.random() < 0.5);
            this.burst(t.x, t.y, monsterLight(t.type), 3);
            if (Math.random() < 0.6) {
              const { x, y } = this.tileScreen(t);
              this.particles.push({ x, y: y - 4, vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 10, life: 0, max: 0.9, color: monsterColor(t.type), grav: 0, kind: 'heart', ph: Math.random() * 6 });
            }
          }
          this.audio.pop(1 + Math.random() * 0.3);
        }
      }

      this.updateQuirk(t, dt);
      if (t.crack !== undefined) this.updateCrack(t, dt);

      if (t.sleepy) {
        t.zT -= dt;
        if (t.zT <= 0) {
          t.zT = 1.2 + Math.random();
          this.particles.push({
            x: this.boardX + (t.x + 0.75) * this.cell,
            y: this.boardY + t.y * this.cell + 3,
            vx: 6,
            vy: -10,
            life: 0,
            max: 1.4,
            color: '#ffffff',
            grav: 0,
            kind: 'z',
          });
        }
      }
    });
  }

  bossCenter() {
    return { x: this.boardX + 13, y: this.hudY + 26 + 17 };
  }

  /** Send a damaging spark from a board cell to the boss. */
  hitBoss(dmg, cx, cy, color, delay) {
    const b = this.boss;
    b.hp = Math.max(0, b.hp - dmg);
    this.zings.push({ sx: cx, sy: cy, t: -delay, dur: 0.45 + Math.random() * 0.2, color, dmg, bend: (Math.random() - 0.5) * 60 });
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    b.hitT = Math.max(0, b.hitT - dt);
    b.roarT = Math.max(0, b.roarT - dt);
    for (const z of this.zings) {
      z.t += dt;
      if (z.t >= z.dur && !z.done) {
        z.done = true;
        b.shown = Math.max(0, b.shown - z.dmg);
        b.hitT = 0.18;
        if (this.audio.throttle('bosshit', 0.06)) this.audio.pop(0.7 + Math.random() * 0.2);
        const p = this.bossCenter();
        for (let i = 0; i < 2; i++) {
          this.particles.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 30, life: 0, max: 0.35, color: z.color, size: 1, grav: 120, kind: 'sq' });
        }
        if (b.shown === 0 && !b.deadT) {
          b.deadT = 0.0001;
          this.audio.monster(b.type, 'sad', 0.6);
          this.audio.boom();
          this.shakeT = 0.5;
          this.app.buzz([30, 40, 60]);
          this.bigText('BOSS DEFEATED!', '#ffe04a');
          for (let i = 0; i < 4; i++) this.burstAt(p.x, p.y, RAINBOW_COLORS[i], 8);
        }
      }
    }
    this.zings = this.zings.filter((z) => !z.done);
    if (b.deadT) b.deadT += dt;
  }

  burstAt(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 60;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0, max: 0.6, color, size: 2, grav: 120, kind: 'sq' });
    }
  }

  /** The boss roars and lays eggs onto the board. */
  /** Each king has its own trick. */
  bossKind() {
    return { 0: 'slime', 2: 'scramble', 5: 'steal' }[this.boss.type] || 'eggs';
  }

  bossAttack() {
    const b = this.boss;
    b.attackIn = this.bossKind() === 'steal' ? 5 : this.level.n >= 20 ? 3 : 4;
    b.roarT = 1.1;
    this.audio.monster(b.type, 'match', 0.55);
    this.audio.boom();
    this.shakeT = 0.35;
    const kind = this.bossKind();
    const who = b.name.split(' ')[1];
    this.bigText({ eggs: who + ' ROARS!', slime: 'SLIME TIME!', scramble: who + ' STARES!', steal: 'MOVE STOLEN!' }[kind], '#ff8fa8');
    const options = [];
    this.eachTile((t, r, c) => {
      if (t.type >= 0 && !t.special && !t.stuck) options.push([r, c]);
    });
    const pick = (n) => {
      const out = [];
      for (let i = 0; i < Math.min(n, options.length); i++) out.push(options.splice(Math.floor(this.rng() * options.length), 1)[0]);
      return out;
    };
    this.attack = { kind, cells: [] };
    if (kind === 'eggs') this.attack.cells = pick(this.level.n >= 15 ? 3 : 2);
    else if (kind === 'slime') this.attack.cells = pick(this.level.n >= 15 ? 5 : 4);
    else if (kind === 'scramble') {
      const r0 = 1 + Math.floor(this.rng() * (ROWS - 2));
      const c0 = 1 + Math.floor(this.rng() * (COLS - 2));
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) if (this.grid[r][c]) this.attack.cells.push([r, c]);
    }
    this.attackT = 0;
    this.state = 'boss';
  }

  updateBossAttack(dt) {
    const before = this.attackT;
    this.attackT += dt;
    const a = this.attack;
    if (before < 0.75 && this.attackT >= 0.75) {
      if (a.kind === 'eggs') {
        for (const [r, c] of a.cells) {
          const egg = new Tile(EGG_TYPE);
          egg.hp = 2;
          egg.x = c;
          egg.y = r;
          egg.squash = 0.35;
          this.grid[r][c] = egg;
          this.burst(c, r, '#fff4dc', 6);
          this.effects.push({ kind: 'ring', r, c, t: 0, color: '#fff4dc' });
        }
        this.audio.crack(1);
      } else if (a.kind === 'slime') {
        for (const [r, c] of a.cells) {
          const t = this.grid[r][c];
          t.stuck = 3;
          t.say('sad', 0.8);
          t.squash = 0.3;
          this.burst(c, r, '#ff6fb4', 6);
        }
        this.audio.monster(0, 'match', 0.7);
      } else if (a.kind === 'scramble') {
        const tiles = a.cells.map(([r, c]) => this.grid[r][c]);
        for (let i = tiles.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
        }
        a.cells.forEach(([r, c], i) => {
          this.grid[r][c] = tiles[i];
          tiles[i].tweenTo(c, r, 0.3, 4);
          tiles[i].say('dizzy', 0.9);
        });
        this.audio.shuffle();
      } else if (a.kind === 'steal') {
        this.moves = Math.max(1, this.moves - 1);
        this.audio.zap();
        this.app.buzz(25);
      }
    }
    if (this.attackT >= 1.1 && !this.anyMoving()) {
      this.attack = null;
      this.afterSettle();
    }
  }

  drawBossAttack(ctx) {
    const a = this.attack;
    if (this.state !== 'boss' || !a || this.attackT >= 0.75) return;
    const k = ease(this.attackT / 0.75);
    const p = this.bossCenter();
    const fly = (tx, ty, draw) => {
      const x = p.x + (tx - p.x) * k;
      const y = p.y + (ty - p.y) * k - Math.sin(k * Math.PI) * 40;
      draw(Math.round(x), Math.round(y));
    };
    if (a.kind === 'steal') {
      // a spark zips from the boss to the moves counter
      const tx = this.boardX + this.bw - 15;
      const ty = this.hudY + 14;
      fly(tx, ty, (x, y) => {
        ctx.fillStyle = '#ffe04a';
        ctx.fillRect(x - 2, y - 2, 5, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y - 1, 3, 3);
      });
      return;
    }
    if (a.kind === 'scramble') {
      const [r, c] = a.cells[4];
      const x = this.boardX + (c + 0.5) * this.cell;
      const y = this.boardY + (r + 0.5) * this.cell;
      pixelCircle(ctx, x, y, (1 - k) * 30 + this.cell * 1.5, '#9fe8ff', 1);
      return;
    }
    for (const [r, c] of a.cells) {
      fly(this.boardX + (c + 0.5) * this.cell, this.boardY + (r + 0.5) * this.cell, (x, y) => {
        if (a.kind === 'eggs') ctx.drawImage(getSprite(EGG_TYPE, 'idle'), x - 8, y - 8);
        else {
          ctx.fillStyle = '#c23a86';
          ctx.fillRect(x - 3, y - 2, 6, 5);
          ctx.fillStyle = '#ff6fb4';
          ctx.fillRect(x - 2, y - 2, 4, 3);
        }
      });
    }
  }

  drawZings(ctx) {
    const p = this.bossCenter();
    for (const z of this.zings) {
      if (z.t < 0) continue;
      const k = Math.min(1, z.t / z.dur);
      const e = k * k;
      const sx = this.boardX + (z.sx + 0.5) * this.cell;
      const sy = this.boardY + (z.sy + 0.5) * this.cell;
      const x = Math.round(sx + (p.x - sx) * e + Math.sin(k * Math.PI) * z.bend);
      const y = Math.round(sy + (p.y - sy) * e);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = z.color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  updateCrack(t, dt) {
    t.crack += dt;
    if (t.crack < 0) return;
    t.crack = undefined;
    if (t.type !== EGG_TYPE) return;
    t.hp--;
    t.shake = 0.3;
    this.score += 30;
    this.burst(t.x, t.y, '#fff4dc', 6);
    if (this.boss && this.boss.hp > 0) this.hitBoss(2, t.x, t.y, '#fff4dc', 0);
    this.audio.crack(t.hp);
    if (t.hp > 0) return;
    // Hatch! The egg becomes a brand new baby monster.
    t.type = Math.floor(this.rng() * this.level.types);
    t.special = null;
    t.say('excited', 1.2);
    t.squash = -0.4;
    t.jump(-110);
    this.burst(t.x, t.y, '#fff4dc', 12, true);
    this.burst(t.x, t.y, '#ff8fc0', 4);
    this.score += 100;
    this.stats.hatched++;
    this.app.buzz(15);
    this.audio.monster(t.type, 'select', 1.3, 0.05);
    const goal = this.goals.find((g) => g.type === EGG_TYPE && g.left > 0);
    if (goal) {
      goal.left--;
      this.flyers.push({ goal, type: EGG_TYPE, sx: t.x, sy: t.y, t: 0, dur: 0.6 });
    }
    this.texts.push({ text: 'HATCHED!', x: this.tileScreen(t).x, y: this.tileScreen(t).y - 8, t: 0, dur: 0.9, color: '#ffe04a', scale: 1 });
  }

  /** Little species-specific idle animations so the board never feels static. */
  updateQuirk(t, dt) {
    if (t.quirk > 0) t.quirk -= dt;
    const busy = t.pop || t.falling || t.move || t.sleepy || t.type < 0 || this.state === 'done';
    if (busy) return;
    t.quirkT -= dt;
    if (t.quirkT > 0) return;
    t.quirkT = 3 + Math.random() * 7;
    t.quirk = QUIRK_TIME[t.type];
    t.quirkSide = Math.random() < 0.5 ? 1 : 2;
    const { x, y } = this.tileScreen(t);
    if (t.type === 0) {
      t.squashV = 2.2; // jelly wobble
    } else if (t.type === 1) {
      // Grumble huffs steam out of both horns
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1;
        this.particles.push({ x: x + side * 6, y: y - 8, vx: side * (4 + Math.random() * 4), vy: -14 - Math.random() * 8, life: -i * 0.12, max: 0.7, color: '#f4ecff', grav: -6, kind: 'puff' });
      }
    } else if (t.type === 5) {
      this.particles.push({ x: x + (t.quirkSide === 1 ? -7 : 7), y: y - 5, vx: 0, vy: -6, life: 0, max: 0.5, color: '#fff6b0', grav: 0, kind: 'spark' });
    }
  }

  quirkVariant(t) {
    if (t.quirk <= 0 || t.special) return 'n';
    const fast = Math.floor(this.time * 9) % 2;
    switch (t.type) {
      case 0:
      case 2:
      case 4:
        return fast ? 'q1' : 'q2';
      case 3:
        return Math.floor(this.time * 14) % 3 ? 'q' + t.quirkSide : 'n';
      case 5:
        return Math.floor(this.time * 7) % 2 ? 'q' + t.quirkSide : 'n';
      default:
        return 'n';
    }
  }

  updateEffects(dt) {
    for (const p of this.particles) {
      p.life += dt;
      if (p.life < 0) continue;
      p.vy += p.grav * dt;
      if (p.kind === 'confetti') p.vx = Math.sin(this.time * 4 + p.ph) * 25;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.dur);
    for (const e of this.effects) {
      e.t += dt;
      if (!e.started && e.t >= 0) {
        e.started = true;
        if (e.kind === 'bomb' || e.kind === 'all') this.shakeT = Math.max(this.shakeT, e.kind === 'all' ? 0.5 : 0.25);
        if (e.kind === 'color') this.shakeT = Math.max(this.shakeT, 0.2);
      }
    }
    this.effects = this.effects.filter((e) => e.t < 0.6);
    for (const f of this.flyers) {
      f.t += dt;
      if (f.t >= f.dur && !f.done) {
        f.done = true;
        f.goal.shown--;
        f.goal.bump = 0.25;
        this.audio.pop(1.6);
      }
    }
    this.flyers = this.flyers.filter((f) => !f.done);
    for (const g of this.goals) if (g.bump > 0) g.bump -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
  }

  // ---------------------------------------------------------------- render

  render(ctx) {
    const shakeOn = this.app.settings.shake !== false && this.shakeT > 0;
    const shake = shakeOn ? Math.round((Math.random() - 0.5) * 4 * Math.min(1, this.shakeT * 4)) : 0;
    const shakeY = shakeOn ? Math.round((Math.random() - 0.5) * 3 * Math.min(1, this.shakeT * 4)) : 0;
    this.drawHud(ctx);
    ctx.save();
    ctx.translate(shake, shakeY);
    this.drawBoard(ctx);
    this.drawEffects(ctx);
    ctx.restore();
    this.drawFlyers(ctx);
    this.drawZings(ctx);
    this.drawBossAttack(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    this.drawHand(ctx);
    this.drawBar(ctx);
    this.drawOverlay(ctx);
  }

  tileScreen(t) {
    return {
      x: this.boardX + (t.x + 0.5) * this.cell,
      y: this.boardY + (t.y + 0.5) * this.cell,
    };
  }

  drawBoard(ctx) {
    const { boardX: x, boardY: y, bw, bh, cell } = this;
    if (this.voids.size) {
      // shaped board: build the panel out of its cells
      for (const [pad, col] of [[3, '#140726'], [2, '#24123f']]) {
        ctx.fillStyle = col;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!this.voids.has(key(r, c))) ctx.fillRect(x + c * cell - pad, y + r * cell - pad, cell + pad * 2, cell + pad * 2);
          }
        }
      }
    } else {
      panel(ctx, x - 4, y - 4, bw + 8, bh + 8, 'rgba(26,11,46,0.72)', '#140726', 4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - 1, y - 3, bw + 2, 1);
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.voids.has(key(r, c))) continue;
        ctx.fillStyle = (r + c) % 2 ? 'rgba(160,120,255,0.16)' : 'rgba(255,170,220,0.12)';
        ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
      }
    }
    this.drawGoo(ctx);

    // selection brackets
    if (this.selected) {
      const [r, c] = this.selected;
      const pulse = Math.floor(this.time * 4) % 2;
      this.brackets(ctx, x + c * cell - pulse, y + r * cell - pulse, cell + pulse * 2, '#ffffff');
    }
    if (this.hint && Math.floor(this.time * 2) % 2 === 0) {
      for (const [r, c] of [this.hint.a, this.hint.b]) this.brackets(ctx, x + c * cell, y + r * cell, cell, '#ffe04a');
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 6, bw + 8, bh + 10);
    ctx.clip();
    const popping = [];
    this.eachTile((t, r, c) => {
      if (t.pop) popping.push(t);
      else this.drawTile(ctx, t, r, c);
    });
    for (const t of popping) this.drawTile(ctx, t);
    // arrows and sparks go on top so neighbours never hide them
    this.eachTile((t) => {
      if (!t.special || t.pop) return;
      const { x: sx, y: sy } = this.tileScreen(t);
      this.drawSpecialBits(ctx, t, sx, sy + Math.round(t.hop));
    });
    ctx.restore();
  }

  drawGoo(ctx) {
    const { boardX: x, boardY: y, cell } = this;
    const has = (r, c) => r >= 0 && c >= 0 && r < ROWS && c < COLS && this.goo[r][c] > 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!has(r, c)) continue;
        const cx = x + c * cell;
        const cy = y + r * cell;
        ctx.fillStyle = '#c23a86';
        ctx.fillRect(cx, cy, cell, cell);
        ctx.fillStyle = '#ff6fb4';
        ctx.fillRect(cx + (has(r, c - 1) ? 0 : 1), cy + (has(r - 1, c) ? 0 : 1), cell - (has(r, c - 1) ? 0 : 1) - (has(r, c + 1) ? 0 : 1), cell - (has(r - 1, c) ? 0 : 1) - (has(r + 1, c) ? 0 : 2));
        if (!has(r - 1, c)) {
          ctx.fillStyle = '#ffb0d8';
          ctx.fillRect(cx + 2, cy + 1, cell - 4, 1);
        }
        if (!has(r + 1, c)) {
          // drips
          ctx.fillStyle = '#c23a86';
          const d = (r * 7 + c * 3) % (cell - 6);
          ctx.fillRect(cx + 3 + d, cy + cell, 2, 2);
        }
        // a bubble pops now and then
        const ph = (this.time * 0.7 + r * 0.37 + c * 0.61) % 3;
        if (ph < 0.4) {
          ctx.fillStyle = '#ffd6ec';
          ctx.fillRect(cx + 3 + ((r + c * 5) % (cell - 7)), cy + cell - 5 - Math.floor(ph * 6), ph < 0.3 ? 2 : 1, ph < 0.3 ? 2 : 1);
        }
      }
    }
  }

  brackets(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    const l = 4;
    ctx.fillRect(x, y, l, 1);
    ctx.fillRect(x, y, 1, l);
    ctx.fillRect(x + s - l, y, l, 1);
    ctx.fillRect(x + s - 1, y, 1, l);
    ctx.fillRect(x, y + s - 1, l, 1);
    ctx.fillRect(x, y + s - l, 1, l);
    ctx.fillRect(x + s - l, y + s - 1, l, 1);
    ctx.fillRect(x + s - 1, y + s - l, 1, l);
  }

  exprFor(t, r, c) {
    if (t.pop) return t.pop.t < 0 ? 'surprised' : 'happy';
    if (t.falling && t.vy > 5) return 'surprised';
    if (t.exprT > 0 && t.expr) return t.expr;
    const sel = this.selected;
    if (sel && sel[0] === r && sel[1] === c) return 'excited';
    if (this.hint && this.isHint(r, c)) return Math.floor(this.time * 2) % 2 ? 'excited' : 'idle';
    if (t.blink > 0) return t.wink ? 'wink' : 'blink';
    if (t.sleepy) return 'sleepy';
    return 'idle';
  }

  lookFor(t, expr, sx, sy, r, c) {
    if (expr === 'happy' || expr === 'squish' || expr === 'dizzy' || expr === 'blink' || expr === 'sleepy') return [0, 0];
    const p = this.app.pointer;
    let tx = null;
    let ty = null;
    if (p.active) {
      tx = p.x;
      ty = p.y;
    } else if (this.selected) {
      tx = this.boardX + (this.selected[1] + 0.5) * this.cell;
      ty = this.boardY + (this.selected[0] + 0.5) * this.cell;
    } else if (this.hint && this.isHint(r, c)) {
      const o = this.hint.a[0] === r && this.hint.a[1] === c ? this.hint.b : this.hint.a;
      return [Math.sign(o[1] - c), Math.sign(o[0] - r)];
    }
    if (tx === null) return [t.glanceX, t.glanceY];
    const dx = tx - sx;
    const dy = ty - sy;
    return [dx > 6 ? 1 : dx < -6 ? -1 : 0, dy > 8 ? 1 : dy < -8 ? -1 : 0];
  }

  drawTile(ctx, t, r, c) {
    const { x: sx, y: sy } = this.tileScreen(t);
    const expr = this.exprFor(t, r, c);
    const [lx, ly] = this.lookFor(t, expr, sx, sy, r, c);

    let scale = 1;
    let sxk = 1;
    let syk = 1;
    if (t.pop) {
      // squash down, stretch up ("yay!"), then pop
      const p = t.pop;
      if (p.t < 0) scale = 1;
      else if (p.t < 0.045) {
        sxk = 1.18;
        syk = 0.82;
      } else if (p.t < POP_GROW) {
        sxk = 0.9;
        syk = 1.3;
      } else scale = Math.max(0, 1.25 * (1 - (p.t - POP_GROW) / (POP_TIME - POP_GROW)));
      if (p.merge) {
        scale = Math.max(0, 1 - p.t / POP_TIME);
        sxk = syk = 1;
      }
    }
    const breathe = !t.pop && !t.falling && Math.sin(this.time * 2.6 + t.phase) > 0.55 ? 1 : 0;
    const w = Math.round(16 * (1 + t.squash) * scale * sxk);
    const h = Math.round(16 * (1 - t.squash) * scale * syk) + breathe;
    if (w <= 0 || h <= 0) return;

    let ox = 0;
    if (t.shake > 0) ox = Math.round(Math.sin(this.time * 70) * 1.6);
    if (r !== undefined && this.isHint(r, c) && Math.floor(this.time * 2) % 2 === 0) ox = Math.round(Math.sin(this.time * 30));
    if (t.pop && t.pop.t < 0 && t.pop.t > -0.5) ox = Math.round(Math.sin(this.time * 50) * 0.8);

    const bottom = Math.round(sy + 8 * scale);
    if (!t.pop) {
      ctx.fillStyle = 'rgba(20,5,40,0.35)';
      const shw = t.hop < -6 ? 6 : 10;
      ctx.fillRect(Math.round(sx - shw / 2), Math.round(sy) + 7, shw, 2);
    }

    let variant = t.type === EGG_TYPE ? (t.hp < 2 ? 'e1' : 'e2') : this.quirkVariant(t);
    if (t.type === EGG_TYPE && t.shake <= 0 && Math.sin(this.time * 1.3 + t.phase * 3) > 0.92) ox += Math.floor(this.time * 10) % 2 ? 1 : -1;
    if (t.special === 'lineH') variant = 'lh';
    else if (t.special === 'lineV') variant = 'lv';
    else if (t.special === 'bomb') variant = Math.floor(this.time * 6) % 2 ? 'b0' : 'b1';
    const frame = t.type < 0 ? Math.floor(this.time * 12) % RAINBOW_FRAMES : 0;
    const spr = getSprite(t.type, expr, lx, ly, variant, frame);
    let dx = Math.round(sx - w / 2) + ox;
    let dy = bottom - h + Math.round(t.hop);
    if (t.move && t.move.arc) dy -= Math.round(Math.sin(Math.min(1, t.move.t / t.move.dur) * Math.PI) * t.move.arc);
    const d = this.drag;
    if (d && d.lean && r !== undefined && d.cell[0] === r && d.cell[1] === c) {
      dx += Math.round(d.lean[0]);
      dy += Math.round(d.lean[1]);
    }
    const ghost = t.type === 4 && !t.pop && !t.falling;
    if (ghost) dy += Math.round(Math.sin(this.time * 2.2 + t.phase) * 1.4) - 1;
    if (ghost && t.quirk > 0 && !t.special) ctx.globalAlpha = 0.55;
    ctx.drawImage(spr, dx, dy, w, h);
    if (t.stuck > 0 && !t.pop) {
      // dripping slime coat
      ctx.fillStyle = 'rgba(255,111,180,0.55)';
      ctx.fillRect(dx + 1, dy + 2, w - 2, Math.round(h * 0.45));
      ctx.fillStyle = '#c23a86';
      const drip = Math.floor(this.time * 2 + t.phase) % 3;
      ctx.fillRect(dx + 3, dy + 2 + Math.round(h * 0.45), 2, 2 + drip);
      ctx.fillRect(dx + w - 6, dy + 2 + Math.round(h * 0.45), 2, 1 + ((drip + 1) % 3));
    }
    if (this.app.settings.hat && t.type >= 0) drawHat(ctx, this.app.settings.hat, t.type, dx, dy, w, h);
    ctx.globalAlpha = 1;
  }

  drawSpecialBits(ctx, t, sx, sy) {
    const pulse = Math.floor(this.time * 5) % 2;
    if (t.special === 'lineH') {
      iconOutlined(ctx, 'arrowL', sx - 11 - pulse, sy - 2, '#ffffff', '#1a0b2e');
      iconOutlined(ctx, 'arrowR', sx + 9 + pulse, sy - 2, '#ffffff', '#1a0b2e');
    } else if (t.special === 'lineV') {
      iconOutlined(ctx, 'arrowU', sx - 2, sy - 12 - pulse, '#ffffff', '#1a0b2e');
      iconOutlined(ctx, 'arrowD', sx - 2, sy + 9 + pulse, '#ffffff', '#1a0b2e');
    } else if (t.special === 'bomb') {
      // fizzing fuse spark on top
      const sparkC = pulse ? '#fff6b0' : '#ff8f3a';
      ctx.fillStyle = sparkC;
      ctx.fillRect(Math.round(sx) + 4, Math.round(sy) - 9, 2, 2);
      if (pulse) {
        ctx.fillRect(Math.round(sx) + 3, Math.round(sy) - 10, 1, 1);
        ctx.fillRect(Math.round(sx) + 6, Math.round(sy) - 11, 1, 1);
      }
    } else if (t.special === 'pal') {
      this.drawWings(ctx, sx, sy, 0);
    } else if (t.special === 'rainbow') {
      if (Math.floor(this.time * 3 + t.phase) % 3 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(sx) - 7, Math.round(sy) - 7, 1, 1);
        ctx.fillRect(Math.round(sx) + 7, Math.round(sy) + 3, 1, 1);
      }
    }
  }

  /** Little flapping wings either side of a pal. */
  drawWings(ctx, sx, sy, phase) {
    const up = Math.floor(this.time * 10 + phase) % 2;
    const wing = up ? ['.##', '###', '#..'] : ['#..', '###', '.##'];
    const x = Math.round(sx);
    const y = Math.round(sy) - 4;
    const flip = (rows) => rows.map((row) => row.split('').reverse().join(''));
    pattern(ctx, wing.map((r) => r.replace(/#/g, 'o')), x - 11, y - 1, { o: '#1a0b2e' });
    pattern(ctx, flip(wing).map((r) => r.replace(/#/g, 'o')), x + 8, y - 1, { o: '#1a0b2e' });
    pattern(ctx, flip(wing), x - 10, y, { '#': '#ffffff' });
    pattern(ctx, wing, x + 7, y, { '#': '#ffffff' });
  }

  drawEffects(ctx) {
    const { boardX: bx, boardY: by, cell, bw, bh } = this;
    for (const e of this.effects) {
      if (e.t < 0) continue;
      const k = e.t / 0.4;
      if (k > 1 && e.kind !== 'color' && e.kind !== 'ring') continue;
      const cx = bx + (e.c + 0.5) * cell;
      const cy = by + (e.r + 0.5) * cell;
      const beam = (dir, r, c) => {
        const reach = (e.t / 0.035) * cell + cell;
        const thick = Math.max(1, Math.round(cell * 0.7 * (1 - k)));
        if (dir === 'h') {
          const y = Math.round(by + (r + 0.5) * cell - thick / 2);
          const x0 = Math.max(bx, Math.round(bx + (c + 0.5) * cell - reach));
          const x1 = Math.min(bx + bw, Math.round(bx + (c + 0.5) * cell + reach));
          ctx.fillStyle = 'rgba(255,240,255,0.55)';
          ctx.fillRect(x0, y - 2, x1 - x0, thick + 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x0, y, x1 - x0, thick);
        } else {
          const x = Math.round(bx + (c + 0.5) * cell - thick / 2);
          const y0 = Math.max(by, Math.round(by + (r + 0.5) * cell - reach));
          const y1 = Math.min(by + bh, Math.round(by + (r + 0.5) * cell + reach));
          ctx.fillStyle = 'rgba(255,240,255,0.55)';
          ctx.fillRect(x - 2, y0, thick + 4, y1 - y0);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y0, thick, y1 - y0);
        }
      };
      switch (e.kind) {
        case 'line':
          beam(e.dir, e.r, e.c);
          break;
        case 'cross':
          for (let w = -e.width; w <= e.width; w++) {
            beam('h', e.r + w, e.c);
            beam('v', e.r, e.c + w);
          }
          break;
        case 'bomb': {
          const rad = (e.radius + 1) * cell * Math.min(1, k * 1.4);
          ctx.fillStyle = `rgba(255,230,150,${0.5 * (1 - k)})`;
          ctx.fillRect(Math.round(cx - rad), Math.round(cy - rad), Math.round(rad * 2), Math.round(rad * 2));
          pixelCircle(ctx, cx, cy, rad, '#ffffff', 2);
          pixelCircle(ctx, cx, cy, rad * 0.65, '#ffcf3a', 2);
          break;
        }
        case 'color': {
          if (e.t > 0.55) break;
          const col = RAINBOW_COLORS[Math.floor(this.time * 20) % RAINBOW_COLORS.length];
          for (const tg of e.targets || []) {
            const tx = bx + (tg.c + 0.5) * cell;
            const ty = by + (tg.r + 0.5) * cell;
            if (tg.delay - e.delay > e.t + 0.1) continue;
            pixelLine(ctx, cx, cy, tx, ty, col, 1);
          }
          pixelCircle(ctx, cx, cy, 4 + e.t * 40, col, 1);
          break;
        }
        case 'all': {
          ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
          ctx.fillRect(bx, by, bw, bh);
          pixelCircle(ctx, cx, cy, k * bw, '#ffffff', 2);
          break;
        }
        case 'pal': {
          // the pal flies off to its target
          if (!e.target || e.t > 0.45) break;
          const k = Math.min(1, e.t / 0.4);
          const tx = bx + (e.target[1] + 0.5) * cell;
          const ty = by + (e.target[0] + 0.5) * cell;
          const fx = cx + (tx - cx) * ease(k);
          const fy = cy + (ty - cy) * ease(k) - Math.sin(k * Math.PI) * 24;
          ctx.drawImage(getSprite(e.type, 'excited'), Math.round(fx - 8), Math.round(fy - 8));
          this.drawWings(ctx, fx, fy, 0.5);
          break;
        }
        case 'ring': {
          const kk = e.t / 0.35;
          if (kk > 1) break;
          pixelCircle(ctx, cx, cy, 4 + kk * cell, e.color, 1);
          break;
        }
      }
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const fade = 1 - p.life / p.max;
      if (p.kind === 'sq' || p.kind === 'confetti') {
        if (p.kind === 'sq' && fade < 0.3 && Math.floor(p.life * 30) % 2) continue;
        ctx.fillStyle = p.color;
        const s = p.kind === 'confetti' ? (Math.sin(this.time * 8 + p.ph) > 0 ? 2 : 1) : p.size;
        ctx.fillRect(x, y, p.kind === 'confetti' ? 2 : s, s);
      } else if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        const s = fade > 0.5 ? 2 : 1;
        ctx.fillRect(x, y - s, 1, s * 2 + 1);
        ctx.fillRect(x - s, y, s * 2 + 1, 1);
      } else if (p.kind === 'heart') {
        if (fade < 0.25 && Math.floor(p.life * 20) % 2) continue;
        const hx = x + Math.round(Math.sin(p.life * 6 + p.ph) * 2);
        ctx.fillStyle = '#1a0b2e';
        ctx.fillRect(hx - 1, y - 1, 7, 6);
        ctx.fillStyle = p.color;
        ctx.fillRect(hx, y, 2, 2);
        ctx.fillRect(hx + 3, y, 2, 2);
        ctx.fillRect(hx, y + 1, 5, 2);
        ctx.fillRect(hx + 1, y + 3, 3, 1);
        ctx.fillRect(hx + 2, y + 4, 1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hx, y, 1, 1);
      } else if (p.kind === 'puff') {
        if (p.life < 0) continue;
        const s = p.life / p.max < 0.4 ? 2 : 3;
        ctx.fillStyle = fade > 0.5 ? p.color : 'rgba(244,236,255,0.5)';
        ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
      } else if (p.kind === 'z') {
        drawText(ctx, 'z', x + Math.round(Math.sin(p.life * 4) * 2), y, { color: 'rgba(255,255,255,' + fade.toFixed(2) + ')' });
      }
    }
  }

  drawTexts(ctx) {
    for (const t of this.texts) {
      const k = t.t / t.dur;
      let y = t.y - k * 14;
      if (t.big) {
        y = t.y - 8;
        if (k > 0.75 && Math.floor(t.t * 20) % 2) continue;
        const pop = k < 0.12 ? Math.round((1 - k / 0.12) * 6) : 0;
        drawText(ctx, t.text, Math.round(t.x), Math.round(y - pop), { color: t.color, scale: t.scale, align: 'center', outline: '#1a0b2e' });
        continue;
      }
      if (k > 0.7 && Math.floor(t.t * 20) % 2) continue;
      drawText(ctx, t.text, Math.round(t.x), Math.round(y), { color: t.color, scale: t.scale, align: 'center', outline: '#1a0b2e' });
    }
  }

  goalIconPos(i) {
    const n = this.goals.length;
    const x = this.boardX - 3 + this.bw + 6 - n * 30 + i * 30 + 2;
    return { x, y: this.hudY + 26 };
  }

  drawFlyers(ctx) {
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const k = ease(Math.min(1, f.t / f.dur));
      const i = this.goals.indexOf(f.goal);
      const to = this.goalIconPos(i);
      const fx = this.boardX + (f.sx + 0.5) * this.cell;
      const fy = this.boardY + (f.sy + 0.5) * this.cell;
      const x = fx + (to.x + 8 - fx) * k;
      const y = fy + (to.y + 8 - fy) * k - Math.sin(k * Math.PI) * 30;
      const s = Math.round(16 - k * 6);
      ctx.drawImage(getSprite(f.type, 'happy'), Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    }
  }

  drawHud(ctx) {
    const x = this.boardX - 4;
    const w = this.bw + 8;
    const y = this.hudY;
    const box = (bx, bw, label, value, color, labelColor = '#ffb3d9') => {
      panel(ctx, bx, y, bw, 23, '#2d1856', '#140726', 3);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx + 3, y + 1, bw - 6, 1);
      drawText(ctx, label, bx + Math.floor(bw / 2), y + 3, { color: labelColor, align: 'center' });
      const big = textWidth(value, 2) <= bw - 6;
      drawText(ctx, value, bx + Math.floor(bw / 2), y + (big ? 10 : 12), { color, scale: big ? 2 : 1, align: 'center', outline: '#140726' });
    };
    const side = 38;
    if (this.daily) {
      const d = this.app.settings.daily;
      const best = d && d.day === this.level.day ? d.best : 0;
      box(x, side, 'DAILY', this.level.day.slice(8), '#ffa040');
      const low = this.moves <= 5 && this.state !== 'done';
      box(x + w - side, side, 'MOVES', String(Math.max(0, this.moves)), low && Math.floor(this.time * 3) % 2 ? '#ff5a7a' : '#ffffff');
      box(x + side + 3, w - side * 2 - 6, 'SCORE', String(this.shownScore), '#ffe04a');
      const gy = y + 26;
      panel(ctx, x, gy, w, 19, '#2d1856', '#140726', 3);
      drawText(ctx, this.level.title, x + 5, gy + 3, { color: '#ffa040' });
      drawText(ctx, 'BEST TODAY ' + best, x + w - 5, gy + 3, { color: '#c9b6ff', align: 'right' });
      const barW = w - 10;
      roundRect(ctx, x + 5, gy + 11, barW, 5, 1, '#140726');
      const k = best ? Math.min(1, this.shownScore / best) : 0;
      const fill = Math.round(k * (barW - 2));
      if (fill > 0) {
        roundRect(ctx, x + 6, gy + 12, fill, 3, 0, k >= 1 ? '#ffe04a' : '#ffa040');
      }
      return;
    }
    if (this.zen) {
      box(x, side, 'MODE', 'ZEN', '#9fe8ff');
      box(x + w - side, side, 'BEST', String(Math.max(this.app.settings.zenBest || 0, this.shownScore)), '#ffffff');
      box(x + side + 3, w - side * 2 - 6, 'SCORE', String(this.shownScore), '#ffe04a');
      const gy = y + 26;
      panel(ctx, x, gy, w, 19, '#2d1856', '#140726', 3);
      drawText(ctx, 'NEXT TREAT AT ' + this.milestone, x + 5, gy + 3, { color: '#9fe8ff' });
      const barW = w - 10;
      roundRect(ctx, x + 5, gy + 11, barW, 5, 1, '#140726');
      const k = Math.min(1, (this.shownScore - (this.milestone - 5000)) / 5000);
      const fill = Math.round(Math.max(0, k) * (barW - 2));
      if (fill > 0) {
        roundRect(ctx, x + 6, gy + 12, fill, 3, 0, '#6cc4ff');
        ctx.fillStyle = '#c8ecff';
        ctx.fillRect(x + 6, gy + 12, fill, 1);
      }
      return;
    }
    box(x, side, 'LEVEL', String(this.level.n), '#ffffff');
    const low = this.moves <= 5 && this.state !== 'done';
    const movesColor = low && Math.floor(this.time * 3) % 2 ? '#ff5a7a' : '#ffffff';
    box(x + w - side, side, 'MOVES', String(Math.max(0, this.moves)), movesColor, low ? '#ff8fa8' : '#ffb3d9');
    box(x + side + 3, w - side * 2 - 6, 'SCORE', String(this.shownScore), '#ffe04a');

    if (this.boss) {
      this.drawBossPanel(ctx, x, y + 26, w);
      return;
    }

    // Goals row: score bar with stars, then monsters to collect.
    const gy = y + 26;
    panel(ctx, x, gy, w, 19, '#2d1856', '#140726', 3);
    const goalsW = this.goals.length * 30;
    const barX = x + 5;
    const barW = w - 10 - goalsW - (goalsW ? 2 : 0);
    const barY = gy + 11;
    drawText(ctx, 'GOAL ' + this.level.target, barX, gy + 3, { color: '#c9b6ff' });
    roundRect(ctx, barX, barY, barW, 5, 1, '#140726');
    const max = this.level.stars[2];
    const fill = Math.round((Math.min(this.shownScore, max) / max) * (barW - 2));
    if (fill > 0) {
      roundRect(ctx, barX + 1, barY + 1, fill, 3, 0, '#ff7eb6');
      ctx.fillStyle = '#ffc4de';
      ctx.fillRect(barX + 1, barY + 1, fill, 1);
    }
    this.level.stars.forEach((s, i) => {
      const sx = barX + Math.round((s / max) * (barW - 2)) - 3;
      const got = this.shownScore >= s;
      iconOutlined(ctx, 'star', Math.min(sx, barX + barW - 6), barY - 1, got ? '#ffe04a' : '#6a5a88', '#140726');
    });

    this.goals.forEach((g, i) => {
      const p = this.goalIconPos(i);
      const bump = g.bump > 0 ? -2 : 0;
      ctx.drawImage(getSprite(g.type, g.shown <= 0 ? 'happy' : 'idle', 0, 0), p.x, gy + 1 + bump);
      if (g.shown <= 0) {
        iconOutlined(ctx, 'heart', p.x + 17, gy + 7, '#ff5a7a', '#140726');
      } else {
        drawText(ctx, String(g.shown), p.x + 17, gy + 7, { color: '#ffffff', outline: '#140726' });
      }
    });
  }

  drawBossPanel(ctx, x, y, w) {
    const b = this.boss;
    panel(ctx, x, y, w, 34, '#3a1650', '#140726', 3);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 3, y + 1, w - 6, 1);
    // the boss itself, twice normal size with a little crown
    let expr = 'idle';
    if (b.deadT) expr = 'dizzy';
    else if (b.roarT > 0) expr = 'excited';
    else if (b.hitT > 0) expr = 'squish';
    else if (b.shown < b.max * 0.3) expr = Math.floor(this.time * 2) % 3 ? 'sad' : 'blink';
    else if (Math.floor(this.time * 0.8) % 5 === 0) expr = 'blink';
    const shake = b.hitT > 0 || b.roarT > 0 ? Math.round(Math.sin(this.time * 60) * 1.5) : 0;
    const sink = b.deadT ? Math.min(20, Math.round(b.deadT * 30)) : 0;
    const bob = b.deadT ? 0 : Math.round(Math.sin(this.time * 2.5) * 1);
    const bx = x + 3 + shake;
    const by = y + 1 + bob + sink;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, 34, 32);
    ctx.clip();
    ctx.drawImage(getSprite(b.type, expr), bx, by, 32, 32);
    pattern(ctx, CROWN, bx + 13, by - 1 + (b.type === 1 ? 2 : 0), { '#': '#ffcf3a' });
    ctx.fillStyle = '#ff5a7a';
    ctx.fillRect(bx + 15, by + 1 + (b.type === 1 ? 2 : 0), 1, 1);
    ctx.restore();

    const tx = x + 40;
    const barW = w - 46;
    drawText(ctx, b.name, tx, y + 4, { color: '#ffe04a', outline: '#140726' });
    const hpText = b.shown + '/' + b.max;
    drawText(ctx, hpText, x + w - 5, y + 4, { color: '#ffffff', align: 'right' });
    roundRect(ctx, tx, y + 13, barW, 7, 1, '#140726');
    const fill = Math.round((b.shown / b.max) * (barW - 2));
    if (fill > 0) {
      const col = b.shown < b.max * 0.3 ? '#ff5a7a' : '#74e06b';
      roundRect(ctx, tx + 1, y + 14, fill, 5, 0, col);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(tx + 1, y + 14, fill, 1);
    }
    if (b.hitT > 0 && fill > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx + fill - 1, y + 14, 2, 5);
    }
    if (b.shown > 0) {
      const warn = b.attackIn <= 1 && Math.floor(this.time * 4) % 2;
      drawText(ctx, b.attackIn <= 1 ? 'ATTACKS NEXT MOVE!' : 'ATTACKS IN ' + b.attackIn + ' MOVES', tx, y + 24, { color: warn ? '#ff5a7a' : '#c9b6ff' });
    } else {
      drawText(ctx, 'DEFEATED!', tx, y + 24, { color: '#ffe04a' });
    }
  }

  /** Level 1 tutorial: a little hand demonstrates the first swipe. */
  drawHand(ctx) {
    if (this.level.n !== 1 || this.moves !== this.level.moves || this.state !== 'idle' || this.overlay || !this.hint) return;
    const k = (this.time % 1.6) / 1.6;
    if (k > 0.85) return;
    const m = Math.min(1, Math.max(0, (k - 0.2) / 0.45));
    const e = ease(m);
    const [ar, ac] = this.hint.a;
    const [br, bc] = this.hint.b;
    const x = this.boardX + (ac + (bc - ac) * e + 0.5) * this.cell;
    const y = this.boardY + (ar + (br - ar) * e + 0.5) * this.cell;
    const press = k > 0.12 && k < 0.7 ? 1 : 0;
    pattern(ctx, HAND, x - 3, y + 1 + press, { '#': '#1a0b2e', w: '#ffffff' });
    if (press) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3, 3, 1);
    }
  }

  drawBar(ctx) {
    for (const b of this.barButtons) b.draw(ctx, this.time);
    const tip = TIPS[this.tip];
    const midX = this.boardX + Math.floor(this.bw / 2) - 10;
    if (textWidth(tip) < this.bw - 60) drawText(ctx, tip, midX, this.barY + 6, { color: '#ffe9f4', align: 'center', outline: '#2a1a5e' });
  }

  drawOverlay(ctx) {
    const o = this.overlay;
    if (!o) return;
    const cx = Math.floor(this.app.vw / 2);
    const midY = this.boardY + Math.floor(this.bh / 2);
    if (o.kind === 'intro') {
      const slide = o.t < 0.3 ? 1 - o.t / 0.3 : o.t > 2.2 ? (o.t - 2.2) / 0.4 : 0;
      const off = Math.round(slide * slide * this.app.vw * (o.t > 2.2 ? -1 : 1));
      const h = 50 + (this.goals.length ? 18 : 0);
      const y = midY - Math.floor(h / 2);
      panel(ctx, this.boardX - 4 + off, y, this.bw + 8, h, '#ff7eb6', '#140726', 4);
      roundRect(ctx, this.boardX - 2 + off, y + 2, this.bw + 4, h - 4, 3, '#3d2a7f');
      if (this.daily) {
        drawText(ctx, 'DAILY CHALLENGE', cx + off, y - 8, { color: '#ffe9f4', align: 'center', outline: '#140726' });
        drawText(ctx, this.level.title, cx + off, y + 7, { color: '#ffa040', scale: 3, align: 'center', outline: '#140726' });
        drawText(ctx, 'BEST SCORE IN ' + this.level.moves + ' MOVES WINS!', cx + off, y + 30, { color: '#ffffff', align: 'center' });
        return;
      }
      if (this.zen) {
        drawText(ctx, 'ZEN MODE', cx + off, y + 7, { color: '#9fe8ff', scale: 3, align: 'center', outline: '#140726' });
        drawText(ctx, 'NO MOVES, NO GOALS. JUST MONSTERS.', cx + off, y + 30, { color: '#ffffff', align: 'center' });
        return;
      }
      if (!this.boss) drawText(ctx, WORLDS[worldFor(this.level.n)].name, cx + off, y - 8, { color: '#ffe9f4', align: 'center', outline: '#140726' });
      drawText(ctx, 'LEVEL ' + this.level.n, cx + off, y + 7, { color: '#ffe04a', scale: 3, align: 'center', outline: '#140726' });
      const goalText = this.boss ? 'DEFEAT ' + this.boss.name + ' IN ' + this.level.moves + ' MOVES' : 'SCORE ' + this.level.target + ' IN ' + this.level.moves + ' MOVES';
      if (this.boss) drawText(ctx, 'BOSS BATTLE!', cx + off, y - 9, { color: '#ff8fa8', scale: 2, align: 'center', outline: '#140726' });
      if (this.boss) {
        const what = { eggs: 'WATCH OUT: IT LAYS EGGS!', slime: 'WATCH OUT: IT SLIMES MONSTERS!', scramble: 'WATCH OUT: IT SCRAMBLES THINGS!', steal: 'WATCH OUT: IT STEALS MOVES!' }[this.bossKind()];
        drawText(ctx, what, cx + off, y + 40, { color: '#ff8fa8', align: 'center' });
      }
      drawText(ctx, goalText, cx + off, y + 30, {
        color: '#ffffff',
        align: 'center',
      });
      if (this.goals.length) {
        drawText(ctx, 'AND', cx + off - 24, y + 47, { color: '#ffffff', align: 'right' });
        this.goals.forEach((g, i) => {
          const gx = cx + off - 20 + i * 34;
          ctx.drawImage(getSprite(g.type, 'excited'), gx, y + 41);
          drawText(ctx, 'X' + g.count, gx + 17, y + 47, { color: '#ffe04a' });
        });
      }
      return;
    }

    ctx.fillStyle = 'rgba(20,6,40,0.62)';
    ctx.fillRect(0, 0, this.app.vw, this.app.vh);

    if (o.kind === 'tip') {
      const w = Math.min(this.bw + 8, 170);
      const lines = wrapText(o.text, w - 16);
      const h = 64 + lines.length * 8;
      const x = cx - Math.floor(w / 2);
      const pop = o.t < 0.15 ? Math.round((1 - o.t / 0.15) * 8) : 0;
      const y = midY - Math.floor(h / 2) + pop;
      panel(ctx, x, y, w, h, '#3d2a7f', '#140726', 4);
      roundRect(ctx, x + 2, y + 2, w - 4, 3, 1, '#ff7eb6');
      drawText(ctx, 'NEW!', x + 6, y + 8, { color: '#ff8fc0', outline: '#140726' });
      drawText(ctx, o.title, cx, y + 9, { color: '#ffe04a', scale: 2, align: 'center', outline: '#140726' });
      const t = o.tile;
      const variant = t.special === 'lineH' ? 'lh' : t.special === 'lineV' ? 'lv' : t.special === 'bomb' ? (Math.floor(this.time * 6) % 2 ? 'b0' : 'b1') : t.hp === 1 ? 'e1' : 'n';
      const frame = t.type < 0 ? Math.floor(this.time * 12) % RAINBOW_FRAMES : 0;
      const hop = Math.round(Math.min(0, Math.sin(this.time * 5)) * 4);
      ctx.drawImage(getSprite(t.type, 'excited', 0, 0, variant, frame), cx - 16, y + 23 + hop, 32, 32);
      lines.forEach((line, i) => drawText(ctx, line, cx, y + 59 + i * 8, { color: '#ffffff', align: 'center' }));
      if (o.t > 0.5 && Math.floor(this.time * 2) % 2) {
        drawText(ctx, 'TAP TO CONTINUE', cx, y + h + 4, { color: '#ffe9f4', align: 'center', outline: '#140726' });
      }
      return;
    }
    if (o.kind === 'pause') {
      const y = this.boardY + 6;
      panel(ctx, cx - 56, y, 112, 152, '#3d2a7f', '#140726', 4);
      drawText(ctx, 'PAUSED', cx, y + 10, { color: '#ffffff', scale: 3, align: 'center', outline: '#140726' });
    } else if (o.kind === 'win') {
      const y = midY - 62;
      panel(ctx, cx - 64, y, 128, 136, '#3d2a7f', '#140726', 4);
      const bob = Math.round(Math.sin(this.time * 4) * 2);
      drawText(ctx, o.word, cx, y + 8 + bob, { color: '#ffe04a', scale: 3, align: 'center', outline: '#140726' });
      for (let i = 0; i < 3; i++) {
        const sx = cx - 34 + i * 25;
        const lit = i < o.shown;
        let sy = y + 30 + (i === 1 ? -3 : 0);
        // freshly landed stars slam down from above
        const since = lit ? o.t - o.starT[i] : 1;
        if (since < 0.15) sy -= Math.round((1 - since / 0.15) * 10);
        iconOutlined(ctx, 'bigstar', sx, sy, lit ? '#ffe04a' : '#5a4a78', '#140726', 2);
        if (lit) {
          ctx.fillStyle = '#fff6b0';
          ctx.fillRect(sx + 8, sy + 6, 2, 2);
        }
      }
      drawText(ctx, 'SCORE ' + o.count, cx, y + 54, { color: '#ffffff', align: 'center' });
      if (o.newBest && o.t > 1 && Math.floor(this.time * 3) % 2) drawText(ctx, 'NEW BEST!', cx, y + 62, { color: '#ffe04a', align: 'center' });
      else drawText(ctx, 'BEST ' + o.best, cx, y + 62, { color: '#c9b6ff', align: 'center' });
      // a little conga line of happy monsters
      for (let i = 0; i < 5; i++) {
        const type = (this.level.n + i) % 6;
        const hop = Math.round(Math.min(0, Math.sin(this.time * 7 - i * 0.9)) * 5);
        ctx.drawImage(getSprite(type, i % 2 ? 'happy' : 'excited'), cx - 48 + i * 20, y + 74 + hop);
      }
    } else if (o.kind === 'daily') {
      const y = midY - 62;
      panel(ctx, cx - 64, y, 128, 136, '#3d2a7f', '#140726', 4);
      drawText(ctx, 'ALL DONE!', cx, y + 8, { color: '#ffa040', scale: 2, align: 'center', outline: '#140726' });
      drawText(ctx, String(this.score), cx, y + 26, { color: '#ffe04a', scale: 3, align: 'center', outline: '#140726' });
      if (o.isBest && Math.floor(this.time * 3) % 2) drawText(ctx, 'NEW BEST!', cx, y + 46, { color: '#ffffff', align: 'center' });
      else drawText(ctx, 'BEST TODAY ' + o.best, cx, y + 46, { color: '#c9b6ff', align: 'center' });
      drawText(ctx, 'STREAK: ' + o.streak + (o.streak === 1 ? ' DAY' : ' DAYS'), cx, y + 58, { color: '#ffffff', align: 'center' });
      for (let i = 0; i < Math.min(5, o.streak); i++) {
        const hop = Math.round(Math.min(0, Math.sin(this.time * 6 - i)) * 4);
        ctx.drawImage(getSprite(i % 6, 'happy'), cx - Math.min(5, o.streak) * 10 + i * 20 + 2, y + 68 + hop);
      }
    } else if (o.kind === 'lose') {
      const y = midY - 74;
      const h = 78 + this.overlayButtons.length * 22;
      panel(ctx, cx - 66, y, 132, h, '#3d2a7f', '#140726', 4);
      // how close was it?
      const parts = [Math.min(1, this.score / Math.max(1, this.level.target))];
      for (const g of this.goals) parts.push(1 - Math.max(0, g.left) / g.count);
      if (this.boss) parts.push(1 - this.boss.hp / this.boss.max);
      const progress = parts.reduce((a, b) => a + b, 0) / parts.length;
      const close = progress >= 0.8;
      drawText(ctx, close ? 'SO CLOSE!' : 'OUT OF MOVES!', cx, y + 7, { color: '#ff8fa8', scale: 2, align: 'center', outline: '#140726' });
      const type = this.level.n % 6;
      const s = getSprite(type, Math.floor(this.time * 1.5) % 4 === 3 ? 'blink' : 'sad');
      ctx.drawImage(s, cx - 12, y + 21, 24, 24);
      if (Math.floor(this.time * 2) % 2) {
        ctx.fillStyle = '#8fe3ff';
        ctx.fillRect(cx - 7, y + 43, 2, 2);
      }
      let line = y + 50;
      if (this.boss) {
        drawText(ctx, this.boss.name + ' HP ' + this.boss.hp, cx, line, { color: '#ffffff', align: 'center' });
        line += 9;
      } else {
        const sc = this.score >= this.level.target ? '#74e06b' : '#ffffff';
        drawText(ctx, 'SCORE ' + this.score + '/' + this.level.target, cx, line, { color: sc, align: 'center' });
        line += 9;
      }
      const left = this.goals.filter((g) => g.left > 0);
      if (left.length) {
        const wTot = left.length * 30;
        left.forEach((g, i) => {
          const gx = cx - Math.floor(wTot / 2) + i * 30;
          ctx.drawImage(getSprite(g.type, 'sad'), gx, line - 4, 12, 12);
          drawText(ctx, String(g.left), gx + 14, line, { color: '#ff8fa8' });
        });
      }
    }
    for (const b of this.overlayButtons) b.draw(ctx, this.time);
  }
}
