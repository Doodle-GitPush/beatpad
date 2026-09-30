'use client';

import { useEffect, useState } from 'react';
import { useUi } from '@/lib/store';
import s from './Preloader.module.css';

/**
 * Boot screen styled like the device's step lights: 16 LEDs fill as the instrument loads.
 * Real progress comes from the store; while the 3D bundle is still downloading (no signal yet)
 * it creeps forward on its own so it never looks stuck.
 */
export default function Preloader() {
  const u = useUi();
  const [crawl, setCrawl] = useState(0);
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show');

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
    const a = setTimeout(() => setPhase('fade'), 350);    // let the last LED land
    const b = setTimeout(() => setPhase('gone'), 1100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [done]);

  if (phase === 'gone') return null;
  const p = u.error ? 1 : Math.max(u.progress, crawl);
  const lit = Math.min(16, Math.round(p * 16));

  return (
    <div className={`${s.wrap} ${phase === 'fade' ? s.fade : ''}`} role="status" aria-live="polite" aria-label={`Loading, ${Math.round(p * 100)} percent`}>
      <div className={s.card}>
        <div className={s.brand}><b>beat pad</b> — 3d drum instrument</div>
        <div className={s.leds} aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} className={`${s.led} ${i < lit ? s.on : ''} ${i === lit - 1 && !done ? s.head : ''}`} />
          ))}
        </div>
        <div className={s.meta}>
          <span className={s.pct}>{String(Math.round(p * 100)).padStart(3, '0')}</span>
          <span className={s.stage}>{done ? 'ready' : u.loadStage}</span>
        </div>
      </div>
    </div>
  );
}
