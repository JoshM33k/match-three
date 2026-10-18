// Boots the game: sets up the pixel canvas, input, audio and screens.
import { Sound } from './audio.js';
import { Background, worldFor } from './background.js';
import { Game } from './game.js';
import { Title } from './title.js';
import { LevelMap } from './map.js';
import { Book } from './book.js';
import { Settings } from './settings.js';
import { load, save } from './storage.js';

const canvas = document.getElementById('screen');
const display = canvas.getContext('2d');
const low = document.createElement('canvas');
const ctx = low.getContext('2d');
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
    this.setWorld(level === 'zen' ? 1 : level);
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

app.audio.sfxOn = app.settings.sfx;
app.audio.musicOn = app.settings.music;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(window.innerWidth * dpr);
  const H = Math.round(window.innerHeight * dpr);
  canvas.width = W;
  canvas.height = H;
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
  ctx.imageSmoothingEnabled = false;
  display.imageSmoothingEnabled = false;
  app.background.resize(app.vw, app.vh);
  if (app.game) app.game.layout();
  if (app.screen && app.screen.layout && app.screen !== app.game) app.screen.layout();
}

function toVirtual(e) {
  const rect = canvas.getBoundingClientRect();
  const k = canvas.width / rect.width;
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
  app.screen.pointerDown(p.x, p.y);
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
  display.drawImage(low, app.ox, app.oy, app.vw * app.scale, app.vh * app.scale);
  requestAnimationFrame(frame);
}

resize();
app.toTitle();
window.__monsterPop = app; // handy for debugging from the console
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
