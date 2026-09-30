/**
 * Share links: one pattern plus its sound settings packed into the URL hash, so no server is needed.
 *   #beat=1.<bpm>.<kit>.<swing>.<filter>.<echo>.<pitch>.<steps>
 * <steps> is base64url of 16 steps × 3 bytes, one bit per instrument (order below — never reorder, only append).
 */
const IDS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k0', 'dot', 'add', 'enter', 'num', 'div', 'mul', 'sub'];
const VERSION = '1';

export interface SharedBeat {
  pattern: Set<string>[];
  bpm: number; kit: number; swing: number; filter: number; echo: number; pitch: number;
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
  return [VERSION, Math.round(b.bpm), b.kit, pct(b.swing), pct(b.filter), pct(b.echo), pct(b.pitch), b64url(bytes)].join('.');
}

export function decodeBeat(s: string): SharedBeat | null {
  try {
    const f = s.split('.');
    if (f.length !== 8 || f[0] !== VERSION) return null;
    const [bpm, kit, swing, filter, echo, pitch] = f.slice(1, 7).map(Number);
    if ([bpm, kit, swing, filter, echo, pitch].some((n) => !Number.isFinite(n))) return null;
    const bytes = unb64url(f[7]);
    if (bytes.length !== 48) return null;
    const pattern = Array.from({ length: 16 }, (_, st) => {
      const bits = bytes[st * 3] | (bytes[st * 3 + 1] << 8) | (bytes[st * 3 + 2] << 16);
      return new Set(IDS.filter((_, i) => bits & (1 << i)));
    });
    return {
      pattern,
      bpm: Math.min(200, Math.max(60, bpm)), kit: Math.max(0, Math.floor(kit)),
      swing: swing / 100, filter: filter / 100, echo: echo / 100, pitch: pitch / 100,
    };
  } catch {
    return null;
  }
}

export const readBeatFromHash = () => {
  const m = location.hash.match(/[#&]beat=([^&]+)/);
  return m ? decodeBeat(decodeURIComponent(m[1])) : null;
};
