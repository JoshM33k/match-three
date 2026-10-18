// All sound is synthesised with WebAudio: monster voices, effects and a
// little chiptune loop. Nothing to download.

const VOICES = [
  // 0 Bloop: squishy pink slime — bloopy sine drops.
  {
    select: [{ wave: 'sine', f: [[0, 520], [0.1, 950]], dur: 0.12, vol: 0.35 }],
    match: [
      { wave: 'sine', f: [[0, 950], [0.13, 260]], dur: 0.15, vol: 0.4 },
      { wave: 'sine', f: [[0, 1150], [0.13, 320]], dur: 0.15, vol: 0.35, at: 0.11 },
    ],
    sad: [
      { wave: 'sine', f: [[0, 620], [0.1, 520]], dur: 0.12, vol: 0.35 },
      { wave: 'sine', f: [[0, 480], [0.2, 260]], dur: 0.22, vol: 0.35, at: 0.15 },
    ],
    land: [{ wave: 'sine', f: [[0, 340], [0.05, 200]], dur: 0.06, vol: 0.12 }],
  },
  // 1 Grumble: horned purple — rumbly growls.
  {
    select: [{ wave: 'sawtooth', f: [[0, 140], [0.16, 200]], dur: 0.18, vol: 0.3, lp: 900, trem: [28, 0.6] }],
    match: [
      { wave: 'sawtooth', f: [[0, 105], [0.12, 175], [0.34, 120]], dur: 0.36, vol: 0.42, formants: [700, 1150], trem: [32, 0.7] },
    ],
    sad: [{ wave: 'sawtooth', f: [[0, 170], [0.3, 105]], dur: 0.32, vol: 0.35, lp: 700, trem: [18, 0.6] }],
    land: [{ wave: 'triangle', f: [[0, 160], [0.06, 90]], dur: 0.07, vol: 0.14 }],
  },
  // 2 Ogle: green cyclops — gurgly blibbles.
  {
    select: [{ wave: 'square', f: [[0, 420], [0.12, 620]], dur: 0.13, vol: 0.18, lp: 1800, vib: [26, 70] }],
    match: [{ wave: 'square', f: [[0, 300], [0.3, 560]], dur: 0.32, vol: 0.2, lp: 2200, q: 4, vib: [18, 160] }],
    sad: [{ wave: 'square', f: [[0, 360], [0.3, 190]], dur: 0.32, vol: 0.18, lp: 1200, vib: [12, 50] }],
    land: [{ wave: 'square', f: [[0, 300], [0.05, 220]], dur: 0.05, vol: 0.06, lp: 900 }],
  },
  // 3 Fuzz: orange furball — tiny "rawr!"
  {
    select: [{ wave: 'sawtooth', f: [[0, 270], [0.13, 360]], dur: 0.15, vol: 0.28, formants: [800, 1250] }],
    match: [{ wave: 'sawtooth', f: [[0, 230], [0.1, 340], [0.32, 200]], dur: 0.34, vol: 0.38, formants: [760, 1180], vib: [7, 12] }],
    sad: [{ wave: 'sawtooth', f: [[0, 290], [0.3, 180]], dur: 0.32, vol: 0.3, formants: [420, 900] }],
    land: [{ wave: 'triangle', f: [[0, 260], [0.05, 160]], dur: 0.06, vol: 0.12 }],
  },
  // 4 Boo: blue ghost — wobbly "wooo"
  {
    select: [{ wave: 'triangle', f: [[0, 520], [0.18, 720]], dur: 0.2, vol: 0.32, vib: [7, 22] }],
    match: [{ wave: 'triangle', f: [[0, 400], [0.22, 680], [0.5, 430]], dur: 0.52, vol: 0.38, vib: [6, 36], attack: 0.06 }],
    sad: [{ wave: 'triangle', f: [[0, 520], [0.45, 300]], dur: 0.46, vol: 0.32, vib: [5, 22], attack: 0.04 }],
    land: [{ wave: 'sine', f: [[0, 420], [0.06, 300]], dur: 0.07, vol: 0.1 }],
  },
  // 5 Zap: yellow star — "pip pip pip!"
  {
    select: [{ wave: 'square', f: [[0, 1200], [0.06, 1550]], dur: 0.07, vol: 0.14, lp: 4000 }],
    match: [
      { wave: 'square', f: [[0, 1000], [0.06, 1400]], dur: 0.07, vol: 0.14, lp: 4000 },
      { wave: 'square', f: [[0, 1300], [0.06, 1800]], dur: 0.07, vol: 0.14, lp: 4000, at: 0.08 },
      { wave: 'square', f: [[0, 1600], [0.06, 2200]], dur: 0.08, vol: 0.14, lp: 4000, at: 0.16 },
    ],
    sad: [
      { wave: 'square', f: [[0, 900], [0.07, 720]], dur: 0.08, vol: 0.14, lp: 3000 },
      { wave: 'square', f: [[0, 780], [0.12, 480]], dur: 0.13, vol: 0.14, lp: 3000, at: 0.11 },
    ],
    land: [{ wave: 'square', f: [[0, 900], [0.03, 700]], dur: 0.035, vol: 0.05, lp: 2500 }],
  },
];

