import { keyConfig } from './keyconfig';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export interface Kit { name: string; tune: number; decay: number; tone: number }
export const KITS: Kit[] = [
  { name: '808', tune: 1, decay: 1, tone: 20000 },
  { name: '909', tune: 1.14, decay: 0.72, tone: 16000 },
  { name: 'dust', tune: 0.86, decay: 1.25, tone: 2400 },
  { name: 'toy', tune: 1.6, decay: 0.55, tone: 9000 },
];

/** everything the knobs, transport and sequencer share */
export const S = {
  bpm: 112, kit: 0, filter: 1, echo: 0.15, pitch: 0.5, vol: 0.8, swing: 0,
  playing: false, rec: false, metro: false,
};
export type Param = 'filter' | 'echo' | 'vol' | 'bpm' | 'kit';
export const stepDur = () => 60 / S.bpm / 4;
export const cutoff = (v: number) => 120 * Math.pow(18000 / 120, v);

/* ---------- graph ---------- */
let ctx: BaseAudioContext | undefined;
let noiseBuf: AudioBuffer;
let bus: GainNode, kitLP: BiquadFilterNode, filt: BiquadFilterNode, send: GainNode, delay: DelayNode;
let comp: DynamicsCompressorNode, master: GainNode;
let shaper: Float32Array<ArrayBuffer>;

export const hasAudio = () => !!ctx;
export const audioTime = () => ctx!.currentTime;

function buildGraph(c: BaseAudioContext) {
  ctx = c;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  shaper = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) shaper[i] = Math.tanh(2.5 * (i / 511.5 - 1));
  bus = ctx.createGain(); bus.gain.value = 0.8;
  kitLP = ctx.createBiquadFilter(); kitLP.type = 'lowpass';
  filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  master = ctx.createGain();
  send = ctx.createGain(); delay = ctx.createDelay(2);
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
  bus.connect(kitLP).connect(filt).connect(comp);
  filt.connect(send).connect(delay).connect(dlp).connect(fb).connect(delay);
  dlp.connect(comp);
  comp.connect(master).connect(ctx.destination);
}

export function apply(k: Param) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (k === 'filter') { filt.frequency.setTargetAtTime(cutoff(S.filter), t, 0.02); filt.Q.setTargetAtTime(0.7 + (1 - S.filter) * 5, t, 0.02); }
  if (k === 'echo') send.gain.setTargetAtTime(S.echo * 0.85, t, 0.03);
  if (k === 'vol') master.gain.setTargetAtTime(S.vol * S.vol * 1.1, t, 0.02);
  if (k === 'bpm') delay.delayTime.setTargetAtTime((60 / S.bpm) * 0.75, t, 0.05);
  if (k === 'kit') kitLP.frequency.setTargetAtTime(KITS[S.kit].tone, t, 0.02);
}
const applyAll = () => (['filter', 'echo', 'vol', 'bpm', 'kit'] as Param[]).forEach(apply);

