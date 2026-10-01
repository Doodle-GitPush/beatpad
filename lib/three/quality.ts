/** Rendering quality tiers. "auto" picks one from the device and steps down if frames run slow. */
export type Tier = 'high' | 'medium' | 'low';
export type QualitySetting = 'auto' | Tier;

export interface TierSpec {
  /** max device-pixel ratio, and a cap on total rendered pixels */
  dpr: number; pixelBudget: number;
  /** ambient occlusion quality, or null to switch it off */
  ao: 'Performance' | 'Low' | 'Medium' | null;
  /** table reflection resolution as a fraction of the screen, 0 = off */
  reflection: number;
  shadowMap: number;
  antialias: boolean;
}

export const TIERS: Record<Tier, TierSpec> = {
  high:   { dpr: 1.25, pixelBudget: 2.4e6, ao: 'Medium',      reflection: 0.22, shadowMap: 2048, antialias: true },
  medium: { dpr: 1,    pixelBudget: 1.6e6, ao: 'Performance', reflection: 0.14, shadowMap: 1024, antialias: true },
  low:    { dpr: 0.9,  pixelBudget: 1.0e6, ao: null,          reflection: 0,    shadowMap: 1024, antialias: false },
};
export const TIER_ORDER: Tier[] = ['high', 'medium', 'low'];

const KEY = 'beatpad.quality';
export function readSetting(): QualitySetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'auto' || v === 'high' || v === 'medium' || v === 'low') return v;
  } catch { /* unavailable */ }
  return 'auto';
}
export function saveSetting(v: QualitySetting) {
  try { localStorage.setItem(KEY, v); } catch { /* unavailable */ }
}

/** first guess before we have any frame timings */
export function guessTier(gl: WebGLRenderingContext | WebGL2RenderingContext): Tier {
  let gpu = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  } catch { /* unavailable */ }
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'low';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (/mali|adreno [1-5]|powervr|intel(\(r\))? (hd|uhd) graphics [2-6]/.test(gpu)) return coarse ? 'low' : 'medium';
  if (coarse || cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

/** Pixel ratio for a tier at the current window size (respects both the cap and the pixel budget). */
export function pixelRatioFor(spec: TierSpec) {
  const area = window.innerWidth * window.innerHeight;
  return Math.max(0.6, Math.min(spec.dpr, window.devicePixelRatio || 1, Math.sqrt(spec.pixelBudget / area)));
}

/**
 * Watches frame times while the scene is actively animating; if they stay slow, asks to drop a tier.
 * Idle frames aren't rendered at all, so only real work is measured.
 */
export function createGovernor(onSlow: () => void) {
  const samples: number[] = [];
  let last = 0, cooldownUntil = 0;
  return {
    /** call once per rendered frame */
    sample(now: number) {
      const dt = now - last; last = now;
      if (dt > 250 || now < cooldownUntil) { samples.length = 0; return; }   // gap = we were idle, not slow
      samples.push(dt);
      if (samples.length < 45) return;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples.length = 0;
      if (avg > 26) { cooldownUntil = now + 2500; onSlow(); }               // below ~38 fps → step down
    },
    reset() { samples.length = 0; last = 0; },
  };
}
