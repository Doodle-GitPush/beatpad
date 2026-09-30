export type Legend = {
  t?: string; s?: number; w?: number;
  home?: boolean; ring?: boolean; dot?: boolean; enter?: boolean; metro?: boolean;
};

export type KeyFn = 'metro' | 'play' | 'rec' | 'del';

export interface Key {
  id: string;
  /** grid cell: [col, row] or [col, row, colSpan, rowSpan] */
  g: number[];
  style?: 'dark' | 'orange';
  L: Legend;
  fn?: KeyFn;
  /** synth voice name */
  v?: string;
  name?: string;
  codes: string[];
  /** live input state, written by the sequencer and read by the 3D view */
  held: boolean;
  flashUntil: number;
  tx: number;
  tz: number;
}

type KeyDef = Omit<Key, 'held' | 'flashUntil' | 'tx' | 'tz'>;
const def = (k: KeyDef): Key => ({ ...k, held: false, flashUntil: 0, tx: 0, tz: 0 });

export const KEYS: Key[] = [
  def({ id: 'metro', g: [0, 0], style: 'dark', L: { metro: true }, fn: 'metro', codes: ['KeyM'] }),
  def({ id: 'play', g: [1, 0], L: { ring: true }, fn: 'play', codes: ['Space'] }),
  def({ id: 'rec', g: [2, 0], L: { dot: true }, fn: 'rec', codes: ['KeyR'] }),
  def({ id: 'del', g: [3, 0], L: { t: 'del', s: 34 }, fn: 'del', codes: ['Backspace', 'Delete'] }),
  def({ id: 'num', g: [0, 1], L: { t: 'num', s: 34 }, v: 'zap', name: 'zap', codes: ['NumLock', 'Backquote'] }),
  def({ id: 'div', g: [1, 1], L: { t: '÷', s: 62, w: 300 }, v: 'blip', name: 'blip', codes: ['NumpadDivide', 'Slash'] }),
  def({ id: 'mul', g: [2, 1], L: { t: '×', s: 56, w: 300 }, v: 'shaker', name: 'shaker', codes: ['NumpadMultiply', 'KeyX'] }),
  def({ id: 'sub', g: [3, 1], L: { t: '−', s: 62, w: 300 }, v: 'bass', name: 'bass', codes: ['NumpadSubtract', 'Minus'] }),
  def({ id: 'k7', g: [0, 2], L: { t: '7' }, v: 'tomL', name: 'low tom', codes: ['Digit7', 'Numpad7'] }),
  def({ id: 'k8', g: [1, 2], L: { t: '8' }, v: 'tomM', name: 'mid tom', codes: ['Digit8', 'Numpad8'] }),
  def({ id: 'k9', g: [2, 2], L: { t: '9' }, v: 'tomH', name: 'high tom', codes: ['Digit9', 'Numpad9'] }),
  def({ id: 'add', g: [3, 2, 1, 2], L: { t: '+', s: 62, w: 300 }, v: 'crash', name: 'crash', codes: ['NumpadAdd', 'Equal'] }),
  def({ id: 'k4', g: [0, 3], L: { t: '4' }, v: 'hat', name: 'closed hat', codes: ['Digit4', 'Numpad4'] }),
  def({ id: 'k5', g: [1, 3], L: { t: '5', home: true }, v: 'ohat', name: 'open hat', codes: ['Digit5', 'Numpad5'] }),
  def({ id: 'k6', g: [2, 3], L: { t: '6' }, v: 'rim', name: 'rim', codes: ['Digit6', 'Numpad6'] }),
  def({ id: 'k1', g: [0, 4], L: { t: '1' }, v: 'kick', name: 'kick', codes: ['Digit1', 'Numpad1'] }),
  def({ id: 'k2', g: [1, 4], L: { t: '2' }, v: 'snare', name: 'snare', codes: ['Digit2', 'Numpad2'] }),
  def({ id: 'k3', g: [2, 4], L: { t: '3' }, v: 'clap', name: 'clap', codes: ['Digit3', 'Numpad3'] }),
  def({ id: 'enter', g: [3, 4, 1, 2], style: 'orange', L: { enter: true }, v: 'stab', name: 'chord stab', codes: ['NumpadEnter', 'Enter'] }),
  def({ id: 'k0', g: [0, 5, 2, 1], L: { t: '0' }, v: 'sub', name: '808 sub', codes: ['Digit0', 'Numpad0'] }),
  def({ id: 'dot', g: [2, 5], L: { t: '.' }, v: 'cowbell', name: 'cowbell', codes: ['NumpadDecimal', 'Period'] }),
];

export const KEY_BY_ID: Record<string, Key> = {};
export const KEY_BY_CODE: Record<string, Key> = {};
KEYS.forEach((k) => {
  KEY_BY_ID[k.id] = k;
  k.codes.forEach((c) => (KEY_BY_CODE[c] = k));
});

/** keys 1–9 double as pattern selectors while ● is held */
export const NUM_IDX: Record<string, number> = { k1: 0, k2: 1, k3: 2, k4: 3, k5: 4, k6: 5, k7: 6, k8: 7, k9: 8 };
