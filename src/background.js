// Dithered pixel sky with drifting clouds, twinkling stars and hills full
// of shy blinking eyes.

// One theme per world (ten levels each), cycling after the last.
export const WORLDS = [
  {
    name: 'TWILIGHT HILLS',
    sky: ['#2a1a5e', '#3d2a7f', '#58399e', '#7a4cb8', '#a35ec4', '#cf72c8', '#f08ac4', '#ffa9c6'],
    hills: ['#7b3d9e', '#5a2a80', '#3e1b62'],
    cloud: '255,220,250',
    eyes: '#ffe9a8',
  },
  {
    name: 'MINT MEADOW',
    sky: ['#16324a', '#1d4a5a', '#24656a', '#2f8274', '#4aa07e', '#74bc88', '#a6d898', '#dcf0b4'],
    hills: ['#3f8a5a', '#2c6a48', '#1c4a36'],
    cloud: '230,255,235',
    eyes: '#fff6a8',
  },
  {
    name: 'STARRY SEA',
    sky: ['#070c2a', '#0e1a46', '#162a64', '#1f3e84', '#2c58a2', '#4478bc', '#689ed4', '#9cc8ea'],
    hills: ['#24508e', '#1a3a70', '#102650'],
    cloud: '210,230,255',
    eyes: '#a8f0ff',
  },
  {
    name: 'CANDY CLOUDS',
    sky: ['#4a2066', '#6a2e84', '#8e3ea0', '#b052b2', '#d070c0', '#e894ca', '#f6b8d8', '#ffdcea'],
    hills: ['#e070b0', '#b04a90', '#803070'],
    cloud: '255,240,250',
    eyes: '#ffffff',
  },
  {
    name: 'EMBER PEAKS',
    sky: ['#1e0814', '#3a0e1c', '#5a1620', '#7c2422', '#a23e26', '#c4622c', '#e09038', '#f4c464'],
    hills: ['#7a2a24', '#561a1c', '#360e14'],
    cloud: '255,200,170',
    eyes: '#ffd060',
  },
];

export const worldFor = (level) => Math.floor((Math.max(1, level) - 1) / 10) % WORLDS.length;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const CLOUD = [
  '....####......',
  '..########....',
  '.###########..',
  '##############',
  '.############.',
];

export class Background {
  constructor() {
    this.theme = 0;
    this.w = 0;
    this.h = 0;
    this.sky = null;
    this.stars = [];
    this.clouds = [];
    this.eyes = [];
  }

  setTheme(i) {
    if (i === this.theme) return;
    this.theme = i;
    const { w, h } = this;
    this.w = 0;
    if (w) this.resize(w, h);
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const SKY = WORLDS[this.theme].sky;
    this.w = w;
    this.h = h;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const t = (y / h) * (SKY.length - 1);
      const i = Math.floor(t);
      const f = t - i;
      for (let x = 0; x < w; x++) {
        const threshold = (BAYER[y & 3][x & 3] + 0.5) / 16;
        g.fillStyle = SKY[Math.min(SKY.length - 1, f > threshold ? i + 1 : i)];
        g.fillRect(x, y, 1, 1);
      }
    }
    this.hillTop = this.drawHills(g, w, h);
    this.sky = c;

    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.stars = Array.from({ length: Math.floor((w * h) / 900) }, () => ({
      x: Math.floor(rnd() * w),
      y: Math.floor(rnd() * h * 0.55),
      p: rnd() * Math.PI * 2,
      s: 0.6 + rnd() * 2,
    }));
    this.clouds = Array.from({ length: 4 + Math.floor(w / 120) }, (_, i) => ({
      x: rnd() * w,
      y: Math.floor(h * 0.12 + rnd() * h * 0.45),
      v: 2 + rnd() * 4,
      a: 0.25 + (i % 3) * 0.1,
    }));
  }

  drawHills(g, w, h) {
    const layers = [
      { base: h - 34, amp: 7, freq: 0.045, color: WORLDS[this.theme].hills[0], ph: 0.5 },
      { base: h - 20, amp: 6, freq: 0.06, color: WORLDS[this.theme].hills[1], ph: 2.1 },
      { base: h - 9, amp: 4, freq: 0.08, color: WORLDS[this.theme].hills[2], ph: 4.0 },
    ];
    this.eyes = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const L of layers) {
      for (let x = 0; x < w; x++) {
        const top = Math.round(L.base - Math.abs(Math.sin(x * L.freq + L.ph)) * L.amp);
        g.fillStyle = L.color;
        g.fillRect(x, top, 1, h - top);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x, top, 1, 1);
      }
      // a couple of pairs of eyes peeking out of each hill layer
      for (let i = 0; i < Math.max(1, Math.floor(w / 90)); i++) {
        const x = Math.floor(10 + rnd() * (w - 20));
        const top = Math.round(L.base - Math.abs(Math.sin(x * L.freq + L.ph)) * L.amp);
        if (top + 6 < h) this.eyes.push({ x, y: top + 4, p: rnd() * 10, period: 3 + rnd() * 4 });
      }
    }
    return layers[0].base - layers[0].amp;
  }

  draw(ctx, time) {
    ctx.drawImage(this.sky, 0, 0);
    for (const s of this.stars) {
      const tw = Math.sin(time * s.s + s.p);
      if (tw > 0.3) {
        ctx.fillStyle = tw > 0.85 ? '#ffffff' : 'rgba(255,255,255,0.6)';
        ctx.fillRect(s.x, s.y, 1, 1);
        if (tw > 0.95) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(s.x - 1, s.y, 1, 1);
          ctx.fillRect(s.x + 1, s.y, 1, 1);
          ctx.fillRect(s.x, s.y - 1, 1, 1);
          ctx.fillRect(s.x, s.y + 1, 1, 1);
        }
      }
    }
    for (const c of this.clouds) {
      const x = Math.round(((c.x + time * c.v) % (this.w + 40)) - 20);
      ctx.fillStyle = `rgba(${WORLDS[this.theme].cloud},${c.a})`;
      for (let r = 0; r < CLOUD.length; r++) {
        for (let i = 0; i < CLOUD[r].length; i++) {
          if (CLOUD[r][i] === '#') ctx.fillRect(x + i * 2, c.y + r * 2, 2, 2);
        }
      }
    }
    for (const e of this.eyes) {
      const t = (time + e.p) % e.period;
      if (t < 0.15 || t > e.period - 0.3) continue; // blink / hide
      const look = Math.sin((time + e.p) * 0.7) > 0.5 ? 1 : 0;
      ctx.fillStyle = WORLDS[this.theme].eyes;
      ctx.fillRect(e.x, e.y, 2, 2);
      ctx.fillRect(e.x + 4, e.y, 2, 2);
      ctx.fillStyle = '#1a0b2e';
      ctx.fillRect(e.x + look, e.y + 1, 1, 1);
      ctx.fillRect(e.x + 4 + look, e.y + 1, 1, 1);
    }
  }
}