/** creates (or resumes) the live context. Returns true only the first time. */
export function initAudio(): boolean {
  if (ctx) {
    if ((ctx as AudioContext).state === 'suspended') (ctx as AudioContext).resume();
    return false;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  buildGraph(new AC());
  applyAll();
  return true;
}
export function closeAudio() {
  const c = ctx as AudioContext | undefined;
  ctx = undefined;
  c?.close?.().catch(() => {});
}

/* ---------- synth helpers ---------- */
function env(t: number, peak: number, a: number, d: number, dest: AudioNode = bus) {
  const n = ctx!.createGain();
  n.gain.setValueAtTime(0.0001, t);
  n.gain.exponentialRampToValueAtTime(peak, t + a);
  n.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  n.connect(dest);
  return n;
}
function osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode) {
  const o = ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function noise(t: number, dur: number, dest: AudioNode) {
  const s = ctx!.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  return s;
}
function biq(type: BiquadFilterType, f: number, q: number | null, dest: AudioNode) {
  const b = ctx!.createBiquadFilter(); b.type = type; b.frequency.value = f;
  if (q != null) b.Q.value = q;
  b.connect(dest);
  return b;
}
function metal(t: number, p: number, dur: number, level: number, hp = 7000) {
  const b = biq('bandpass', 10000, 0.8, biq('highpass', hp, null, env(t, level, 0.001, dur)));
  [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => osc('square', 40 * r * p, t, dur + 0.05, b));
}
type Voice = (t: number, p: number, D: number) => void;
const tom = (f: number): Voice => (t, p, D) => {
  const o = osc('sine', f * p, t, 0.45 * D, env(t, 0.85, 0.002, 0.36 * D));
  o.frequency.exponentialRampToValueAtTime(f * p * 0.6, t + 0.3);
  noise(t, 0.03, biq('lowpass', 2000, null, env(t, 0.15, 0.001, 0.03)));
};

const VOICES: Record<string, Voice> = {
  kick(t, p, D) {
    const o = osc('sine', 155 * p, t, 0.5 * D, env(t, 1, 0.002, 0.42 * D));
    o.frequency.exponentialRampToValueAtTime(44 * p, t + 0.12);
    noise(t, 0.02, biq('highpass', 3000, null, env(t, 0.3, 0.001, 0.012)));
  },
  snare(t, p, D) {
    noise(t, 0.35 * D, biq('highpass', 1400, 0.7, env(t, 0.7, 0.001, 0.19 * D)));
    const o = osc('triangle', 200 * p, t, 0.15, env(t, 0.55, 0.001, 0.09 * D));
    o.frequency.exponentialRampToValueAtTime(150 * p, t + 0.08);
  },
  clap(t, p, D) {
    const n = ctx!.createGain(); n.connect(bus); const G = n.gain;
    G.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach((o) => { G.setValueAtTime(0.9, t + o); G.exponentialRampToValueAtTime(0.08, t + o + 0.01); });
    G.setValueAtTime(0.9, t + 0.032); G.exponentialRampToValueAtTime(0.0001, t + 0.032 + 0.22 * D);
    noise(t, 0.3 * D + 0.06, biq('bandpass', 1150 * p, 0.9, n));
  },
  hat(t, p, D) { metal(t, p, 0.05 * D, 0.28); },
  ohat(t, p, D) { metal(t, p, 0.38 * D, 0.24); },
  rim(t, p) {
    osc('triangle', 1750 * p, t, 0.05, env(t, 0.5, 0.001, 0.03));
    osc('square', 520 * p, t, 0.04, biq('bandpass', 520 * p, 6, env(t, 0.35, 0.001, 0.02)));
  },
  tomL: tom(95), tomM: tom(135), tomH: tom(185),
  sub(t, p, D) {
    const ws = ctx!.createWaveShaper(); ws.curve = shaper; ws.connect(env(t, 0.75, 0.004, 1.1 * D));
    const o = osc('sine', 64 * p, t, 1.2 * D, ws);
    o.frequency.exponentialRampToValueAtTime(49 * p, t + 0.08);
  },
  cowbell(t, p, D) {
    const b = biq('bandpass', 820 * p, 1.2, env(t, 0.5, 0.001, 0.3 * D));
    osc('square', 540 * p, t, 0.35 * D, b); osc('square', 800 * p, t, 0.35 * D, b);
  },
  crash(t, p, D) {
    noise(t, 1.5 * D, biq('highpass', 4500, null, env(t, 0.42, 0.001, 1.3 * D)));
    metal(t, p * 1.5, 1 * D, 0.1, 6000);
  },
  stab(t, p, D) {
    const lp = biq('lowpass', 4200, 4, env(t, 0.2, 0.006, 0.55 * D));
    lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    [130.81, 155.56, 196, 233.08, 293.66].forEach((f, i) => { osc('sawtooth', f * p, t, 0.7 * D, lp).detune.value = i % 2 ? 7 : -7; });
  },
  zap(t, p) {
    const o = osc('square', 1800 * p, t, 0.22, biq('lowpass', 5000, null, env(t, 0.2, 0.001, 0.18)));
    o.frequency.exponentialRampToValueAtTime(70 * p, t + 0.18);
  },
  blip(t, p) {
    osc('sine', 1320 * p, t, 0.15, env(t, 0.45, 0.001, 0.1));
    osc('sine', 1980 * p, t + 0.045, 0.12, env(t + 0.045, 0.3, 0.001, 0.08));
  },
  shaker(t, p, D) {
    const n = ctx!.createGain(); n.connect(bus);
    n.gain.setValueAtTime(0.0001, t); n.gain.linearRampToValueAtTime(0.45, t + 0.03);
    n.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + 0.1 * D);
    noise(t, 0.2 * D + 0.05, biq('bandpass', 6500, 1.4, biq('highpass', 3000, null, n)));
  },
  bass(t, p, D) {
    const lp = biq('lowpass', 1800, 9, env(t, 0.5, 0.003, 0.32 * D));
    lp.frequency.setValueAtTime(2200 * Math.min(p, 2), t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.25);
    osc('sawtooth', 73.42 * p, t, 0.45 * D, lp); osc('square', 36.71 * p, t, 0.45 * D, lp);
  },

  /* ---- added with key customisation ---- */
  kick2(t, p, D) {                       // tight, clicky 909-style kick
    const o = osc('sine', 210 * p, t, 0.32 * D, env(t, 1, 0.001, 0.26 * D));
    o.frequency.exponentialRampToValueAtTime(52 * p, t + 0.06);
    const ws = ctx!.createWaveShaper(); ws.curve = shaper; ws.connect(env(t, 0.35, 0.001, 0.05));
    osc('triangle', 120 * p, t, 0.06, ws);
    noise(t, 0.015, biq('bandpass', 4200, 0.8, env(t, 0.45, 0.001, 0.01)));
  },
  snap(t, p, D) {
    noise(t, 0.08 * D, biq('bandpass', 2600 * p, 3.5, env(t, 0.9, 0.001, 0.05 * D)));
    noise(t, 0.02, biq('highpass', 6000, null, env(t, 0.3, 0.001, 0.008)));
  },
  woodblock(t, p, D) {
    const b = biq('bandpass', 1050 * p, 12, env(t, 0.9, 0.001, 0.07 * D));
    osc('sine', 1050 * p, t, 0.12, b);
    noise(t, 0.01, b);
  },
  conga(t, p, D) {
    const o = osc('sine', 320 * p, t, 0.35 * D, env(t, 0.8, 0.001, 0.22 * D));
    o.frequency.exponentialRampToValueAtTime(250 * p, t + 0.05);
    noise(t, 0.015, biq('bandpass', 1800, 1, env(t, 0.25, 0.001, 0.012)));
  },
  pluck(t, p, D) {                       // short resonant synth note (A3)
    const lp = biq('lowpass', 4000, 6, env(t, 0.32, 0.002, 0.28 * D));
    lp.frequency.setValueAtTime(5200 * Math.min(p, 2), t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.22 * D);
    osc('sawtooth', 220 * p, t, 0.4 * D, lp);
    osc('square', 220.8 * p, t, 0.4 * D, lp);
  },
  swell(t, p, D) {                       // rising filtered-noise riser that cuts off
    const n = ctx!.createGain(); n.connect(bus);
    n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(0.35, t + 0.35 * D); n.gain.setValueAtTime(0.0001, t + 0.36 * D);
    const bp = biq('bandpass', 400 * p, 2, n);
    bp.frequency.setValueAtTime(400 * p, t); bp.frequency.exponentialRampToValueAtTime(6000 * Math.min(p, 2), t + 0.35 * D);
    noise(t, 0.4 * D, bp);
  },
};