// Four-bar loops of eighth notes (MIDI numbers, 0 = rest).
const SONGS = {
  title: {
    bpm: 116,
    lead: 'square',
    leadVol: 0.16,
    lp: 2400,
    octaveUp: true,
    roots: [48, 45, 41, 43],
    bass: [0, null, 12, null, 7, null, 12, 7],
    mel: [72, 0, 76, 79, 76, 0, 74, 72, 69, 0, 72, 76, 74, 72, 69, 0, 65, 69, 72, 0, 74, 72, 69, 67, 67, 0, 71, 74, 79, 0, 77, 74],
  },
  game: {
    bpm: 124,
    lead: 'square',
    leadVol: 0.13,
    lp: 2000,
    octaveUp: false,
    roots: [43, 40, 48, 50],
    bass: [0, null, 7, 12, null, 7, 12, null],
    mel: [79, 0, 78, 76, 74, 0, 76, 79, 76, 0, 74, 71, 72, 74, 76, 0, 72, 76, 79, 0, 81, 79, 76, 74, 74, 0, 78, 81, 78, 0, 74, 0],
  },
  boss: {
    bpm: 144,
    lead: 'sawtooth',
    leadVol: 0.1,
    lp: 1800,
    octaveUp: false,
    drive: true,
    roots: [45, 41, 43, 40],
    bass: [0, 12, 0, 12, 0, 12, 7, 12],
    mel: [69, 72, 76, 72, 81, 0, 79, 76, 77, 0, 76, 72, 74, 0, 72, 69, 71, 74, 79, 74, 83, 0, 81, 79, 76, 0, 80, 83, 88, 0, 83, 80],
  },
};

