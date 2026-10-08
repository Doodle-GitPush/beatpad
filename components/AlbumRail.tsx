'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { KITS } from '@/lib/audio';
import { loadStarter, togglePlay } from '@/lib/sequencer';
import { STARTERS, type Starter } from '@/lib/starters';
import { useUi } from '@/lib/store';
import s from './AlbumRail.module.css';

/**
 * The starter beats as a fan of record sleeves, each with its vinyl tucked inside.
 *
 * The focused sleeve sits square in the middle; its neighbours fan out to either side, turned
 * away, pushed back and dimmed. Hovering the focused sleeve lets its record peek out; clicking
 * it (or Enter) pulls the record out, spins it, and loads and plays that beat. Click a
 * neighbour, drag, scroll or use the arrow keys to browse.
 *
 * The sleeve art is the beat itself: one row of dots per sound, sixteen steps across.
 */

/* each sleeve's colour, and the label in the middle of its record */
const SLEEVE: Record<string, { bg: string; ink: string }> = {
  boombap: { bg: '#c9732c', ink: '#fbe8d3' },
  house: { bg: '#2f5fb3', ink: '#dce8ff' },
  lofi: { bg: '#7a64ad', ink: '#ece5ff' },
  trap: { bg: '#b8322e', ink: '#ffe1dc' },
  break: { bg: '#2a8a62', ink: '#dbf5e8' },
  dembow: { bg: '#d6a21f', ink: '#3a2a05' },
};

const VISIBLE = 2;                     // sleeves shown either side of the focused one
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function AlbumRail() {
  const u = useUi();
  const [focus, setFocus] = useState(2);                 // start mid-rail so sleeves fan out both ways
  const [out, setOut] = useState<string | null>(null);     // the starter whose record is pulled out
  const rail = useRef<HTMLDivElement>(null);
  const n = STARTERS.length;
  const go = (i: number) => setFocus(Math.max(0, Math.min(n - 1, i)));

  // a wheel or trackpad swipe steps through the sleeves; the listener is native so it can stop the drawer scrolling
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let acc = 0, last = 0;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      e.preventDefault();
      const now = performance.now();
      if (now - last > 300) acc = 0;
      last = now; acc += d;
      if (Math.abs(acc) > 60) { setFocus((f) => Math.max(0, Math.min(n - 1, f + Math.sign(acc)))); acc = 0; }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [n]);

  // dragging sideways flips through them, one sleeve per 70px
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, moved: false }; };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 70) { go(focus - Math.sign(dx)); d.x = e.clientX; d.moved = true; }
  };
  const onPointerUp = () => { setTimeout(() => { drag.current = null; }, 0); };

  const playing = u.state !== 'stopped';
  const toggleRecord = (st: Starter) => {
    if (out === st.id) {                                   // put it back: stop the music
      setOut(null);
      if (playing) togglePlay();
      return;
    }
    if (!loadStarter(st.id, true)) return;                 // all patterns full and the user said no
    setOut(st.id);
    if (!playing) togglePlay();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(focus - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(focus + 1); }
    if (e.key === 'Enter') { e.preventDefault(); toggleRecord(STARTERS[focus]); }
  };

  const cur = STARTERS[focus];
  const curOut = out === cur.id;
  return (
    <div className={s.wrap}>
      <div ref={rail} className={s.rail} tabIndex={0} role="listbox" aria-label="Starter beats"
        aria-activedescendant={`sleeve-${cur.id}`} onKeyDown={onKey}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {STARTERS.map((st, i) => {
          const o = i - focus, a = Math.abs(o), side = Math.sign(o);
          const isOut = out === st.id;
          const style = {
            '--o': o, '--a': a, '--side': side,
            '--bg': SLEEVE[st.id].bg, '--ink': SLEEVE[st.id].ink,
            zIndex: 10 - a,
          } as React.CSSProperties;
          return (
            <div key={st.id} id={`sleeve-${st.id}`} role="option" aria-selected={o === 0}
              className={`${s.item} ${o === 0 ? s.focused : ''} ${a > VISIBLE ? s.hidden : ''} ${isOut ? s.out : ''} ${isOut && playing ? s.spin : ''}`}
              style={style}
              onClick={() => { if (drag.current?.moved) return; if (o === 0) toggleRecord(st); else go(i); }}>
              <div className={s.record} aria-hidden="true">
                <div className={s.disc}><div className={s.label}><i /></div></div>
              </div>
              <div className={s.sleeve}>
                <Cover st={st} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={s.caption}>
        <div className={s.titles}>
          <b>{cap(cur.name)}</b>
          <span>{cap(cur.blurb)} · {cur.bpm} bpm · {KITS[cur.kit].name}</span>
        </div>
        <div className={s.controls}>
          <button type="button" className={s.nav} onClick={() => go(focus - 1)} disabled={focus === 0} aria-label="Previous starter">‹</button>
          <button type="button" className={s.play} style={{ '--bg': SLEEVE[cur.id].bg } as React.CSSProperties}
            onClick={() => toggleRecord(cur)} aria-label={curOut ? `Stop ${cur.name}` : `Play ${cur.name}`}>
            {curOut
              ? <Square className={s.playIcon} fill="currentColor" aria-hidden="true" />
              : <Play className={`${s.playIcon} ${s.playTri}`} fill="currentColor" aria-hidden="true" />}
          </button>
          <button type="button" className={s.nav} onClick={() => go(focus + 1)} disabled={focus === n - 1} aria-label="Next starter">›</button>
        </div>
      </div>
    </div>
  );
}

/** the sleeve art: the beat's own step pattern, a row of dots per sound */
function Cover({ st }: { st: Starter }) {
  const lanes = Object.values(st.lanes);
  return (
    <div className={s.cover}>
      <span className={s.bpm}>{st.bpm}</span>
      <div className={s.grid} style={{ gridTemplateRows: `repeat(${lanes.length}, 1fr)` }}>
        {lanes.map((lane, r) => (
          <div key={r} className={s.lane}>
            {[...lane].map((c, i) => <i key={i} className={c === 'x' ? s.hit : ''} />)}
          </div>
        ))}
      </div>
      <span className={s.name}>{cap(st.name)}</span>
    </div>
  );
}
