'use client';

import { exportWav, selectStep } from '@/lib/sequencer';
import { applyTheme } from '@/lib/theme';
import { ui } from '@/lib/store';
import { useUi } from '@/lib/store';
import s from './BeatPad.module.css';

export default function Overlay() {
  const u = useUi();
  const led = u.state === 'recording' ? s.rec : u.state === 'playing' ? s.play : '';
  const toggleTheme = () => {
    const next = u.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    ui.set({ theme: next });
  };

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
          <a href="/2d.html">2d version</a> ·{' '}
          <button type="button" className={s.themeBtn} onClick={(e) => { toggleTheme(); e.currentTarget.blur(); }}
            aria-label={`Switch to ${u.theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${u.theme === 'dark' ? 'light' : 'dark'} mode`}>
            {u.theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" /></svg>
            )}
            {u.theme === 'dark' ? 'light' : 'dark'}
          </button>
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
