/** Starter beats. Lanes are 16 characters, `x` = hit, keyed by key id. */
export interface Starter {
  id: string; name: string; blurb: string;
  bpm: number; kit: number; swing: number; filter: number; echo: number;
  lanes: Record<string, string>;
}

export const STARTERS: Starter[] = [
  { id: 'boombap', name: 'boom bap', blurb: 'dusty 90s hip-hop swing', bpm: 90, kit: 2, swing: 0.45, filter: 0.9, echo: 0.1,
    lanes: { k1: 'x.....x.x.x.....', k2: '....x.......x...', k4: 'x.x.x.x.x.x.x.x.', k5: '..............x.' } },
  { id: 'house', name: 'four on the floor', blurb: 'straight-up house groove', bpm: 124, kit: 1, swing: 0, filter: 1, echo: 0.2,
    lanes: { k1: 'x...x...x...x...', k3: '....x.......x...', k4: 'x.x.x.x.x.x.x.x.', k5: '..x...x...x...x.', sub: 'x..x..x...x..x..' } },
  { id: 'lofi', name: 'lo-fi', blurb: 'sleepy, filtered, late-night', bpm: 78, kit: 2, swing: 0.55, filter: 0.62, echo: 0.3,
    lanes: { k1: 'x......x..x.....', k6: '....x.......x...', mul: 'x.x.x.x.x.x.x.x.', enter: 'x.......x.......' } },
  { id: 'trap', name: 'trap', blurb: 'booming 808s and rolling hats', bpm: 140, kit: 0, swing: 0, filter: 1, echo: 0.1,
    lanes: { k0: 'x......x..x.....', k3: '........x.......', k4: 'x.x.xxx.x.x.x.xx', k5: '......x.........' } },
  { id: 'break', name: 'breakbeat', blurb: 'choppy funk break', bpm: 108, kit: 1, swing: 0.2, filter: 1, echo: 0.15,
    lanes: { k1: 'x.x.......xx....', k2: '....x..x.x..x..x', k4: 'x.x.x.x.x.x.x.x.', add: 'x...............' } },
  { id: 'dembow', name: 'dembow', blurb: 'reggaeton bounce', bpm: 96, kit: 0, swing: 0, filter: 1, echo: 0.12,
    lanes: { k1: 'x...x...x...x...', k2: '...x..x....x..x.', k6: '...x..x....x..x.', mul: 'x.x.x.x.x.x.x.x.', dot: '......x.......x.' } },
];

export function starterPattern(s: Starter) {
  const pattern = Array.from({ length: 16 }, () => new Set<string>());
  Object.entries(s.lanes).forEach(([id, lane]) => [...lane].forEach((c, i) => { if (c === 'x') pattern[i].add(id); }));
  return pattern;
}
