// Boots the game: sets up the pixel canvas, input, audio and screens.
import { Sound } from './audio.js';
import { Background, worldFor } from './background.js';
import { Game } from './game.js';
import { Title } from './title.js';
import { LevelMap } from './map.js';
import { Book } from './book.js';
import { Settings } from './settings.js';
import { checkStickers } from './stickers.js';
import { HATS, hatUnlocked, drawHat } from './hats.js';
import { getSprite } from './sprites.js';
import { drawText, panel } from './pixel.js';
import { load, save } from './storage.js';

const canvas = document.getElementById('screen');
const display = canvas.getContext('2d');
// Where the browser can upscale with crisp pixels, the canvas is the
// low-res buffer and CSS (the GPU) scales it. Otherwise we draw into an
// offscreen low-res canvas and upscale it ourselves every frame.
const cssScaling = !!(window.CSS && CSS.supports && CSS.supports('image-rendering', 'pixelated'));
const low = cssScaling ? canvas : document.createElement('canvas');
const ctx = cssScaling ? display : low.getContext('2d');
if (cssScaling) canvas.style.imageRendering = 'pixelated';
const safeProbe = document.getElementById('safe-area');

const app = {
  vw: 180,
  vh: 320,
  scale: 1,
  ox: 0,
  oy: 0,
  safeTop: 0,
  safeBottom: 0,
  pointer: { x: 0, y: 0, active: false, down: false, lastMove: 0 },
  settings: load(),
  audio: new Sound(),
  background: new Background(),
  screen: null,
  game: null,

  persist() {
    save(this.settings);
  },
  toasts: [],
  /** Award any newly earned stickers with a toast. */
  checkStickers() {
    const fresh = checkStickers(this.settings);
    const seen = (this.settings.hatsSeen = this.settings.hatsSeen || { none: 1 });
    for (const hat of HATS) {
      if (!seen[hat.id] && hatUnlocked(hat, this.settings)) {
        seen[hat.id] = 1;
        fresh.push({ name: hat.name, hat: hat.id, icon: [0, 'happy'] });
      }
    }
    if (!fresh.length) return;
    this.persist();
    for (const st of fresh) this.toasts.push({ st, t: -this.toasts.length * 2.6 });
  },
  drawToasts(ctx, dt) {
    const t0 = this.toasts[0];
    if (!t0) return;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.6);
    for (const t of this.toasts) {
      if (t.t < 0) continue;
      if (!t.sounded) {
        t.sounded = true;
        this.audio.special(1.3);
        this.buzz(20);
      }
      const k = t.t < 0.25 ? t.t / 0.25 : t.t > 2.3 ? (2.6 - t.t) / 0.3 : 1;
      const w = 150;
      const x = Math.floor((this.vw - w) / 2);
      const y = Math.round(this.safeTop + 4 - (1 - k) * 40);
      panel(ctx, x, y, w, 26, '#ffe04a', '#140726', 4);
      panel(ctx, x + 2, y + 2, w - 4, 22, '#3d2a7f', null, 3);
      const [type, expr, variant] = t.st.icon;
      ctx.drawImage(getSprite(type, expr, 0, 0, variant || 'n'), x + 5, y + 5);
      if (t.st.hat) drawHat(ctx, t.st.hat, type, x + 5, y + 5, 16, 16);
      drawText(ctx, t.st.hat ? 'NEW HAT! SEE BOOK' : 'STICKER GET!', x + 25, y + 5, { color: '#ffe04a' });
      drawText(ctx, t.st.name, x + 25, y + 14, { color: '#ffffff' });
    }
  },
  buzz(pattern) {
    if (this.settings.haptics !== false && navigator.vibrate) navigator.vibrate(pattern);
  },
  toSettings() {
    this.screen = new Settings(this);
  },
  resetProgress() {
    const keep = { sfx: this.settings.sfx, music: this.settings.music, haptics: this.settings.haptics, shake: this.settings.shake };
    this.settings = { ...load(true), ...keep };
    this.persist();
  },
  toggleSfx() {
    this.settings.sfx = !this.settings.sfx;
    this.audio.setSfx(this.settings.sfx);
    this.persist();
  },
  toggleMusic() {
    this.settings.music = !this.settings.music;
    this.audio.setMusic(this.settings.music);
    this.persist();
  },
  setWorld(level) {
    this.background.setTheme(worldFor(level));
  },
  play(level) {
    this.setWorld(level === 'zen' ? 21 : level === 'daily' ? 31 : level);
    this.game = new Game(this);
    this.game.start(level);
    this.screen = this.game;
  },
  toTitle() {
    this.persist();
    this.setWorld(this.settings.level);
    this.audio.setSong('title');
    this.screen = new Title(this);
  },
  toBook() {
    this.audio.setSong('title');
    this.screen = new Book(this);
  },
  toMap(focus) {
    this.setWorld(focus || this.settings.level);
    this.audio.setSong('title');
    this.screen = new LevelMap(this, focus);
  },
};

