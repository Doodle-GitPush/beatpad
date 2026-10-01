/** Rendering quality tiers. "auto" picks one from the device and steps down if frames run slow. */
export type Tier = 'ultra' | 'high' | 'medium' | 'low';
export type QualitySetting = 'auto' | Tier;

export interface TierSpec {
  /** max device-pixel ratio, and a cap on total rendered pixels */
  dpr: number; pixelBudget: number;
  /** ambient occlusion quality, or null to switch it off */
  ao: 'Performance' | 'Low' | 'Medium' | 'High' | null;
  aoHalfRes: boolean;
  /** soft glow on the brightest highlights (0 = off) */
  bloom: number;
  /** table reflection resolution as a fraction of the screen, 0 = off */
  reflection: number;
  shadowMap: number;
  antialias: boolean;
}

export const TIERS: Record<Tier, TierSpec> = {
  // every tier keeps reflections and soft shadows — slower devices give up resolution first, effects last
  ultra:  { dpr: 2,    pixelBudget: 5.6e6, ao: 'High',        aoHalfRes: false, bloom: 0.45, reflection: 0.5,  shadowMap: 4096, antialias: true },
  high:   { dpr: 1.75, pixelBudget: 4.0e6, ao: 'Medium',      aoHalfRes: true,  bloom: 0.4,  reflection: 0.4,  shadowMap: 2048, antialias: true },
  medium: { dpr: 1.4,  pixelBudget: 2.6e6, ao: 'Low',         aoHalfRes: true,  bloom: 0,    reflection: 0.3,  shadowMap: 2048, antialias: true },
  low:    { dpr: 1,    pixelBudget: 1.5e6, ao: 'Performance', aoHalfRes: true,  bloom: 0,    reflection: 0.2,  shadowMap: 1024, antialias: true },
};
export const TIER_ORDER: Tier[] = ['ultra', 'high', 'medium', 'low'];

const KEY = 'beatpad.quality';
export function readSetting(): QualitySetting {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'auto' || v === 'ultra' || v === 'high' || v === 'medium' || v === 'low') return v;
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
  // 'ultra' is opt-in from the ? menu: even fast laptops drop below 60 fps with it while animating
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
      if (samples.length < 60) return;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      samples.length = 0;
      if (avg > 30) { cooldownUntil = now + 3000; onSlow(); }               // below ~33 fps while active → step down
    },
    reset() { samples.length = 0; last = 0; },
  };
}
