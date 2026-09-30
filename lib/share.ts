import { COLORWAYS, DECAYS, TUNE_RANGE, VOICE_LIST, type KeySound } from './keyconfig';

/**
 * Share links: one pattern plus its sound settings packed into the URL hash, so no server is needed.
 *   v1  #beat=1.<bpm>.<kit>.<swing>.<filter>.<echo>.<pitch>.<steps>
 *   v2  #beat=2.<same 7 fields>.<colorway>.<keys>.<challenge date or empty>
 * <steps> is base64url of 16 steps × 3 bytes, one bit per instrument (order below — never reorder, only append).
 * <keys> is 3 base-36 chars per instrument key: sound index, tune + 12, length index.
 */
const IDS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k0', 'dot', 'add', 'enter', 'num', 'div', 'mul', 'sub'];
const VERSION = '2';
const b36 = (n: number) => n.toString(36);
const unb36 = (c: string) => parseInt(c, 36);

export interface SharedBeat {
  pattern: Set<string>[];
  bpm: number; kit: number; swing: number; filter: number; echo: number; pitch: number;
  /** v2 only */
  colorway?: number;
  keys?: Record<string, KeySound>;
  challenge?: string;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);

export function encodeBeat(b: SharedBeat): string {
  const bytes = new Uint8Array(16 * 3);
  b.pattern.forEach((set, st) => {
    let bits = 0;
    IDS.forEach((id, i) => { if (set.has(id)) bits |= 1 << i; });
    bytes[st * 3] = bits & 255; bytes[st * 3 + 1] = (bits >> 8) & 255; bytes[st * 3 + 2] = (bits >> 16) & 255;
  });
  const keys = IDS.map((id) => {
    const c = b.keys?.[id];
    if (!c) return '0c4';
    const vi = Math.max(0, VOICE_LIST.findIndex((v) => v.id === c.voice));
    let di = 0;
    DECAYS.forEach((d, i) => { if (Math.abs(d - c.decay) < Math.abs(DECAYS[di] - c.decay)) di = i; });
    return b36(vi) + b36(c.tune + TUNE_RANGE) + b36(di);
  }).join('');
  return [VERSION, Math.round(b.bpm), b.kit, pct(b.swing), pct(b.filter), pct(b.echo), pct(b.pitch), b64url(bytes),
    b.colorway ?? 0, keys, (b.challenge ?? '').replace(/-/g, '')].join('.');
}

export function decodeBeat(s: string): SharedBeat | null {
  try {
    const f = s.split('.');
    if (!((f[0] === '1' && f.length === 8) || (f[0] === '2' && f.length === 11))) return null;
    const [bpm, kit, swing, filter, echo, pitch] = f.slice(1, 7).map(Number);
    if ([bpm, kit, swing, filter, echo, pitch].some((n) => !Number.isFinite(n))) return null;
    const bytes = unb64url(f[7]);
    if (bytes.length !== 48) return null;
    const pattern = Array.from({ length: 16 }, (_, st) => {
      const bits = bytes[st * 3] | (bytes[st * 3 + 1] << 8) | (bytes[st * 3 + 2] << 16);
      return new Set(IDS.filter((_, i) => bits & (1 << i)));
    });
    const beat: SharedBeat = {
      pattern,
      bpm: Math.min(200, Math.max(60, bpm)), kit: Math.max(0, Math.floor(kit)),
      swing: swing / 100, filter: filter / 100, echo: echo / 100, pitch: pitch / 100,
    };
    if (f[0] === '2') {
      const cw = Number(f[8]);
      if (Number.isInteger(cw) && cw >= 0 && cw < COLORWAYS.length) beat.colorway = cw;
      if (f[9].length === IDS.length * 3) {
        beat.keys = {};
        IDS.forEach((id, i) => {
          const [v, t, d] = [...f[9].slice(i * 3, i * 3 + 3)].map(unb36);
          if (VOICE_LIST[v] && t >= 0 && t <= TUNE_RANGE * 2 && DECAYS[d] !== undefined) {
            beat.keys![id] = { voice: VOICE_LIST[v].id, tune: t - TUNE_RANGE, decay: DECAYS[d] };
          }
        });
      }
      if (/^\d{8}$/.test(f[10])) beat.challenge = `${f[10].slice(0, 4)}-${f[10].slice(4, 6)}-${f[10].slice(6)}`;
    }
    return beat;
  } catch {
    return null;
  }
}

export const readBeatFromHash = () => {
  const m = location.hash.match(/[#&]beat=([^&]+)/);
  return m ? decodeBeat(decodeURIComponent(m[1])) : null;
};
