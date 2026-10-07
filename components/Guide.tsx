'use client';

import { useEffect, useRef, useState } from 'react';
import { anchors } from '@/lib/anchors';
import { ui, useUi } from '@/lib/store';
import s from './Guide.module.css';

const DONE_KEY = 'beatpad.guide.v1';

interface Step { anchor: string; title: string; body: string; action?: string }
const STEPS: Step[] = [
  { anchor: 'keys', title: 'Every key is a sound', body: 'Tap a few keys — or press 1–9 on your keyboard.', action: 'waiting for a sound…' },
  { anchor: 'play', title: 'Start the beat', body: 'Press ○ (or Space) to play the pattern.', action: 'waiting for play…' },
  { anchor: 'steps', title: 'Write your own', body: 'Click a step light, then press keys to add sounds on that step.', action: 'waiting for a step…' },
  { anchor: 'tools', title: 'Go further', body: "Take today's challenge, load a starter beat, or make the keys your own. Share anything with a link." },
];

const finish = () => {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* unavailable */ }
  ui.set({ guide: -1 });
};

export default function Guide() {
  const u = useUi();
  const step = u.guide;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const start = useRef({ hits: 0 });

  // first visit: start once the device has loaded and the camera intro has settled
  useEffect(() => {
    if (!u.ready) return;
    let seen = true;
    try { seen = localStorage.getItem(DONE_KEY) === '1'; } catch { /* treat as seen */ }
    if (seen || new URLSearchParams(location.search).has('noguide')) return;
    const t = setTimeout(() => { if (ui.get().guide < 0) ui.set({ guide: 0 }); }, 3200);
    return () => clearTimeout(t);
  }, [u.ready]);

  // remember where each step started so we can detect the action
  useEffect(() => { start.current.hits = ui.get().hits; }, [step]);

  // advance when the user does the thing
  useEffect(() => {
    if (step === 0 && u.hits > start.current.hits) ui.set({ guide: 1 });
    else if (step === 1 && u.state !== 'stopped') ui.set({ guide: 2 });
    else if (step === 2 && u.sel >= 0) ui.set({ guide: 3 });
  }, [step, u.hits, u.state, u.sel]);

  // follow the anchor (the camera moves during the intro and when orbiting)
  useEffect(() => {
    if (step < 0) return;
    let raf = 0;
    let last = '';
    const tick = () => {
      const a = STEPS[step].anchor;
      let p: { x: number; y: number } | null;
      if (a === 'tools') {
        const r = document.getElementById('bp-tools')?.getBoundingClientRect();
        p = r ? { x: r.left + r.width / 2, y: r.top } : null;   // the create menu sits at the bottom: point from above
      } else p = anchors[a]?.() ?? null;
      // only re-render when the target moved by a whole pixel
      const key = p ? `${Math.round(p.x)},${Math.round(p.y)}` : '';
      if (key !== last) { last = key; setPos(p && { x: Math.round(p.x), y: Math.round(p.y) }); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  if (step < 0 || step >= STEPS.length || !pos) return null;
  const st = STEPS[step];
  const W = Math.min(300, window.innerWidth - 32), H = 150;
  const below = st.anchor !== 'tools' && pos.y < H + 40;
  const left = Math.max(16, Math.min(window.innerWidth - W - 16, pos.x - W / 2));
  const top = below ? pos.y + 22 : pos.y - H - 22;

  return (
    <>
      {st.anchor !== 'tools' && <div className={s.ring} style={{ left: pos.x, top: pos.y }} aria-hidden="true" />}
      <div className={s.card} style={{ left, top, width: W }} role="dialog" aria-live="polite" aria-label={`Guide step ${step + 1} of ${STEPS.length}`}>
        <div className={s.count}>{step + 1} / {STEPS.length}</div>
        <b className={s.title}>{st.title}</b>
        <p className={s.body}>{st.body}</p>
        <div className={s.row}>
          {st.action ? <span className={s.wait}>{st.action}</span> : <span />}
          <span className={s.btns}>
            <button type="button" className={s.skip} onClick={finish}>skip</button>
            <button type="button" className={s.next}
              onClick={(e) => { if (step + 1 >= STEPS.length) finish(); else ui.set({ guide: step + 1 }); e.currentTarget.blur(); }}>
              {step + 1 >= STEPS.length ? "let's go" : 'next'}
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
