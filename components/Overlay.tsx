'use client';

import { useEffect, useState } from 'react';
import { exportWav, hooks, selectStep, shareBeat } from '@/lib/sequencer';
import { applyTheme } from '@/lib/theme';
import { ui, useUi } from '@/lib/store';
import Guide from './Guide';
import { Drum, Grid3x3, Metronome } from 'lucide-react';
import { Logo } from './Logo';
import { IconDownload, IconHelp, IconMoon, IconShare, IconSun } from './Icons';
import Panel, { Tools } from './Panel';
import s from './BeatPad.module.css';

/** keep focus off buttons after a click so Space keeps playing the beat */
const blurAfter = (fn: () => void) => (e: React.MouseEvent<HTMLElement>) => { fn(); e.currentTarget.blur(); };

export default function Overlay() {
  const u = useUi();
  const [help, setHelp] = useState(false);
  const toggleTheme = () => {
    const next = u.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    ui.set({ theme: next });
  };

  useEffect(() => {
    if (!help) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') setHelp(false); };
    const onDown = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('[data-help]')) setHelp(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [help]);

  if (u.error) {
    return (
      <div className={s.loading}>
        <div className={s.error}>
          <b>Couldn’t start the 3D view</b>
          <p>{u.error}</p>
          <p>This needs WebGL. Try a current Chrome, Safari or Firefox with hardware acceleration turned on, or open the <a href="/2d.html">2D version</a>.</p>
        </div>
      </div>
    );
  }

  const led = u.state === 'recording' ? s.rec : u.state === 'playing' ? s.play : '';
  const nextTheme = u.theme === 'dark' ? 'light' : 'dark';

  return (
    <>
      <header className={s.topbar}>
        <div className={s.left}>
          <div className={s.brand}><Logo className={s.logo} stroke={36} /><b>BEAT PAD</b><span>3d drum instrument</span></div>
        </div>
        <div className={s.actions}>
          <a className={`${s.iconBtn} ${s.glass} ${s.textBtn}`} href="/2d.html" aria-label="Switch to the 2D version" title="Switch to the 2D version">2D</a>
          <button type="button" className={s.primary} onClick={blurAfter(() => shareBeat())} aria-label="Share this beat" title="Copy a link to this beat">
            <IconShare /><span className={s.primaryLabel}>share</span>
          </button>
          <button type="button" className={`${s.iconBtn} ${s.glass}`} onClick={blurAfter(exportWav)} aria-label="Export WAV" title="Download this pattern as a WAV">
            <IconDownload />
          </button>
          <button type="button" className={`${s.iconBtn} ${s.glass}`} onClick={blurAfter(toggleTheme)} aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`}>
            {u.theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button type="button" data-help className={`${s.iconBtn} ${s.glass} ${help ? s.iconOn : ''}`} aria-expanded={help} aria-haspopup="dialog"
            onClick={blurAfter(() => setHelp((h) => !h))} aria-label="Help and shortcuts" title="Help and shortcuts">
            <IconHelp />
          </button>
        </div>
      </header>

      {help && <HelpMenu close={() => setHelp(false)} />}

      <footer className={`${s.statusbar} ${s.glass}`} aria-label="Transport">
        <span className={`${s.stat} ${s.state}`}><i className={`${s.led} ${led}`} aria-hidden="true" /><b>{u.state}</b></span>
        <span className={s.stat}><Metronome className={s.statIcon} aria-hidden="true" /><b>{u.bpm}</b>bpm</span>
        <span className={`${s.stat} ${s.hideSm}`}><Drum className={s.statIcon} aria-hidden="true" />kit <b>{u.kit}</b></span>
        <span className={s.stat}><Grid3x3 className={s.statIcon} aria-hidden="true" />pat <b>{u.pat}</b></span>
        {u.hit !== '—' && <span className={`${s.stat} ${s.hitStat} ${s.hideSm}`}><b title={u.hit}>{u.hit}</b></span>}
        <span className={s.steps} role="group" aria-label="Steps — click one, then press keys to edit it">
          {[0, 1, 2, 3].map((g) => (
            <span className={s.grp} key={g}>
              {[0, 1, 2, 3].map((n) => {
                const i = g * 4 + n;
                const cls = [s.step, u.has[i] && s.has, u.cur === i && s.cur, u.sel === i && s.sel].filter(Boolean).join(' ');
                return <button type="button" key={i} className={cls} aria-pressed={u.sel === i} title={`step ${i + 1}`} aria-label={`step ${i + 1}${u.has[i] ? ', has sounds' : ''}`} onClick={blurAfter(() => selectStep(i))} />;
              })}
            </span>
          ))}
        </span>
      </footer>

      <Toast />
      <div className={`${s.hud} ${u.hud.show ? s.show : ''}`} style={{ left: u.hud.x, top: u.hud.y }}>{u.hud.text}</div>
      {u.ready && <><Tools /><Panel /><Guide /></>}
    </>
  );
}

/** short-lived status messages ("link copied", "loaded a shared beat") above the transport */
function Toast() {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    let last = ui.get().hint, timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = ui.subscribe(() => {
      const { hint, ready } = ui.get();
      if (hint === last) return;
      last = hint;
      if (!ready || !hint || hint === 'audio on') return;
      setShown(hint);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(null), hint.length > 40 ? 4200 : 2800);
    });
    return () => { unsub(); clearTimeout(timer); };
  }, []);
  return <div className={`${s.toast} ${s.glass} ${shown ? s.toastOn : ''}`} role="status" aria-live="polite">{shown}</div>;
}

function HelpMenu({ close }: { close: () => void }) {
  // keys are joined with the separator shown between them
  const rows: { keys: string[]; sep?: string; d: string }[] = [
    { keys: ['0–9', '.', '+', '−'], sep: ' ', d: 'play sounds (or the numpad)' },
    { keys: ['space'], d: 'play / stop' },
    { keys: ['R'], d: 'record — hits snap to the grid' },
    { keys: ['R', '1–9'], sep: ' + ', d: 'switch pattern' },
    { keys: ['⌫'], d: 'clear pattern · hold + key erases one sound' },
    { keys: ['M'], d: 'metronome' },
    { keys: ['esc'], d: 'leave step editing / close panels' },
  ];
  return (
    <div className={`${s.menu} ${s.glass}`} role="dialog" aria-label="Help and shortcuts" data-help>
      <div className={s.menuTitle}>keyboard</div>
      <dl className={s.keys}>
        {rows.map((r) => (
          <FragmentRow key={r.d} d={r.d}
            k={r.keys.map((k, i) => <span key={k}>{i > 0 && (r.sep ?? ' ')}<kbd>{k}</kbd></span>)} />
        ))}
      </dl>
      <div className={s.menuTitle}>mouse &amp; touch</div>
      <dl className={s.keys}>
        <FragmentRow k="knobs" d="drag up / down or scroll" />
        <FragmentRow k="jog" d="spin for tempo — it has momentum" />
        <FragmentRow k="steps" d="click a step, then press keys to edit it" />
        <FragmentRow k="orbit" d="drag empty space · double-click to reset" />
      </dl>
      <QualityPicker />
      <div className={s.menuRow}>
        <button type="button" className={s.menuBtn} onClick={() => { close(); ui.set({ guide: 0, panel: 'none' }); }}>replay the guide</button>
        <a className={s.menuBtn} href="/2d.html">2d version</a>
      </div>
    </div>
  );
}
function QualityPicker() {
  const u = useUi();
  const opts = ['auto', 'ultra', 'high', 'medium', 'low'] as const;
  return (
    <>
      <div className={s.menuTitle}>graphics quality{u.quality === 'auto' && <> · using {u.tier}</>}</div>
      <div className={s.seg} role="radiogroup" aria-label="Graphics quality">
        {opts.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={u.quality === o}
            className={`${s.segBtn} ${u.quality === o ? s.segOn : ''}`} onClick={() => hooks.setQuality(o)}>{o}</button>
        ))}
      </div>
      <p className={s.menuNote}>Auto picks for your device and steps down if things get choppy. Lower settings render fewer pixels; reflections and soft shadows stay on.</p>
    </>
  );
}

function FragmentRow({ k, d }: { k: React.ReactNode; d: string }) {
  return <div className={s.kv}><dt>{k}</dt><dd>{d}</dd></div>;
}
