import {
  KITS, S, apply, audioTime, click, clamp, hasAudio, initAudio as initAudioCtx, renderPattern, stepDur, voice,
} from './audio';
import { KEY_BY_ID, NUM_IDX, type Key } from './keys';
import { ui } from './store';
import { encodeBeat, readBeatFromHash } from './share';

const STORE = 'beatpad.v2';
const newPat = () => Array.from({ length: 16 }, () => new Set<string>());
export const patterns = Array.from({ length: 9 }, newPat);

/** transport / edit state shared with the 3D view */
export const q = {
  P: 0, pendingP: -1, selStep: -1, cur: -1,
  recHeld: false, recUsed: false, delHeld: false, delUsed: false,
  /** kick pulse, decays in the render loop */
  pulse: 0,
};
export const pat = () => patterns[q.P];

// factory beat in pattern 1
[[0, 'k1'], [6, 'k1'], [8, 'k1'], [10, 'k1'], [4, 'k2'], [12, 'k2'], [14, 'k5']].forEach(([st, id]) => patterns[0][st as number].add(id as string));
for (let st = 0; st < 16; st += 2) if (st !== 14) patterns[0][st].add('k4');

/* ---------- persistence ---------- */
let saveT: ReturnType<typeof setTimeout> | undefined;
export function save() {
  clearTimeout(saveT);
  saveT = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(saveT);
  try {
    localStorage.setItem(STORE, JSON.stringify({
      P: q.P, bpm: S.bpm, kit: S.kit, filter: S.filter, echo: S.echo, pitch: S.pitch, vol: S.vol, swing: S.swing,
      pats: patterns.map((p) => p.map((set) => [...set])),
    }));
  } catch { /* storage unavailable */ }
}
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!d) return;
    (['bpm', 'kit', 'filter', 'echo', 'pitch', 'vol', 'swing'] as const).forEach((k) => { if (typeof d[k] === 'number') S[k] = d[k]; });
    S.kit = clamp(S.kit | 0, 0, KITS.length - 1);
    if (Array.isArray(d.pats)) d.pats.slice(0, 9).forEach((p: unknown, i: number) => Array.isArray(p) && p.slice(0, 16).forEach((ids: unknown, st: number) => {
      patterns[i][st].clear();
      (Array.isArray(ids) ? ids : []).forEach((id: string) => KEY_BY_ID[id]?.v && patterns[i][st].add(id));
    }));
    q.P = clamp(d.P | 0, 0, 8);
  } catch { /* corrupt or unavailable */ }
}

/* ---------- scheduler ---------- */
const skip = new Set<string>();
export interface UiEvent { t: number; id?: string; step?: number }
export const uiQ: UiEvent[] = [];
let stepCount = 0, nextT = 0, timer: ReturnType<typeof setInterval> | undefined;

function scheduler() {
  if (!S.playing) return;
  while (nextT < audioTime() + 0.12) {
    const st = stepCount % 16;
    if (st === 0 && q.pendingP >= 0) { q.P = q.pendingP; q.pendingP = -1; skip.clear(); updatePatUI(); }
    const t = nextT + (st % 2 ? S.swing * stepDur() * 0.5 : 0);           // swing delays every second 16th
    pat()[st].forEach((id) => {
      const key = st + ':' + id;
      if (skip.has(key)) { skip.delete(key); return; }
      voice(id, t); uiQ.push({ t, id });
    });
    if (S.metro && st % 4 === 0) click(nextT, st === 0);
    uiQ.push({ t: nextT, step: st });
    nextT += stepDur(); stepCount++;
  }
}

/** Call from a user gesture. Starts the audio context and the scheduler on first use. */
export function ensureAudio() {
  if (initAudioCtx()) {
    timer = setInterval(scheduler, 25);
    ui.set({ hint: 'audio on' });
  }
}
export function disposeSequencer() {
  clearInterval(timer); timer = undefined;
  S.playing = false; S.rec = false; uiQ.length = 0; skip.clear();
  flush();
}

/* ---------- UI sync ---------- */
export function drawSteps() {
  ui.set({ has: pat().map((s) => s.size > 0), sel: q.selStep });
}
export function updatePatUI() {
  ui.set({ pat: q.P + 1 + (q.pendingP >= 0 ? ' → ' + (q.pendingP + 1) : '') });
  drawSteps();
}
export function syncState() {
  ui.set({ state: S.rec ? 'recording' : S.playing ? 'playing' : 'stopped', bpm: Math.round(S.bpm), kit: KITS[S.kit].name });
}
export function setCur(s: number) { q.cur = s; ui.set({ cur: s }); }
export const setHit = (hit: string) => ui.set({ hit });

/* ---------- transport & editing ---------- */
function recordHit(id: string) {
  const qn = stepCount - Math.round((nextT - audioTime()) / stepDur());
  const st = ((qn % 16) + 16) % 16;
  if (!pat()[st].has(id)) { pat()[st].add(id); if (qn >= stepCount) skip.add(st + ':' + id); }
  drawSteps(); save();
}
export function setPattern(i: number) {
  q.selStep = -1;
  if (S.playing) q.pendingP = i === q.P ? -1 : i; else { q.P = i; q.pendingP = -1; }
  updatePatUI(); save(); setHit('pattern ' + (i + 1) + (q.pendingP >= 0 ? ' (next bar)' : ''));
}
export function selectStep(i: number) {
  q.selStep = q.selStep === i ? -1 : i; drawSteps();
  setHit(q.selStep >= 0 ? 'step ' + (i + 1) + ' · press keys to add / remove' : 'edit off');
}
export function clearSelection() {
  if (q.selStep < 0) return;
  q.selStep = -1; drawSteps(); setHit('edit off');
}
function start() { S.playing = true; stepCount = 0; nextT = audioTime() + 0.06; syncState(); }
function stop() {
  S.playing = false; S.rec = false; uiQ.length = 0; skip.clear(); setCur(-1);
  if (q.pendingP >= 0) { q.P = q.pendingP; q.pendingP = -1; updatePatUI(); }
  syncState();
}

