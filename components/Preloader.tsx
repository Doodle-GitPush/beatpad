'use client';

import { useEffect, useState } from 'react';
import { useUi } from '@/lib/store';
import { LOGO_DIVIDER, LOGO_OUTLINE } from './Logo';
import s from './Preloader.module.css';

/**
 * Boot screen: the logo traces itself as the instrument loads, then fills in when it is ready.
 * The trace follows real progress from the store; while the 3D bundle is still downloading
 * (no signal yet) it creeps forward on its own so it never looks stuck.
 */
export default function Preloader() {
  const u = useUi();
  const [crawl, setCrawl] = useState(0);
  const [phase, setPhase] = useState<'show' | 'fill' | 'fade' | 'gone'>('show');

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      setCrawl(0.4 * (1 - Math.exp(-(performance.now() - t0) / 1600)));   // eases toward 40 %
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const done = u.ready || !!u.error;
  useEffect(() => {
    if (!done) return;
    const a = setTimeout(() => setPhase('fill'), 950);    // let the trace close first (0.9s in the CSS)
    const b = setTimeout(() => setPhase('fade'), 1800);   // hold the filled mark a moment
    const c = setTimeout(() => setPhase('gone'), 2500);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, [done]);

  if (phase === 'gone') return null;
  const p = done ? 1 : Math.max(u.progress, crawl);
  // the outline takes most of the load; each key's divider draws in over the last stretch
  const outline = Math.min(1, p / 0.85);
  const divider = Math.max(0, (p - 0.85) / 0.15);

  return (
    <div className={`${s.wrap} ${phase === 'fade' ? s.fade : ''}`} role="status" aria-live="polite" aria-label={`Loading, ${Math.round(p * 100)} percent`}>
      <svg className={`${s.mark} ${phase === 'fill' || phase === 'fade' ? s.filled : ''}`} viewBox="-360 -360 720 720" aria-hidden="true">
        <g transform="rotate(-45)">
          {[0, 180].map((r) => (
            <g key={r} transform={`rotate(${r})`}>
              <path className={s.outline} d={LOGO_OUTLINE} pathLength={1} style={{ strokeDashoffset: 1 - outline }} />
              <path className={s.divider} d={LOGO_DIVIDER} pathLength={1} style={{ strokeDashoffset: 1 - divider }} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