// Screen changes go through a quick dithered pixel wipe.
const direct = {};
for (const name of ['play', 'toTitle', 'toBook', 'toMap', 'toSettings']) {
  direct[name] = app[name].bind(app);
  app[name] = (...args) => app.transition(() => direct[name](...args));
}
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const WIPE = 0.2;
app.transition = function (fn) {
  if (this.wipe) {
    fn();
    return;
  }
  this.wipe = { t: 0, fn };
};
app.drawWipe = function (ctx, dt) {
  const w = this.wipe;
  if (!w) return;
  w.t += dt;
  if (w.fn && w.t >= WIPE) {
    const fn = w.fn;
    w.fn = null;
    fn();
  }
  const cover = w.t < WIPE ? w.t / WIPE : 1 - (w.t - WIPE) / WIPE;
  if (w.t >= WIPE * 2) {
    this.wipe = null;
    return;
  }
  ctx.fillStyle = '#1a0b2e';
  const n = cover * 16;
  for (let y = 0; y < this.vh; y += 4) {
    for (let x = 0; x < this.vw; x += 4) {
      if (BAYER4[(y >> 2) & 3][(x >> 2) & 3] < n) ctx.fillRect(x, y, 4, 4);
    }
  }
};

app.audio.sfxOn = app.settings.sfx;
app.audio.musicOn = app.settings.music;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(window.innerWidth * dpr);
  const H = Math.round(window.innerHeight * dpr);
  if (!cssScaling) {
    canvas.width = W;
    canvas.height = H;
  }
  // Pick a whole-number pixel scale so a 8x8 board of 16px monsters fits.
  const scale = Math.max(1, Math.floor(Math.min(W / 172, H / 268)));
  app.scale = scale;
  app.vw = Math.ceil(W / scale);
  app.vh = Math.ceil(H / scale);
  app.ox = Math.floor((W - app.vw * scale) / 2);
  app.oy = Math.floor((H - app.vh * scale) / 2);
  const cs = getComputedStyle(safeProbe);
  app.safeTop = Math.ceil((parseFloat(cs.paddingTop) || 0) * dpr / scale);
  app.safeBottom = Math.ceil((parseFloat(cs.paddingBottom) || 0) * dpr / scale);
  low.width = app.vw;
  low.height = app.vh;
  if (cssScaling) {
    Object.assign(canvas.style, {
      left: app.ox / dpr + 'px',
      top: app.oy / dpr + 'px',
      width: (app.vw * scale) / dpr + 'px',
      height: (app.vh * scale) / dpr + 'px',
    });
  }
  ctx.imageSmoothingEnabled = false;
  display.imageSmoothingEnabled = false;
  app.background.resize(app.vw, app.vh);
  if (app.game) app.game.layout();
  if (app.screen && app.screen.layout && app.screen !== app.game) app.screen.layout();
}

function toVirtual(e) {
  const rect = canvas.getBoundingClientRect();
  const k = canvas.width / rect.width;
  if (cssScaling) return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  return {
    x: ((e.clientX - rect.left) * k - app.ox) / app.scale,
    y: ((e.clientY - rect.top) * k - app.oy) / app.scale,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  app.audio.unlock();
  canvas.setPointerCapture?.(e.pointerId);
  const p = toVirtual(e);
  Object.assign(app.pointer, p, { active: true, down: true, lastMove: performance.now() });
  if (!app.wipe) app.screen.pointerDown(p.x, p.y);
});
canvas.addEventListener('pointermove', (e) => {
  const p = toVirtual(e);
  Object.assign(app.pointer, p, { active: app.pointer.down || e.pointerType === 'mouse', lastMove: performance.now() });
  app.screen.pointerMove(p.x, p.y);
});
const end = (e) => {
  const p = toVirtual(e);
  app.pointer.down = false;
  if (e.pointerType !== 'mouse') app.pointer.active = false;
  app.screen.pointerUp(p.x, p.y);
};
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') app.pointer.active = false;
});
canvas.addEventListener(
  'wheel',
  (e) => {
    if (app.screen.wheel) {
      e.preventDefault();
      app.screen.wheel(e.deltaY / app.scale);
    }
  },
  { passive: false }
);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.screen === app.game) app.game.overlay ? app.game.resume() : app.game.pause();
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ?speed=N runs the game faster (handy for automated play-testing).
const speed = Math.min(8, Math.max(0.25, Number(new URLSearchParams(location.search).get('speed')) || 1));
let last = performance.now();
let time = 0;
function frame(now) {
  const real = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  time += real;
  if (app.pointer.active && !app.pointer.down && now - app.pointer.lastMove > 2500) app.pointer.active = false;
  for (let i = 0; i < speed; i++) app.screen.update(real);
  app.background.draw(ctx, time);
  app.screen.render(ctx);
  app.drawToasts(ctx, real * speed);
  app.drawWipe(ctx, real);
  if (!cssScaling) display.drawImage(low, app.ox, app.oy, app.vw * app.scale, app.vh * app.scale);
  requestAnimationFrame(frame);
}

resize();
direct.toTitle();
window.__monsterPop = app; // handy for debugging from the console
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
