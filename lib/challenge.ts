import { KITS, S } from './audio';
import { VOICE_NAME, keyConfig } from './keyconfig';

/**
 * Daily challenge: generated from the local date with a seeded RNG, so everyone gets the same one
 * without a server. Challenge #1 is 2026-09-01.
 */
const EPOCH = Date.UTC(2026, 8, 1);
const STORE = 'beatpad.challenge';

export type TwistId = 'noKick' | 'swing' | 'downbeats' | 'break' | 'sparse' | 'busy';
const TWISTS: Record<TwistId, string> = {
  noKick: 'no kick drums',
  swing: 'swing at 40% or more',
  downbeats: 'a sound on every beat (steps 1, 5, 9, 13)',
  break: 'leave the last 4 steps empty',
  sparse: '12 hits or fewer',
  busy: '24 hits or more',
};
// sounds a challenge can ask for (ones that sit on the default keys, so nobody needs to remap)
const MUST_USE = ['cowbell', 'clap', 'rim', 'shaker', 'tomL', 'tomH', 'ohat', 'blip', 'stab', 'bass', 'zap', 'crash'];
const KICKS = new Set(['kick', 'kick2', 'sub']);

export interface Challenge {
  no: number; date: string; label: string;
  kit: number; bpm: number; maxSounds: number; mustUse: string; twist: TwistId;
}

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rng(seedStr: string) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {                                     // mulberry32
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function challengeFor(date: string): Challenge {
  const [y, m, d] = date.split('-').map(Number);
  const no = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
  const r = rng('beatpad:' + date);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const kit = Math.floor(r() * KITS.length);
  const bpm = 70 + Math.round((r() * 90) / 2) * 2;               // 70–160, even numbers
  const maxSounds = 3 + Math.floor(r() * 4);                       // 3–6
  const mustUse = pick(MUST_USE);
  let twist = pick(Object.keys(TWISTS) as TwistId[]);
  if (twist === 'busy' && maxSounds < 4) twist = 'swing';          // keep it possible
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { no, date, label, kit, bpm, maxSounds, mustUse, twist };
}
export const todaysChallenge = () => challengeFor(dateKey());

export interface Rule { id: string; label: string; ok: boolean }
export function checkChallenge(c: Challenge, pattern: Set<string>[]): Rule[] {
  const voices = pattern.map((set) => [...set].map((id) => keyConfig[id]?.voice).filter(Boolean) as string[]);
  const used = new Set(voices.flat());
  const hits = voices.reduce((n, v) => n + v.length, 0);
  const twistOk: Record<TwistId, boolean> = {
    noKick: ![...used].some((v) => KICKS.has(v)),
    swing: S.swing >= 0.395,
    downbeats: [0, 4, 8, 12].every((i) => voices[i].length > 0),
    break: [12, 13, 14, 15].every((i) => voices[i].length === 0),
    sparse: hits <= 12,
    busy: hits >= 24,
  };
  return [
    { id: 'kit', label: `kit: ${KITS[c.kit].name}`, ok: S.kit === c.kit },
    { id: 'bpm', label: `tempo: ${c.bpm} bpm`, ok: Math.abs(S.bpm - c.bpm) < 2.5 },
    { id: 'must', label: `use the ${VOICE_NAME[c.mustUse]}`, ok: used.has(c.mustUse) },
    { id: 'max', label: `${c.maxSounds} different sounds at most`, ok: used.size > 0 && used.size <= c.maxSounds },
    { id: 'twist', label: TWISTS[c.twist], ok: twistOk[c.twist] },
    { id: 'hits', label: 'at least 6 hits', ok: hits >= 6 },
  ];
}

/* ---------- streak ---------- */
function readDone(): string[] {
  try { const d = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(d) ? d.filter((x) => typeof x === 'string') : []; }
  catch { return []; }
}
export function markDone(date: string) {
  const done = new Set(readDone()); done.add(date);
  try { localStorage.setItem(STORE, JSON.stringify([...done].sort().slice(-400))); } catch { /* unavailable */ }
}
export const isDone = (date: string) => readDone().includes(date);
/** consecutive days completed, ending today (or yesterday, so the streak survives until you play today) */
export function streak() {
  const done = new Set(readDone());
  const d = new Date();
  if (!done.has(dateKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (done.has(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
