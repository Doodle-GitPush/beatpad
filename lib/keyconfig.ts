import { KEYS, type Key } from './keys';

/* ---------- sound library (append only: indices travel in share links) ---------- */
export const VOICE_LIST: { id: string; name: string; group: 'drums' | 'percussion' | 'cymbals' | 'synth' }[] = [
  { id: 'kick', name: 'kick', group: 'drums' },
  { id: 'snare', name: 'snare', group: 'drums' },
  { id: 'clap', name: 'clap', group: 'drums' },
  { id: 'hat', name: 'closed hat', group: 'cymbals' },
  { id: 'ohat', name: 'open hat', group: 'cymbals' },
  { id: 'rim', name: 'rim', group: 'percussion' },
  { id: 'tomL', name: 'low tom', group: 'drums' },
  { id: 'tomM', name: 'mid tom', group: 'drums' },
  { id: 'tomH', name: 'high tom', group: 'drums' },
  { id: 'sub', name: '808 sub', group: 'drums' },
  { id: 'cowbell', name: 'cowbell', group: 'percussion' },
  { id: 'crash', name: 'crash', group: 'cymbals' },
  { id: 'stab', name: 'chord stab', group: 'synth' },
  { id: 'zap', name: 'zap', group: 'synth' },
  { id: 'blip', name: 'blip', group: 'synth' },
  { id: 'shaker', name: 'shaker', group: 'percussion' },
  { id: 'bass', name: 'bass', group: 'synth' },
  // added with key customisation
  { id: 'kick2', name: 'punch kick', group: 'drums' },
  { id: 'snap', name: 'snap', group: 'percussion' },
  { id: 'woodblock', name: 'woodblock', group: 'percussion' },
  { id: 'conga', name: 'conga', group: 'percussion' },
  { id: 'pluck', name: 'pluck', group: 'synth' },
  { id: 'swell', name: 'noise swell', group: 'synth' },
];
export const VOICE_NAME: Record<string, string> = Object.fromEntries(VOICE_LIST.map((v) => [v.id, v.name]));

/* ---------- per-key sound ---------- */
export interface KeySound { voice: string; tune: number; decay: number }
export const TUNE_RANGE = 12;                 // ± semitones
export const DECAYS = [0.4, 0.55, 0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1, 2.5];   // index 4 = normal

const instrumentKeys = KEYS.filter((k) => k.v);
export const INSTRUMENT_IDS = instrumentKeys.map((k) => k.id);
const defaults = (k: Key): KeySound => ({ voice: k.v!, tune: 0, decay: 1 });

export const keyConfig: Record<string, KeySound> = Object.fromEntries(instrumentKeys.map((k) => [k.id, defaults(k)]));
export const soundName = (id: string) => VOICE_NAME[keyConfig[id]?.voice] ?? id;
export const isDefaultKey = (id: string) => {
  const k = KEYS.find((x) => x.id === id)!, c = keyConfig[id];
  return c.voice === k.v && c.tune === 0 && c.decay === 1;
};
export function resetKey(id: string) {
  const k = KEYS.find((x) => x.id === id);
  if (k?.v) keyConfig[id] = defaults(k);
}
export function resetAllKeys() { INSTRUMENT_IDS.forEach(resetKey); }
export function setKeyConfig(src: Record<string, Partial<KeySound>>) {
  for (const id of INSTRUMENT_IDS) {
    const c = src[id];
    if (!c) continue;
    if (typeof c.voice === 'string' && VOICE_NAME[c.voice]) keyConfig[id].voice = c.voice;
    if (typeof c.tune === 'number' && Number.isFinite(c.tune)) keyConfig[id].tune = Math.max(-TUNE_RANGE, Math.min(TUNE_RANGE, Math.round(c.tune)));
    if (typeof c.decay === 'number' && Number.isFinite(c.decay)) keyConfig[id].decay = Math.max(0.3, Math.min(3, c.decay));
  }
}

/* ---------- keycap colourways (append only) ---------- */
export type Role = 'white' | 'orange' | 'dark';
export interface Colorway { id: string; name: string; caps: Record<Role, { cap: string; legend: string }> }
export const COLORWAYS: Colorway[] = [
  { id: 'classic', name: 'classic', caps: {
    white: { cap: '#dddcd6', legend: '#6a6964' }, orange: { cap: '#c2461b', legend: '#fde6d9' }, dark: { cap: '#262626', legend: '#d6d6d6' } } },
  { id: 'stealth', name: 'stealth', caps: {
    white: { cap: '#2b2b2a', legend: '#a3a29d' }, orange: { cap: '#c2461b', legend: '#fde6d9' }, dark: { cap: '#121212', legend: '#e6e6e6' } } },
  { id: 'sunset', name: 'sunset', caps: {
    white: { cap: '#d4582a', legend: '#ffe7da' }, orange: { cap: '#eeeae1', legend: '#c2461b' }, dark: { cap: '#262626', legend: '#ffb08d' } } },
  { id: 'mint', name: 'mint', caps: {
    white: { cap: '#cfe4d8', legend: '#3d6a57' }, orange: { cap: '#ef9f86', legend: '#ffffff' }, dark: { cap: '#5b6380', legend: '#e8ebff' } } },
  { id: 'blueprint', name: 'blueprint', caps: {
    white: { cap: '#dfe5ee', legend: '#2e4a7a' }, orange: { cap: '#2d5ccc', legend: '#eaf0ff' }, dark: { cap: '#1b2a44', legend: '#cfe0ff' } } },
];
export const look = { colorway: 0 };
export const roleOf = (k: Key): Role => (k.style === 'orange' ? 'orange' : k.style === 'dark' ? 'dark' : 'white');
export const capFor = (k: Key) => COLORWAYS[look.colorway].caps[roleOf(k)];
