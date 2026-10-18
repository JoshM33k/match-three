// Stickers (achievements). Each has an icon drawn from the monster sprites.
export const STICKERS = [
  { id: 'first', name: 'FIRST POP', desc: 'POP YOUR VERY FIRST MONSTER.', icon: [0, 'happy'], test: (s) => total(s.stats.popped) >= 1 },
  { id: 'combo3', name: 'CHAIN REACTION', desc: 'SET OFF A 3X COMBO.', icon: [5, 'excited'], test: (s) => s.stats.bestCombo >= 3 },
  { id: 'combo6', name: 'MONSTER MAYHEM', desc: 'SET OFF A 6X COMBO.', icon: [1, 'excited'], test: (s) => s.stats.bestCombo >= 6 },
  { id: 'line', name: 'BLASTER MASTER', desc: 'MAKE 10 BLASTERS.', icon: [0, 'idle', 'lh'], test: (s) => made(s, 'line') >= 10 },
  { id: 'bomb', name: 'KABOOM', desc: 'MAKE 5 BOMBS.', icon: [1, 'idle', 'b0'], test: (s) => made(s, 'bomb') >= 5 },
  { id: 'rainbow', name: 'OVER THE RAINBOW', desc: 'MAKE A RAINBOW MONSTER.', icon: [-1, 'happy', 'rb'], test: (s) => made(s, 'rainbow') >= 1 },
  { id: 'hatch1', name: "IT'S A BABY!", desc: 'HATCH AN EGG.', icon: [-2, 'idle', 'e1'], test: (s) => s.stats.hatched >= 1 },
  { id: 'hatch25', name: 'MONSTER NANNY', desc: 'HATCH 25 EGGS.', icon: [-2, 'idle', 'e2'], test: (s) => s.stats.hatched >= 25 },
  { id: 'boss', name: 'GIANT SLAYER', desc: 'DEFEAT A BOSS.', icon: [2, 'dizzy'], test: (s) => s.stats.bosses >= 1 },
  { id: 'stars', name: 'STAR COLLECTOR', desc: 'EARN 30 STARS.', icon: [5, 'happy'], test: (s) => total(s.stars) >= 30 },
  { id: 'pop1000', name: 'POP STAR', desc: 'POP 1000 MONSTERS.', icon: [3, 'excited'], test: (s) => total(s.stats.popped) >= 1000 },
  { id: 'explorer', name: 'EXPLORER', desc: 'REACH THE MINT MEADOW (LEVEL 11).', icon: [2, 'surprised'], test: (s) => s.level >= 11 },
  { id: 'zen', name: 'INNER PEACE', desc: 'SCORE 20000 IN ZEN MODE.', icon: [4, 'sleepy'], test: (s) => (s.zenBest || 0) >= 20000 },
  { id: 'daily', name: 'REGULAR', desc: 'PLAY THE DAILY 3 DAYS IN A ROW.', icon: [3, 'happy'], test: (s) => ((s.daily && s.daily.streak) || 0) >= 3 },
];

function total(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + b, 0);
}

function made(s, kind) {
  return (s.stats.made && s.stats.made[kind]) || 0;
}

/** Returns newly earned stickers (and records them in settings). */
export function checkStickers(settings) {
  settings.stickers = settings.stickers || {};
  settings.stats = settings.stats || { popped: {}, hatched: 0, bosses: 0, bestCombo: 0 };
  const fresh = [];
  for (const st of STICKERS) {
    if (settings.stickers[st.id]) continue;
    let ok = false;
    try {
      ok = st.test(settings);
    } catch {
      ok = false;
    }
    if (ok) {
      settings.stickers[st.id] = Date.now();
      fresh.push(st);
    }
  }
  return fresh;
}