// Alternate match phrases (picked at random with the original) and a
// "wheee" for long drops, per species.
const EXTRA = [
  {
    match: [
      [
        { wave: 'sine', f: [[0, 1200], [0.08, 500]], dur: 0.09, vol: 0.35 },
        { wave: 'sine', f: [[0, 1000], [0.08, 420]], dur: 0.09, vol: 0.32, at: 0.08 },
        { wave: 'sine', f: [[0, 820], [0.1, 300]], dur: 0.11, vol: 0.3, at: 0.16 },
      ],
      [{ wave: 'sine', f: [[0, 380], [0.08, 300], [0.2, 900]], dur: 0.22, vol: 0.38 }],
    ],
    whee: [{ wave: 'sine', f: [[0, 400], [0.35, 1300]], dur: 0.38, vol: 0.25, vib: [9, 30] }],
  },
  {
    match: [
      [{ wave: 'sawtooth', f: [[0, 190], [0.12, 95]], dur: 0.14, vol: 0.4, formants: [500, 900], trem: [40, 0.5] }],
      [
        { wave: 'sawtooth', f: [[0, 110], [0.12, 140]], dur: 0.14, vol: 0.38, lp: 900, trem: [30, 0.7] },
        { wave: 'sawtooth', f: [[0, 130], [0.14, 170]], dur: 0.16, vol: 0.38, lp: 900, trem: [30, 0.7], at: 0.17 },
      ],
    ],
    whee: [{ wave: 'sawtooth', f: [[0, 120], [0.4, 260]], dur: 0.42, vol: 0.3, formants: [600, 1000], trem: [24, 0.4] }],
  },
  {
    match: [
      [
        { wave: 'square', f: [[0, 500]], dur: 0.07, vol: 0.18, lp: 2000 },
        { wave: 'square', f: [[0, 330]], dur: 0.09, vol: 0.18, lp: 2000, at: 0.08 },
      ],
      [{ wave: 'square', f: [[0, 260], [0.4, 700]], dur: 0.42, vol: 0.17, lp: 2400, q: 6, vib: [24, 120] }],
    ],
    whee: [{ wave: 'square', f: [[0, 300], [0.4, 1000]], dur: 0.42, vol: 0.14, lp: 2600, vib: [20, 80] }],
  },
  {
    match: [
      [{ wave: 'sawtooth', f: [[0, 420], [0.06, 640], [0.16, 520]], dur: 0.18, vol: 0.32, formants: [900, 1600] }],
      [{ wave: 'sawtooth', f: [[0, 200], [0.3, 330], [0.45, 210]], dur: 0.46, vol: 0.36, formants: [700, 1150], trem: [26, 0.35] }],
    ],
    whee: [{ wave: 'sawtooth', f: [[0, 300], [0.36, 800]], dur: 0.38, vol: 0.28, formants: [800, 1400] }],
  },
  {
    match: [
      [
        { wave: 'triangle', f: [[0, 380], [0.15, 420]], dur: 0.17, vol: 0.34, vib: [6, 20] },
        { wave: 'triangle', f: [[0, 560], [0.25, 620]], dur: 0.27, vol: 0.36, vib: [6, 30], at: 0.18 },
      ],
      [
        { wave: 'triangle', f: [[0, 900], [0.05, 800]], dur: 0.06, vol: 0.3 },
        { wave: 'triangle', f: [[0, 1000], [0.05, 880]], dur: 0.07, vol: 0.3, at: 0.1 },
      ],
    ],
    whee: [{ wave: 'triangle', f: [[0, 350], [0.45, 950]], dur: 0.48, vol: 0.3, vib: [6, 40], attack: 0.05 }],
  },
  {
    match: [
      [{ wave: 'square', f: [[0, 1760], [0.3, 1700]], dur: 0.32, vol: 0.12, lp: 5000 }],
      [0, 1, 2, 3].map((i) => ({ wave: 'square', f: [[0, 1300 + i * 150], [0.04, 1600 + i * 150]], dur: 0.045, vol: 0.12, lp: 4500, at: i * 0.06 })),
    ],
    whee: [{ wave: 'square', f: [[0, 800], [0.3, 2200]], dur: 0.32, vol: 0.1, lp: 5000 }],
  },
];
EXTRA.forEach((x, i) => {
  VOICES[i].matches = [VOICES[i].match, ...x.match];
  VOICES[i].whee = x.whee;
});

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.lastPlayed = new Map();
    this.music = { step: 0, next: 0, timer: null, song: 'title', want: 'title' };
  }

  /** Must be called from a user gesture before anything is audible. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.8 : 0;
      this.sfx.connect(comp);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.16 : 0;
      this.musicBus.connect(comp);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1);
    if (on) this.startMusic();
    else this.stopMusic();
  }

  ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  /** Avoid machine-gunning the same sound: returns false if played too recently. */
  throttle(name, gap) {
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) || 0) < gap * 1000) return false;
    this.lastPlayed.set(name, now);
    return true;
  }

  tone(spec, pitch = 1, when = 0, bus = this.sfx) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when + (spec.at || 0);
    const dur = spec.dur;
    const osc = ctx.createOscillator();
    osc.type = spec.wave;
    const pts = spec.f;
    osc.frequency.setValueAtTime(pts[0][1] * pitch, t0);
    for (let i = 1; i < pts.length; i++) {
      osc.frequency.exponentialRampToValueAtTime(pts[i][1] * pitch, t0 + pts[i][0]);
    }
    const nodes = [osc];
    if (spec.vib) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = spec.vib[0];
      depth.gain.value = spec.vib[1] * pitch;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }

    let node = osc;
    if (spec.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = spec.lp;
      f.Q.value = spec.q || 1;
      node.connect(f);
      node = f;
    }
    if (spec.formants) {
      const sum = ctx.createGain();
      sum.gain.value = 1.4;
      for (const fr of spec.formants) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fr;
        bp.Q.value = 5;
        node.connect(bp).connect(sum);
      }
      const dry = ctx.createGain();
      dry.gain.value = 0.25;
      node.connect(dry).connect(sum);
      node = sum;
    }
    if (spec.trem) {
      const am = ctx.createGain();
      am.gain.value = 1 - spec.trem[1];
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.type = 'square';
      lfo.frequency.value = spec.trem[0];
      depth.gain.value = spec.trem[1];
      lfo.connect(depth).connect(am.gain);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
      node.connect(am);
      node = am;
    }
    const env = ctx.createGain();
    const attack = spec.attack || 0.008;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(spec.vol, t0 + attack);
    env.gain.setValueAtTime(spec.vol, t0 + Math.max(attack, dur * 0.6));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(env).connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return nodes;
  }

  noise({ dur, vol, type = 'lowpass', f0 = 2000, f1 = f0, q = 1, when = 0 }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t0);
    filt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(env).connect(this.sfx);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  /** A monster noise. mood: 'select' | 'match' | 'sad' | 'land'. */
  monster(type, mood, pitch = 1, when = 0) {
    if (!this.ready() || !this.sfxOn) return;
    if (type < 0) {
      this.sparkle(pitch, when);
      return;
    }
    const gap = mood === 'land' ? 0.05 : 0.07;
    if (!when && !this.throttle(`m${type}${mood}`, gap)) return;
    const wobble = 0.94 + Math.random() * 0.12;
    const v = VOICES[type];
    const specs = mood === 'match' ? v.matches[Math.floor(Math.random() * v.matches.length)] : v[mood];
    for (const spec of specs) this.tone(spec, pitch * wobble, when);
  }

  /** Everybody cheers, one after another. */
  chorus() {
    if (!this.ready() || !this.sfxOn) return;
    [0, 3, 1, 4, 2, 5].forEach((type, i) => {
      const specs = VOICES[type].matches[0];
      for (const spec of specs) this.tone(spec, 1.15 + i * 0.03, 0.9 + i * 0.13);
    });
  }

  pop(pitch = 1, when = 0) {
    if (!this.ready()) return;
    if (!when && !this.throttle('pop', 0.03)) return;
    this.tone({ wave: 'sine', f: [[0, 700], [0.06, 1400]], dur: 0.07, vol: 0.18 }, pitch, when);
  }

  swap() {
    if (!this.ready()) return;
    this.noise({ dur: 0.14, vol: 0.18, type: 'bandpass', f0: 700, f1: 2600, q: 2 });
  }

  tok() {
    if (!this.ready()) return;
    this.tone({ wave: 'triangle', f: [[0, 520], [0.05, 380]], dur: 0.06, vol: 0.2 });
  }

  crack(hpLeft) {
    if (!this.ready()) return;
    this.noise({ dur: 0.08, vol: 0.35, type: 'highpass', f0: 2500, f1: 1200 });
    this.tone({ wave: 'square', f: [[0, hpLeft ? 900 : 1200], [0.04, 500]], dur: 0.05, vol: 0.08, lp: 3000 });
    if (!hpLeft) this.noise({ dur: 0.2, vol: 0.3, type: 'bandpass', f0: 1800, f1: 600, q: 1.5, when: 0.04 });
  }

  click() {
    if (!this.ready()) return;
    this.tone({ wave: 'square', f: [[0, 900], [0.03, 1200]], dur: 0.04, vol: 0.1, lp: 3000 });
  }

  zap(when = 0) {
    if (!this.ready()) return;
    this.tone({ wave: 'sawtooth', f: [[0, 2000], [0.3, 160]], dur: 0.32, vol: 0.2, lp: 3500 }, 1, when);
    this.noise({ dur: 0.25, vol: 0.12, type: 'highpass', f0: 3000, f1: 800, when });
  }

  boom(when = 0) {
    if (!this.ready()) return;
    this.noise({ dur: 0.55, vol: 0.55, type: 'lowpass', f0: 1600, f1: 80, when });
    this.tone({ wave: 'sine', f: [[0, 140], [0.4, 38]], dur: 0.45, vol: 0.6 }, 1, when);
  }

  sparkle(pitch = 1, when = 0) {
    if (!this.ready()) return;
    const notes = [76, 79, 83, 88, 91, 95];
    notes.forEach((n, i) =>
      this.tone({ wave: 'triangle', f: [[0, midi(n)]], dur: 0.12, vol: 0.14 }, pitch, when + i * 0.045)
    );
  }

  special(pitch = 1) {
    if (!this.ready()) return;
    [72, 76, 79, 84].forEach((n, i) =>
      this.tone({ wave: 'square', f: [[0, midi(n)]], dur: 0.09, vol: 0.1, lp: 3000 }, pitch, i * 0.05)
    );
  }

  combo(level) {
    if (!this.ready()) return;
    const base = 72 + Math.min(level, 8) * 2;
    [0, 4, 7].forEach((d, i) => {
      this.tone({ wave: 'sine', f: [[0, midi(base + d)]], dur: 0.35, vol: 0.14 }, 1, i * 0.06);
      this.tone({ wave: 'triangle', f: [[0, midi(base + d + 12)]], dur: 0.2, vol: 0.05 }, 1, i * 0.06);
    });
  }

  shuffle() {
    if (!this.ready()) return;
    this.noise({ dur: 0.4, vol: 0.2, type: 'bandpass', f0: 400, f1: 3000, q: 3 });
    this.noise({ dur: 0.4, vol: 0.2, type: 'bandpass', f0: 3000, f1: 400, q: 3, when: 0.35 });
  }

  star(i) {
    if (!this.ready()) return;
    const n = [79, 83, 86][i] || 86;
    this.tone({ wave: 'square', f: [[0, midi(n)]], dur: 0.25, vol: 0.12, lp: 4000 });
    this.tone({ wave: 'sine', f: [[0, midi(n + 12)]], dur: 0.4, vol: 0.1 });
  }

  win() {
    if (!this.ready()) return;
    const seq = [72, 76, 79, 84, 79, 84, 88];
    seq.forEach((n, i) => this.tone({ wave: 'square', f: [[0, midi(n)]], dur: 0.14, vol: 0.12, lp: 3500 }, 1, i * 0.1));
    [72, 76, 79].forEach((n) => this.tone({ wave: 'triangle', f: [[0, midi(n)]], dur: 0.8, vol: 0.12 }, 1, 0.7));
  }

  lose() {
    if (!this.ready()) return;
    [67, 66, 65, 64].forEach((n, i) =>
      this.tone(
        { wave: 'sawtooth', f: [[0, midi(n)], [0.4, midi(n) * 0.98]], dur: i === 3 ? 0.9 : 0.38, vol: 0.18, lp: 1200, vib: i === 3 ? [6, 8] : null },
        1,
        i * 0.42
      )
    );
  }

  // ---- Music: a bouncy four-bar loop, scheduled slightly ahead of time ----

  startMusic() {
    if (!this.ctx || this.music.timer) return;
    this.music.next = this.ctx.currentTime + 0.1;
    this.music.timer = setInterval(() => this.scheduleMusic(), 40);
  }

  stopMusic() {
    clearInterval(this.music.timer);
    this.music.timer = null;
  }

  /** Per-world twist on the gameplay tune: key, tempo and lead voice. */
  setFlavor(world) {
    const F = [
      { transpose: 0, bpm: 1, lead: null },
      { transpose: 2, bpm: 0.95, lead: 'triangle', lp: 3000 },
      { transpose: -3, bpm: 0.85, lead: 'sine', lp: 4000 },
      { transpose: 5, bpm: 1.08, lead: 'square', lp: 3000 },
      { transpose: -5, bpm: 1.04, lead: 'sawtooth', lp: 1500 },
    ];
    this.music.flavor = F[world % F.length];
  }

  /** Speed the music up a little when moves are running out. */
  setTension(on) {
    this.music.tension = on;
  }

  /** Switch tune; the change happens at the start of the next bar. */
  setSong(name) {
    if (name === 'title') this.music.tension = false;
    if (!SONGS[name] || this.music.want === name) return;
    this.music.want = name;
  }

  scheduleMusic() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    if (this.music.next < ctx.currentTime) this.music.next = ctx.currentTime + 0.05;
    while (this.music.next < ctx.currentTime + 0.15) {
      if (this.music.step % 8 === 0 && this.music.want && this.music.want !== this.music.song) {
        this.music.song = this.music.want;
        this.music.step = 0;
      }
      const song = SONGS[this.music.song || 'title'];
      const fl = (this.music.song === 'game' && this.music.flavor) || { transpose: 0, bpm: 1 };
      const stepDur = 60 / (song.bpm * fl.bpm * (this.music.tension ? 1.14 : 1)) / 2;
      const s = this.music.step % 32;
      const loop = Math.floor(this.music.step / 32);
      const when = this.music.next - ctx.currentTime;
      const bar = Math.floor(s / 8);
      const b = song.bass[s % 8];
      if (b !== null) {
        this.tone({ wave: 'triangle', f: [[0, midi(song.roots[bar] + b + fl.transpose)]], dur: stepDur * 0.9, vol: 0.5 }, 1, when, this.musicBus);
      }
      const n = song.mel[s];
      if (n && loop % 4 !== 3) {
        const up = song.octaveUp && loop % 2 ? 12 : 0;
        this.tone({ wave: fl.lead || song.lead, f: [[0, midi(n + up + fl.transpose)]], dur: stepDur * 0.8, vol: song.leadVol, lp: fl.lp || song.lp }, 1, when, this.musicBus);
      }
      if (s % 2 === 1 || (song.drive && s % 8 === 0)) {
        const t0 = ctx.currentTime + when;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = s % 2 ? 'highpass' : 'lowpass';
        hp.frequency.value = s % 2 ? 7000 : 400;
        const env = ctx.createGain();
        env.gain.setValueAtTime(s % 2 ? 0.12 : 0.5, t0);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + (s % 2 ? 0.04 : 0.12));
        src.connect(hp).connect(env).connect(this.musicBus);
        src.start(t0, Math.random() * 0.5);
        src.stop(t0 + 0.15);
      }
      this.music.next += stepDur;
      this.music.step++;
    }
  }

}
