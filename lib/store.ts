import { useSyncExternalStore } from 'react';
import type { Theme } from './theme';

export interface UiState {
  ready: boolean;
  /** 0–1 load progress and what is happening, for the preloader */
  progress: number;
  loadStage: string;
  theme: Theme;
  error: string | null;
  hint: string;
  state: 'stopped' | 'playing' | 'recording';
  bpm: number;
  kit: string;
  pat: string;
  hit: string;
  cur: number;
  sel: number;
  has: boolean[];
  hud: { x: number; y: number; text: string; show: boolean };
}

let state: UiState = {
  ready: false,
  progress: 0,
  loadStage: 'loading the instrument',
  theme: 'light',
  error: null,
  hint: 'tap any key to start audio',
  state: 'stopped',
  bpm: 112,
  kit: '808',
  pat: '1',
  hit: '—',
  cur: -1,
  sel: -1,
  has: Array(16).fill(false),
  hud: { x: 0, y: 0, text: '', show: false },
};
const subs = new Set<() => void>();
let hudTimer: ReturnType<typeof setTimeout> | undefined;

export const ui = {
  get: () => state,
  set(patch: Partial<UiState>) {
    state = { ...state, ...patch };
    subs.forEach((f) => f());
  },
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  showHud(x: number, y: number, text: string) {
    ui.set({ hud: { x, y, text, show: true } });
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => ui.set({ hud: { ...state.hud, show: false } }), 1100);
  },
};

export const useUi = () => useSyncExternalStore(ui.subscribe, ui.get, ui.get);
