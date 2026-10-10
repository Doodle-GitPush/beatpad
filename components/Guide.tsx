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
  const [shown, setShown] = useState(false);              // has a target on screen
  const card = useRef<HTMLDivElement>(null);
  const at = useRef<{ x: number; y: number } | null>(null);   // where the card is drawn, kept across steps so a step change glides
  const inner = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState<number | null>(null);
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

  // follow the anchor (the camera moves during the intro and when orbiting). The card eases toward
  // where it should be every frame, written straight to its style: a step change glides it across,
  // and a target that moves every frame (the intro swoosh) is chased smoothly, with no transition
  // restarting each frame.
  const W = typeof window === 'undefined' ? 320 : Math.min(320, window.innerWidth - 32);
  useEffect(() => {
    if (step < 0) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const a = STEPS[step].anchor;
      let p: { x: number; y: number } | null;
      if (a === 'tools') {
        const r = document.getElementById('bp-tools')?.getBoundingClientRect();
        p = r ? { x: r.left + r.width / 2, y: r.top } : null;   // the create menu sits at the bottom: point from above
      } else p = anchors[a]?.() ?? null;
      setShown(!!p);
      const el = card.current;
      if (p && el) {
        const H = el.offsetHeight || 170;
        const below = a !== 'tools' && p.y < H + 40;
        const tx = Math.max(16, Math.min(window.innerWidth - W - 16, p.x - W / 2));
        const ty = below ? p.y + 22 : p.y - H - 22;
        const cur = at.current;
        if (!cur) at.current = { x: tx, y: ty };
        else { const k = 1 - Math.exp(-dt / 0.12); cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k; }
        const { x, y } = at.current!;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, W]);

  // the card's height follows its contents, so a longer or shorter step grows or shrinks it smoothly
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInnerH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);

  if (step < 0 || step >= STEPS.length) return null;
  const st = STEPS[step];

  return (
    <>
      <div ref={card} className={s.card} style={{ width: W, visibility: shown ? 'visible' : 'hidden' }} role="dialog" aria-live="polite" aria-label={`Guide step ${step + 1} of ${STEPS.length}`}>
        <div className={s.dots} aria-label={`Step ${step + 1} of ${STEPS.length}`} role="img">
          {STEPS.map((_, i) => <i key={i} className={i === step ? s.dotOn : i < step ? s.dotDone : ''} />)}
        </div>
        <div className={s.sizer} style={{ height: innerH ?? undefined }}>
        <div ref={inner}>
        <div key={step} className={s.swap}>
        <b className={s.title}>{st.title}</b>
        <p className={s.body}>{st.body}</p>
        <div className={s.row}>
          {st.action ? <span className={s.wait}>{st.action}</span> : <span />}
          <span className={s.btns}>
            <button type="button" className={s.skip} onClick={finish}>Skip</button>
            <button type="button" className={s.next}
              onClick={(e) => { if (step + 1 >= STEPS.length) finish(); else ui.set({ guide: step + 1 }); e.currentTarget.blur(); }}>
              {step + 1 >= STEPS.length ? "Let's go" : 'Next'}
            </button>
          </span>
        </div>
        </div>
        </div>
        </div>
      </div>
    </>
  );
}
