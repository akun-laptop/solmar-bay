// SOLMAR BAY — synthesized audio: SFX + ambient music via WebAudio (no files)
let ctx = null;
let master = null;
let musicNodes = null;
let muted = false;
let engineOsc = null, engineGain = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}
export function resumeAudio() { if (ctx && ctx.state === "suspended") ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, filterFreq, type) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type || "lowpass";
  f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  shoot() { noise(0.09, 0.35, 2600, "highpass"); tone(180, 0.08, "square", 0.12, 60); },
  shotgun() { noise(0.22, 0.5, 1800, "lowpass"); tone(120, 0.15, "square", 0.2, 40); },
  punch() { noise(0.07, 0.3, 500, "lowpass"); },
  hit() { tone(220, 0.06, "triangle", 0.2, 140); },
  crash() { noise(0.25, 0.5, 900, "lowpass"); tone(90, 0.2, "sawtooth", 0.15, 40); },
  skid() { noise(0.18, 0.12, 3200, "bandpass"); },
  explosion() { noise(0.7, 0.7, 500, "lowpass"); tone(60, 0.6, "sine", 0.4, 25); },
  pickup() { tone(660, 0.09, "sine", 0.2); setTimeout(() => tone(990, 0.12, "sine", 0.2), 90); },
  cash() { tone(880, 0.07, "triangle", 0.2); setTimeout(() => tone(1320, 0.14, "triangle", 0.2), 70); },
  missionPass() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.25), i * 130)); },
  missionFail() { [400, 320, 240].forEach((f, i) => setTimeout(() => tone(f, 0.25, "sawtooth", 0.15), i * 160)); },
  siren() { tone(750, 0.4, "sine", 0.06, 950); setTimeout(() => tone(950, 0.4, "sine", 0.06, 750), 400); },
  door() { noise(0.08, 0.2, 700, "lowpass"); tone(140, 0.06, "square", 0.08, 90); },
  enterCar() { tone(300, 0.1, "triangle", 0.15, 500); },
  horn() { tone(370, 0.25, "square", 0.12); tone(466, 0.25, "square", 0.1); },
  click() { tone(800, 0.05, "square", 0.08); },
  star() { tone(1200, 0.15, "sine", 0.2, 1600); },
};

// Engine hum: follows vehicle speed (0..1)
export function setEngine(on, speedNorm) {
  if (!ctx) return;
  if (on && !engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0.0;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 320;
    engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  if (engineOsc) {
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.06 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.1);
  }
}

// Chill synthwave-ish loop: bass + pad, scheduled per bar
const BASS_LINE = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4]; // A1 A1 C2 G1 A1 A1 E2 D2
const PAD_CHORDS = [[110, 164.8, 220], [87.3, 130.8, 174.6], [98, 146.8, 196], [82.4, 123.5, 164.8]];
let musicTimer = null, barCount = 0;
export function startMusic() {
  if (!ctx || musicTimer) return;
  const barMs = 2000;
  const playBar = () => {
    if (!ctx || muted) { barCount++; return; }
    const t = ctx.currentTime;
    const bass = BASS_LINE[barCount % BASS_LINE.length];
    const chord = PAD_CHORDS[Math.floor(barCount / 2) % PAD_CHORDS.length];
    // bass note
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = bass;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.08);
    g.gain.linearRampToValueAtTime(0.0, t + 1.8);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.9);
    // pad
    chord.forEach((f) => {
      const po = ctx.createOscillator(), pg = ctx.createGain();
      po.type = "sine"; po.frequency.value = f;
      pg.gain.setValueAtTime(0.0, t);
      pg.gain.linearRampToValueAtTime(0.045, t + 0.5);
      pg.gain.linearRampToValueAtTime(0.0, t + 1.95);
      po.connect(pg); pg.connect(master); po.start(t); po.stop(t + 2.0);
    });
    // hat tick
    if (barCount % 2 === 0) noise(0.04, 0.05, 6000, "highpass");
    barCount++;
  };
  playBar();
  musicTimer = setInterval(playBar, barMs);
}
export function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