export function click(t: number, accent: boolean) {
  const e = ctx!.createGain(); e.connect(comp);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, t + 0.001);
  e.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  osc('sine', accent ? 1760 : 1180, t, 0.05, e);
}

/** plays whatever sound this key is set to, with its own tuning/length on top of the kit and pitch knob */
export function voice(id: string, t: number) {
  const cfg = keyConfig[id];
  const fn = cfg && VOICES[cfg.voice];
  if (!fn) return;
  const k = KITS[S.kit];
  const p = Math.pow(2, (S.pitch - 0.5) * 2 + cfg.tune / 12) * k.tune;
  fn(t, p, k.decay * cfg.decay);
}

/* ---------- WAV export ---------- */
function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const wr = (o: number, str: string) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
  wr(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  wr(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = clamp(data[c][i], -1, 1);
    out.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2;
  }
  return new Blob([out], { type: 'audio/wav' });
}

/** Renders a pattern (2 loops + echo tail) faster than real time using the same voices, returns a WAV blob. */
export async function renderPattern(pattern: Set<string>[]): Promise<Blob> {
  const live = { ctx, noiseBuf, bus, kitLP, filt, send, delay, comp, master };
  const loops = 2, sd = stepDur(), dur = 16 * sd * loops + 2;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * 44100), 44100);
  try {
    buildGraph(oc);
    applyAll();
    for (let l = 0; l < loops; l++) for (let st = 0; st < 16; st++) {
      const t = 0.05 + (l * 16 + st) * sd + (st % 2 ? S.swing * sd * 0.5 : 0);
      pattern[st].forEach((id) => voice(id, t));
    }
  } finally {
    // hand the module back to the live context before the (async) render finishes
    ({ ctx, noiseBuf, bus, kitLP, filt, send, delay, comp, master } = live as typeof live & { ctx: BaseAudioContext | undefined });
  }
  return encodeWav(await oc.startRendering());
}
