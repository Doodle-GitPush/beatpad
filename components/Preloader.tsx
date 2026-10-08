'use client';

import { useEffect, useRef, useState } from 'react';
import { hooks } from '@/lib/sequencer';
import { ui } from '@/lib/store';
import { LOGO_DIVIDER, LOGO_OUTLINE } from './Logo';
import s from './Preloader.module.css';

/**
 * Boot screen: the logo traces itself as the instrument loads, then fills in when it is ready.
 *
 * The trace is driven from one rAF loop and written straight to the paths, not through React
 * state and a CSS transition: a target that moves every frame restarts a transition every
 * frame, which is what made the start stutter. Here the drawn amount eases toward the real
 * progress (or a slow crawl while the 3D bundle is still downloading) at a capped speed, so
 * it is smooth whether progress creeps or jumps, and the fill only starts once it has closed.
 */
const EASE = 0.18;        // seconds for the trace to cover most of a gap
const MAX_SPEED = 1.1;    // fraction of the logo per second, so a sudden "done" still draws visibly
const MIN_SPEED = 0.35;   // …and never slower than this while behind, so the easing has no long tail

export default function Preloader() {
  const [phase, setPhase] = useState<'show' | 'fill' | 'fade' | 'gone'>('show');
  const wrap = useRef<HTMLDivElement>(null);
  const outlines = useRef<SVGPathElement[]>([]);
  const dividers = useRef<SVGPathElement[]>([]);

  useEffect(() => {
    let raf = 0, last = performance.now(), shown = 0, lastPct = -1;
    const t0 = last;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const u = ui.get();
      const done = u.ready || !!u.error;
      const crawl = 0.4 * (1 - Math.exp(-(now - t0) / 1600));          // eases toward 40 %
      const target = done ? 1 : Math.max(u.progress, crawl);
      const gap = target - shown;
      const step = gap > 0 ? Math.min(gap, Math.max(gap * Math.min(1, dt / EASE), MIN_SPEED * dt)) : 0;
      shown = Math.min(1, shown + Math.min(step, MAX_SPEED * dt));
      const outline = Math.min(1, shown / 0.85);                         // the outline takes most of it,
      const divider = Math.max(0, (shown - 0.85) / 0.15);               // each key's divider the last stretch
      outlines.current.forEach((p) => p.style.setProperty('stroke-dashoffset', String(1 - outline)));
      dividers.current.forEach((p) => p.style.setProperty('stroke-dashoffset', String(1 - divider)));
      const pct = Math.round(shown * 100);
      if (pct !== lastPct && pct % 10 === 0) { lastPct = pct; wrap.current?.setAttribute('aria-label', `Loading, ${pct} percent`); }
      if (done && shown > 0.999) { setPhase('fill'); return; }          // closed: stop driving, start the fill
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (phase === 'fill') { const t = setTimeout(() => setPhase('fade'), 850); return () => clearTimeout(t); }   // hold the filled mark a moment
    if (phase === 'fade') {
      hooks.playIntro();                                     // the camera swoops in as the screen clears
      const t = setTimeout(() => setPhase('gone'), 700); return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div ref={wrap} className={`${s.wrap} ${phase === 'fade' ? s.fade : ''}`} role="status" aria-live="polite" aria-label="Loading, 0 percent">
      <svg className={`${s.mark} ${phase !== 'show' ? s.filled : ''}`} viewBox="-360 -360 720 720" aria-hidden="true">
        <g transform="rotate(-45)">
          {[0, 1].map((i) => (
            <g key={i} transform={`rotate(${i * 180})`}>
              <path ref={(el) => { if (el) outlines.current[i] = el; }} className={s.outline} d={LOGO_OUTLINE} pathLength={1} />
              <path ref={(el) => { if (el) dividers.current[i] = el; }} className={s.divider} d={LOGO_DIVIDER} pathLength={1} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