function fnDown(fn: NonNullable<Key['fn']>) {
  if (fn === 'play') { if (S.playing) stop(); else start(); }
  if (fn === 'rec') { q.recHeld = true; q.recUsed = false; }
  if (fn === 'metro') S.metro = !S.metro;
  if (fn === 'del') { q.delHeld = true; q.delUsed = false; }
  syncState();
}

export function press(k: Key) {
  ensureAudio();
  k.held = true;
  if (k.fn) return fnDown(k.fn);
  if (q.recHeld && k.id in NUM_IDX) { q.recUsed = true; setPattern(NUM_IDX[k.id]); return; }
  if (q.delHeld) { pat().forEach((set) => set.delete(k.id)); q.delUsed = true; drawSteps(); save(); setHit('erased ' + k.name); return; }
  voice(k.id, audioTime());
  if (k.id === 'k1' || k.id === 'k0') q.pulse = 1;
  if (q.selStep >= 0) {
    const set = pat()[q.selStep], had = set.has(k.id);
    if (had) set.delete(k.id); else set.add(k.id);
    drawSteps(); save(); setHit('step ' + (q.selStep + 1) + (had ? ' − ' : ' + ') + k.name);
    return;
  }
  setHit(k.name!);
  if (S.rec && S.playing) recordHit(k.id);
}

export function release(k: Key) {
  k.held = false; k.tx = k.tz = 0;
  if (k.fn === 'del') {
    q.delHeld = false;
    if (!q.delUsed) { pat().forEach((set) => set.clear()); skip.clear(); drawSteps(); save(); setHit('cleared pattern ' + (q.P + 1)); }
  }
  if (k.fn === 'rec') {
    q.recHeld = false;
    if (!q.recUsed) { S.rec = !S.rec; if (S.rec && !S.playing) start(); syncState(); }
  }
}

/* ---------- parameter setters (shared by the 3D controls) ---------- */
export function paramChanged(k: 'filter' | 'echo' | 'vol' | 'bpm' | 'kit' | 'pitch' | 'swing') {
  if (k !== 'pitch' && k !== 'swing') apply(k);
  syncState(); save();
}

/* ---------- share links ---------- */
export function shareUrl() {
  const hash = encodeBeat({ pattern: pat(), bpm: S.bpm, kit: S.kit, swing: S.swing, filter: S.filter, echo: S.echo, pitch: S.pitch });
  return `${location.origin}${location.pathname}#beat=${hash}`;
}

export async function shareBeat() {
  if (!pat().some((set) => set.size)) { ui.set({ hint: 'nothing to share — pattern is empty' }); return; }
  const url = shareUrl();
  const title = 'A beat I made on Beat Pad';
  try {
    // phones get the native share sheet; desktops get the link on the clipboard
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title, url });
      ui.set({ hint: 'shared' });
      return;
    }
    await navigator.clipboard.writeText(url);
    ui.set({ hint: 'link copied — send it to anyone' });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;          // user closed the share sheet
    window.prompt('Copy this link to share your beat:', url);
  }
}

/**
 * If the page was opened from a share link, load that beat into the first empty pattern slot
 * (or the current one when all 9 are used) and adopt its sound settings. Returns true when it did.
 */
export function importFromHash(): boolean {
  const beat = readBeatFromHash();
  if (!beat) return false;
  let slot = patterns.findIndex((p) => p.every((set) => set.size === 0));
  if (slot < 0) slot = q.P;
  patterns[slot].forEach((set, st) => { set.clear(); beat.pattern[st].forEach((id) => set.add(id)); });
  q.P = slot; q.pendingP = -1; q.selStep = -1;
  Object.assign(S, {
    bpm: beat.bpm, kit: clamp(beat.kit, 0, KITS.length - 1), swing: beat.swing,
    filter: beat.filter, echo: beat.echo, pitch: beat.pitch,
  });
  (['filter', 'echo', 'bpm', 'kit'] as const).forEach(apply);
  history.replaceState(null, '', location.pathname + location.search);   // a reload shouldn't import it again
  save(); updatePatUI(); syncState();
  setHit('shared beat → pattern ' + (slot + 1));
  ui.set({ hint: 'loaded a shared beat · press ○ to play' });
  return true;
}

/* ---------- export ---------- */
export async function exportWav() {
  if (!pat().some((set) => set.size)) { ui.set({ hint: 'nothing to export — pattern is empty' }); return; }
  ui.set({ hint: 'rendering…' });
  try {
    const url = URL.createObjectURL(await renderPattern(pat()));
    const a = document.createElement('a');
    a.href = url; a.download = `beatpad-pattern${q.P + 1}-${Math.round(S.bpm)}bpm.wav`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    ui.set({ hint: hasAudio() ? 'audio on' : 'exported' });
  } catch {
    ui.set({ hint: 'export failed' });
  }
}
