'use client';

import { exportWav, selectStep } from '@/lib/sequencer';
import { useUi } from '@/lib/store';
import s from './BeatPad.module.css';

export default function Overlay() {
  const u = useUi();
  const led = u.state === 'recording' ? s.rec : u.state === 'playing' ? s.play : '';

  return (
    <>
      {u.error ? (
        <div className={s.loading}>
          <div className={s.error}>
            <b>Couldn’t start the 3D view</b>
            <p>{u.error}</p>
            <p>This needs WebGL. Try a current Chrome, Safari or Firefox with hardware acceleration turned on, or open the <a href="/2d.html">2D version</a>.</p>
          </div>
        </div>
      ) : (
        !u.ready && <div className={s.loading}>loading…</div>
      )}

      <div className={`${s.ui} ${s.top}`}>
        <span><b>beat pad</b> — 3d drum instrument</span>
        <span>
          <span>{u.hint}</span> ·{' '}
          <button type="button" className={s.link} onClick={exportWav}>export wav</button> ·{' '}
          <a href="/2d.html">2d version</a>
        </span>
      </div>

      <div className={`${s.ui} ${s.bottom}`}>
        <div className={s.stats}>
          <span className={s.state}><i className={`${s.led} ${led}`} /><b>{u.state}</b></span>
          <span>bpm <b>{u.bpm}</b></span>
          <span>kit <b>{u.kit}</b></span>
          <span>pat <b>{u.pat}</b></span>
          <span>hit <b>{u.hit}</b></span>
        </div>
        <div className={s.help}>
          Keys play sounds · <b>○</b> play · <b>●</b> record · hold <b>●</b> + <b>1–9</b> switch pattern · <b>del</b> clear
          (hold + key erases one) · click a step light, then press keys to edit it · knobs filter / echo / pitch / swing ·
          fader vol · roller kit · jog tempo · drag empty space to orbit
        </div>
        <div className={s.steps}>
          {[0, 1, 2, 3].map((g) => (
            <span className={s.grp} key={g}>
              {[0, 1, 2, 3].map((n) => {
                const i = g * 4 + n;
                const cls = [s.step, u.has[i] && s.has, u.cur === i && s.cur, u.sel === i && s.sel].filter(Boolean).join(' ');
                return <button type="button" key={i} className={cls} title={`step ${i + 1}`} aria-label={`step ${i + 1}`} onClick={() => selectStep(i)} />;
              })}
            </span>
          ))}
        </div>
      </div>

      <div className={`${s.hud} ${u.hud.show ? s.show : ''}`} style={{ left: u.hud.x, top: u.hud.y }}>{u.hud.text}</div>
    </>
  );
}
